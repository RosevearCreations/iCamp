import { randomUUID } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  buildFinancialCloseReview,
  localDay,
  validCloseDate,
} from "./core.mjs";

const { Pool } = pg;
let pool;
const MAX_ROWS = 400;
const KINDS = new Map([
  ["credit", "customer_credit"],
  ["charge", "customer_debit"],
  ["forfeit", "retained"],
  ["writeoff", "none"],
]);

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for financial close review.");
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeFinanceClosePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function requireFinancePermission(userId, campgroundId, permission) {
  const allowed = await hasCampgroundPermission(
    userId,
    campgroundId,
    permission,
  );
  const managerialReader =
    permission === "finance.read" &&
    (await hasCampgroundPermission(userId, campgroundId, "finance.manage"));
  if (!allowed && !managerialReader)
    throw new Error("Not authorized for campground financial review.");
}

async function transaction(client, userId, readOnly = false) {
  await client.query(readOnly ? "begin read only" : "begin");
  await client.query("set local role icamp_app");
  await client.query("set local statement_timeout = '10000ms'");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

async function property(client, campgroundId) {
  const result = await client.query(
    `select id, organization_id, name, timezone,
       (statement_timestamp() at time zone timezone)::date::text as local_today,
       statement_timestamp() as source_at
     from public.campgrounds where id=$1 and lifecycle_state='active' limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
  return result.rows[0];
}

const trim = (result) => ({
  rows: result.rows.slice(0, MAX_ROWS),
  truncated: result.rows.length > MAX_ROWS,
});
const iso = (value) => (value == null ? null : new Date(value).toISOString());

export async function getCampgroundFinanceCloseSource({
  userId,
  campgroundId,
  localDate,
}) {
  await requireFinancePermission(userId, campgroundId, "finance.read");
  // Existing payment/receipt RLS grants source visibility to reservation
  // readers, not finance permission alone. Require both rather than present
  // RLS-hidden records as a false zero/fully reconciled day.
  if (
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "reservation.read",
    )) &&
    !(await hasCampgroundPermission(userId, campgroundId, "reservation.modify"))
  )
    throw new Error(
      "Reservation read permission is also required to verify payment and receipt sources.",
    );
  const client = await getPool().connect();
  try {
    await transaction(client, userId, true);
    const scope = await property(client, campgroundId);
    const day = validCloseDate(
      localDate || scope.local_today,
      scope.local_today,
    );
    // All monetary records are obtained under existing campground RLS. A bounded
    // 100-day source window covers all selectable close dates but is NOT an
    // assertion of all-time balances or a bank settlement.
    const since = new Date(`${day}T12:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 100);
    const [paymentsResult, refundsResult, adjustmentsResult] =
      await Promise.all([
        client.query(
          `select p.id,p.reservation_id,p.payment_state,p.amount_cents,p.currency_code,
           p.provider_key,p.provider_payment_reference,p.captured_at,p.created_at,
           rc.id receipt_id,rc.amount_cents receipt_cents,rc.currency_code receipt_currency,
           rc.issued_at receipt_issued_at
         from public.reservation_payments p
         left join public.reservation_receipts rc on rc.payment_id=p.id
         where p.campground_id=$1 and (p.created_at >= $2 or p.updated_at >= $2)
         order by p.created_at desc limit 401`,
          [campgroundId, since.toISOString()],
        ),
        client.query(
          `select r.id,r.reservation_id,r.original_payment_id,r.amount_cents,r.currency_code,
           r.refund_state,r.approval_state,r.requested_by_user_id,r.approved_by_user_id,
           r.requested_at,r.completed_at,p.provider_payment_reference original_provider_reference,
           p.provider_key original_provider
         from public.reservation_refunds r
         left join public.reservation_payments p on p.id=r.original_payment_id
         where r.campground_id=$1 and (r.requested_at >= $2 or r.completed_at >= $2)
         order by r.requested_at desc limit 401`,
          [campgroundId, since.toISOString()],
        ),
        client.query(
          `select id,reservation_id,actor_user_id,adjustment_kind,financial_effect,
           amount_cents,currency_code,reason,evidence,occurred_at,idempotency_key
         from public.reservation_financial_adjustments
         where campground_id=$1 and occurred_at >= $2
         order by occurred_at desc limit 401`,
          [campgroundId, since.toISOString()],
        ),
      ]);
    await client.query("commit");
    const paymentPart = trim(paymentsResult),
      refundPart = trim(refundsResult),
      adjustmentPart = trim(adjustmentsResult);
    const source = {
      campgroundId,
      campgroundName: scope.name,
      organizationId: scope.organization_id,
      timezone: scope.timezone,
      generatedAt: iso(scope.source_at),
      localDate: day,
      sourceWindowStart: since.toISOString(),
      truncated: {
        payments: paymentPart.truncated,
        refunds: refundPart.truncated,
        adjustments: adjustmentPart.truncated,
      },
      payments: paymentPart.rows.map((row) => ({
        id: row.id,
        reservationId: row.reservation_id,
        state: row.payment_state,
        amountCents: Number(row.amount_cents),
        currencyCode: row.currency_code,
        provider: row.provider_key,
        providerReference: row.provider_payment_reference,
        capturedAt: iso(row.captured_at),
        createdAt: iso(row.created_at),
        receiptId: row.receipt_id,
        receiptCents:
          row.receipt_cents == null ? null : Number(row.receipt_cents),
        receiptCurrency: row.receipt_currency,
        receiptIssuedAt: iso(row.receipt_issued_at),
      })),
      refunds: refundPart.rows.map((row) => ({
        id: row.id,
        reservationId: row.reservation_id,
        originalPaymentId: row.original_payment_id,
        originalProviderReference: row.original_provider_reference,
        originalProvider: row.original_provider,
        amountCents: Number(row.amount_cents),
        currencyCode: row.currency_code,
        state: row.refund_state,
        approvalState: row.approval_state,
        requestedByUserId: row.requested_by_user_id,
        approvedByUserId: row.approved_by_user_id,
        requestedAt: iso(row.requested_at),
        completedAt: iso(row.completed_at),
      })),
      adjustments: adjustmentPart.rows.map((row) => ({
        id: row.id,
        reservationId: row.reservation_id,
        actorUserId: row.actor_user_id,
        adjustmentKind: row.adjustment_kind,
        financialEffect: row.financial_effect,
        amountCents: Number(row.amount_cents),
        currencyCode: row.currency_code,
        reason: row.reason,
        evidence: row.evidence,
        occurredAt: iso(row.occurred_at),
      })),
    };
    return { source, review: buildFinancialCloseReview(source) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function normalizeProposal({ kind, amountCents, currencyCode, reason }) {
  const effect = KINDS.get(kind);
  const amount = Number(amountCents);
  const currency = String(currencyCode ?? "")
    .trim()
    .toUpperCase();
  const note = String(reason ?? "").trim();
  if (
    !effect ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 200000000 ||
    !/^[A-Z]{3}$/u.test(currency) ||
    note.length < 8 ||
    note.length > 700
  )
    throw new Error(
      "Adjustment proposal must have a valid kind, positive cents, currency and reason (8–700 characters).",
    );
  return { kind, effect, amount, currency, note };
}

export async function proposeManualAdjustment({
  actorUserId,
  campgroundId,
  reservationId,
  kind,
  amountCents,
  currencyCode,
  reason,
  idempotencyKey = randomUUID(),
}) {
  await requireFinancePermission(actorUserId, campgroundId, "finance.manage");
  const proposal = normalizeProposal({
    kind,
    amountCents,
    currencyCode,
    reason,
  });
  if (!/^[a-f0-9-]{36}$/iu.test(idempotencyKey))
    throw new Error("Invalid proposal request key.");
  const client = await getPool().connect();
  try {
    await transaction(client, actorUserId);
    const scoped = await client.query(
      `select r.id,r.organization_id,coalesce(ms.currency_code,ps.currency_code,'CAD') as currency_code
       from public.reservations r
       left join public.reservation_management_state ms on ms.reservation_id=r.id
       left join public.reservation_payment_schedules ps on ps.reservation_id=r.id
       where r.id=$1 and r.campground_id=$2 limit 1`,
      [reservationId, campgroundId],
    );
    if (scoped.rowCount !== 1)
      throw new Error("Reservation not found in the authorized campground.");
    const reservation = scoped.rows[0];
    if (reservation.currency_code !== proposal.currency)
      throw new Error("Proposal currency must match reservation.");
    const result = await client.query(
      `insert into public.reservation_financial_adjustments
       (organization_id,campground_id,reservation_id,adjustment_kind,financial_effect,
        amount_cents,currency_code,reason,evidence,actor_user_id,idempotency_key)
       values ($1,$2,$3,'review_resolution','none',0,$4,$5,$6::jsonb,$7,$8)
       on conflict (campground_id,idempotency_key) do nothing returning id`,
      [
        reservation.organization_id,
        campgroundId,
        reservationId,
        proposal.currency,
        `Proposed ${proposal.kind}: ${proposal.note}`,
        JSON.stringify({
          build196: {
            type: "proposal",
            requestedKind: proposal.kind,
            requestedEffect: proposal.effect,
            requestedAmountCents: proposal.amount,
            requestedReason: proposal.note,
            posted: false,
          },
        }),
        actorUserId,
        `build196-proposal-${idempotencyKey}`,
      ],
    );
    if (result.rowCount !== 1)
      throw new Error(
        "This adjustment proposal was already submitted; reload to review.",
      );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: reservation.organization_id,
      campgroundId,
      actionKey: "finance.adjustment.propose",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: proposal.note,
      subjectType: "reservation.financial_adjustment",
      subjectId: result.rows[0].id,
      afterState: {
        proposalKind: proposal.kind,
        proposedCents: proposal.amount,
        currency: proposal.currency,
        posted: false,
      },
      metadata: {
        build: 196,
        independentApprovalRequired: true,
        monetaryEffect: false,
      },
    });
    await client.query("commit");
    return result.rows[0].id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function decideManualAdjustment({
  actorUserId,
  campgroundId,
  proposalId,
  decision,
  reason,
}) {
  await requireFinancePermission(actorUserId, campgroundId, "finance.manage");
  const note = String(reason ?? "").trim();
  if (
    !["approved", "rejected"].includes(decision) ||
    note.length < 8 ||
    note.length > 700
  )
    throw new Error(
      "Checker decision and an 8–700 character explanation are required.",
    );
  const client = await getPool().connect();
  try {
    await transaction(client, actorUserId);
    const result = await client.query(
      `select * from public.reservation_financial_adjustments
       where id=$1 and campground_id=$2 and evidence #>> '{build196,type}'='proposal'
       for share`,
      [proposalId, campgroundId],
    );
    if (result.rowCount !== 1)
      throw new Error("Adjustment proposal not found.");
    const proposal = result.rows[0];
    if (proposal.actor_user_id === actorUserId)
      throw new Error(
        "Maker cannot approve or reject their own adjustment proposal.",
      );
    const written = await client.query(
      `insert into public.reservation_financial_adjustments
       (organization_id,campground_id,reservation_id,adjustment_kind,financial_effect,
        amount_cents,currency_code,reason,evidence,actor_user_id,idempotency_key)
       values ($1,$2,$3,'review_resolution','none',0,$4,$5,$6::jsonb,$7,$8)
       on conflict (campground_id,idempotency_key) do nothing returning id`,
      [
        proposal.organization_id,
        campgroundId,
        proposal.reservation_id,
        proposal.currency_code,
        `Independent ${decision} review: ${note}`,
        JSON.stringify({
          build196: { type: "decision", proposalId, decision, posted: false },
        }),
        actorUserId,
        `build196-decision-${proposalId}`,
      ],
    );
    if (written.rowCount !== 1)
      throw new Error("This proposal has already been reviewed.");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: proposal.organization_id,
      campgroundId,
      actionKey: "finance.adjustment.review",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: note,
      subjectType: "reservation.financial_adjustment",
      subjectId: proposalId,
      afterState: { decision, posted: false, reviewedByDifferentUser: true },
      metadata: { build: 196, approvalIsNotPosting: true },
    });
    await client.query("commit");
    return written.rows[0].id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function settlementExpectedRows(source) {
  const expected = new Map();
  for (const payment of source.payments) {
    if (!payment.providerReference || payment.state !== "captured") continue;
    if (localDay(payment.capturedAt, source.timezone) !== source.localDate)
      continue;
    const key = JSON.stringify([
      payment.provider,
      payment.currencyCode,
      payment.providerReference,
    ]);
    if (expected.has(key)) continue;
    expected.set(key, {
      provider: payment.provider,
      providerReference: payment.providerReference,
      currencyCode: payment.currencyCode,
      capturedCents: payment.amountCents,
      refundedCents: 0,
    });
  }
  for (const refund of source.refunds) {
    if (
      refund.state !== "succeeded" ||
      !refund.originalProviderReference ||
      !refund.originalProvider ||
      localDay(refund.completedAt, source.timezone) !== source.localDate
    )
      continue;
    const key = JSON.stringify([
      refund.originalProvider,
      refund.currencyCode,
      refund.originalProviderReference,
    ]);
    const current = expected.get(key) ?? {
      provider: refund.originalProvider,
      providerReference: refund.originalProviderReference,
      currencyCode: refund.currencyCode,
      capturedCents: 0,
      refundedCents: 0,
    };
    current.refundedCents += refund.amountCents;
    expected.set(key, current);
  }
  return [...expected.values()];
}
