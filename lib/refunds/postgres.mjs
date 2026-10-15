import { randomUUID } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { dateInTimeZone } from "../booking-rules/core.mjs";
import {
  calculateCancellationRefundRecommendation,
  defaultCancellationRefundPolicy,
  normalizeRefundReason,
  refundApprovalRequirement,
  refundRemainingCents,
  validateCancellationRefundPolicyInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for refund operations.");
  }
  return value;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeRefundsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function assertAnyPermission(userId, campgroundId, permissions) {
  const allowed = await Promise.all(
    permissions.map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized for refund/financial safeguard action.");
  }
}

function isoDate(value) {
  return value == null ? null : String(value).slice(0, 10);
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function mapPolicy(row) {
  if (!row) {
    return {
      id: null,
      ...defaultCancellationRefundPolicy,
      rowVersion: 0,
      persisted: false,
    };
  }
  return {
    id: row.id,
    currencyCode: row.currency_code,
    freeCancellationDaysBeforeArrival: Number(
      row.free_cancellation_days_before_arrival,
    ),
    earlyRefundBasisPoints: Number(row.early_refund_basis_points),
    lateRefundBasisPoints: Number(row.late_refund_basis_points),
    securityDepositRefundBasisPoints: Number(
      row.security_deposit_refund_basis_points,
    ),
    cancellationFeeCents: Number(row.cancellation_fee_cents),
    approvalThresholdCents: Number(row.approval_threshold_cents),
    rowVersion: Number(row.row_version),
    persisted: true,
  };
}

function mapRefund(row) {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    originalPaymentId: row.original_payment_id,
    policyId: row.policy_id,
    requestedByUserId: row.requested_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    refundKind: row.refund_kind,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code,
    reason: row.reason,
    policySnapshot: row.policy_snapshot,
    approvalRequired: row.approval_required,
    approvalState: row.approval_state,
    refundState: row.refund_state,
    providerKey: row.provider_key,
    providerRefundReference: row.provider_refund_reference,
    idempotencyKey: row.idempotency_key,
    lastErrorCode: row.last_error_code,
    requestedAt: iso(row.requested_at),
    approvedAt: iso(row.approved_at),
    submittedAt: iso(row.submitted_at),
    completedAt: iso(row.completed_at),
    rowVersion: Number(row.row_version),
  };
}

function mapAdjustment(row) {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    refundId: row.refund_id,
    originalPaymentId: row.original_payment_id,
    adjustmentKind: row.adjustment_kind,
    financialEffect: row.financial_effect,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code,
    reason: row.reason,
    evidence: row.evidence,
    actorUserId: row.actor_user_id,
    idempotencyKey: row.idempotency_key,
    occurredAt: iso(row.occurred_at),
  };
}

async function campground(client, campgroundId) {
  const result = await client.query(
    `select id, organization_id, name, slug, timezone
     from public.campgrounds
     where id = $1
       and lifecycle_state = 'active'
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

async function effectivePolicy(client, campgroundId) {
  const result = await client.query(
    `select *
     from public.campground_cancellation_refund_policies
     where campground_id = $1
     limit 1`,
    [campgroundId],
  );
  return mapPolicy(result.rows[0] ?? null);
}

async function capturedPaymentRows(client, reservationId) {
  const result = await client.query(
    `select
       p.*,
       coalesce(sum(rf.amount_cents) filter (
         where rf.refund_state not in ('failed','rejected')
       ), 0)::bigint as reserved_refund_cents,
       coalesce(sum(rf.amount_cents) filter (
         where rf.refund_state = 'succeeded'
       ), 0)::bigint as succeeded_refund_cents
     from public.reservation_payments p
     left join public.reservation_refunds rf
       on rf.original_payment_id = p.id
     where p.reservation_id = $1
       and p.payment_state = 'captured'
     group by p.id
     order by p.captured_at asc nulls last, p.created_at asc`,
    [reservationId],
  );
  return result.rows;
}

async function reservationContext(client, campgroundId, reservationId) {
  const result = await client.query(
    `select
       r.id,
       r.organization_id,
       r.campground_id,
       r.status,
       r.arrival_date,
       r.departure_date,
       r.row_version,
       c.name as campground_name,
       c.timezone as campground_timezone,
       coalesce(ms.currency_code, ps.currency_code, 'CAD') as currency_code,
       ms.financial_review_required,
       ms.financial_review_reason,
       ms.current_total_cents
     from public.reservations r
     join public.campgrounds c on c.id = r.campground_id
     left join public.reservation_management_state ms
       on ms.reservation_id = r.id
     left join public.reservation_payment_schedules ps
       on ps.reservation_id = r.id
     where r.id = $1
       and r.campground_id = $2
     limit 1`,
    [reservationId, campgroundId],
  );
  return result.rows[0] ?? null;
}

function policySnapshot(policy, recommendation = null) {
  return {
    version: 1,
    currencyCode: policy.currencyCode,
    freeCancellationDaysBeforeArrival:
      policy.freeCancellationDaysBeforeArrival,
    earlyRefundBasisPoints: policy.earlyRefundBasisPoints,
    lateRefundBasisPoints: policy.lateRefundBasisPoints,
    securityDepositRefundBasisPoints:
      policy.securityDepositRefundBasisPoints,
    cancellationFeeCents: policy.cancellationFeeCents,
    approvalThresholdCents: policy.approvalThresholdCents,
    recommendation:
      recommendation == null
        ? null
        : {
            daysBeforeArrival: recommendation.daysBeforeArrival,
            policyWindow: recommendation.policyWindow,
            recommendedRefundCents: recommendation.recommendedRefundCents,
            retainedCents: recommendation.retainedCents,
            feeAppliedCents: recommendation.feeAppliedCents,
          },
  };
}

function recommendationFromRows(context, policy, rows, useReserved = true) {
  return calculateCancellationRefundRecommendation({
    arrivalDate: isoDate(context.arrival_date),
    asOfDate: dateInTimeZone(context.campground_timezone),
    policy,
    payments: rows.map((row) => ({
      id: row.id,
      paymentPurpose: row.payment_purpose,
      amountCents: Number(row.amount_cents),
      refundedCents: Number(
        useReserved ? row.reserved_refund_cents : row.succeeded_refund_cents,
      ),
    })),
  });
}

export async function getCampgroundCancellationRefundPolicy({
  userId,
  campgroundId,
}) {
  await assertAnyPermission(userId, campgroundId, [
    "finance.read",
    "finance.manage",
    "refund.issue",
    "campground.configuration",
  ]);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const scope = await campground(client, campgroundId);
    const policy = await effectivePolicy(client, campgroundId);
    await client.query("commit");
    return {
      campground: {
        id: scope.id,
        name: scope.name,
        slug: scope.slug,
        timezone: scope.timezone,
      },
      policy,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveCampgroundCancellationRefundPolicy({
  actorUserId,
  campgroundId,
  expectedRowVersion,
  ...input
}) {
  await assertAnyPermission(actorUserId, campgroundId, [
    "finance.manage",
    "campground.configuration",
  ]);
  const policy = validateCancellationRefundPolicyInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("Refund policy row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const scope = await campground(client, campgroundId);
    const existing = await client.query(
      `select *
       from public.campground_cancellation_refund_policies
       where campground_id = $1
       limit 1
       for update`,
      [campgroundId],
    );
    const before = existing.rows[0] ?? null;
    let saved;

    if (before) {
      if (Number(before.row_version) !== expected) {
        throw new Error(
          "Refund policy changed since this page loaded. Refresh and try again.",
        );
      }
      const result = await client.query(
        `update public.campground_cancellation_refund_policies
         set currency_code = $3,
             free_cancellation_days_before_arrival = $4,
             early_refund_basis_points = $5,
             late_refund_basis_points = $6,
             security_deposit_refund_basis_points = $7,
             cancellation_fee_cents = $8,
             approval_threshold_cents = $9,
             updated_by_user_id = $10
         where campground_id = $1
           and organization_id = $2
           and row_version = $11
         returning *`,
        [
          campgroundId,
          scope.organization_id,
          policy.currencyCode,
          policy.freeCancellationDaysBeforeArrival,
          policy.earlyRefundBasisPoints,
          policy.lateRefundBasisPoints,
          policy.securityDepositRefundBasisPoints,
          policy.cancellationFeeCents,
          policy.approvalThresholdCents,
          actorUserId,
          expected,
        ],
      );
      if (result.rowCount !== 1) {
        throw new Error(
          "Refund policy changed since this page loaded. Refresh and try again.",
        );
      }
      saved = result.rows[0];
    } else {
      if (expected !== 0) {
        throw new Error(
          "Refund policy changed since this page loaded. Refresh and try again.",
        );
      }
      const result = await client.query(
        `insert into public.campground_cancellation_refund_policies (
           organization_id,
           campground_id,
           currency_code,
           free_cancellation_days_before_arrival,
           early_refund_basis_points,
           late_refund_basis_points,
           security_deposit_refund_basis_points,
           cancellation_fee_cents,
           approval_threshold_cents,
           updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning *`,
        [
          scope.organization_id,
          campgroundId,
          policy.currencyCode,
          policy.freeCancellationDaysBeforeArrival,
          policy.earlyRefundBasisPoints,
          policy.lateRefundBasisPoints,
          policy.securityDepositRefundBasisPoints,
          policy.cancellationFeeCents,
          policy.approvalThresholdCents,
          actorUserId,
        ],
      );
      saved = result.rows[0];
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: "campground.refund_policy.save",
      permissionKey: "finance.manage",
      riskLevel: "elevated",
      subjectType: "campground.refund_policy",
      subjectId: saved.id,
      beforeState: before ? mapPolicy(before) : null,
      afterState: mapPolicy(saved),
      metadata: {
        paymentCredentialsExcluded: true,
        providerSecretsExcluded: true,
      },
    });
    await client.query("commit");
    return mapPolicy(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getReservationFinancialSafeguards({
  userId,
  campgroundId,
  reservationId,
}) {
  await assertAnyPermission(userId, campgroundId, [
    "payment.read",
    "refund.issue",
    "finance.read",
    "finance.manage",
  ]);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const context = await reservationContext(
      client,
      campgroundId,
      reservationId,
    );
    if (!context) {
      await client.query("commit");
      return null;
    }
    const policy = await effectivePolicy(client, campgroundId);
    const paymentRows = await capturedPaymentRows(client, reservationId);
    const recommendation = recommendationFromRows(
      context,
      policy,
      paymentRows,
      true,
    );
    const [refunds, adjustments] = await Promise.all([
      client.query(
        `select *
         from public.reservation_refunds
         where reservation_id = $1
         order by requested_at desc`,
        [reservationId],
      ),
      client.query(
        `select *
         from public.reservation_financial_adjustments
         where reservation_id = $1
         order by occurred_at desc`,
        [reservationId],
      ),
    ]);
    await client.query("commit");

    return {
      reservation: {
        id: context.id,
        status: context.status,
        arrivalDate: isoDate(context.arrival_date),
        departureDate: isoDate(context.departure_date),
        currencyCode: context.currency_code,
        financialReviewRequired:
          context.financial_review_required === true,
        financialReviewReason: context.financial_review_reason,
        currentTotalCents:
          context.current_total_cents == null
            ? null
            : Number(context.current_total_cents),
      },
      policy,
      recommendation,
      payments: paymentRows.map((row) => ({
        id: row.id,
        paymentPurpose: row.payment_purpose,
        amountCents: Number(row.amount_cents),
        currencyCode: row.currency_code,
        providerKey: row.provider_key,
        providerPaymentReference: row.provider_payment_reference,
        capturedAt: iso(row.captured_at),
        reservedRefundCents: Number(row.reserved_refund_cents),
        succeededRefundCents: Number(row.succeeded_refund_cents),
        remainingRefundableCents: refundRemainingCents({
          capturedCents: Number(row.amount_cents),
          reservedOrRefundedCents: Number(row.reserved_refund_cents),
        }),
        policyRecommendedCents:
          recommendation.allocations.find(
            (item) => item.paymentId === row.id,
          )?.recommendedCents ?? 0,
      })),
      refunds: refunds.rows.map(mapRefund),
      adjustments: adjustments.rows.map(mapAdjustment),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function requestReservationRefund({
  actorUserId,
  campgroundId,
  reservationId,
  originalPaymentId,
  amountCents,
  refundKind = "partial",
  reason,
  providerKey,
  idempotencyKey = randomUUID(),
}) {
  await assertAnyPermission(actorUserId, campgroundId, ["refund.issue"]);
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 1 || amount > 200000000) {
    throw new Error("Refund amount is invalid.");
  }
  if (!["partial", "full", "cancellation"].includes(refundKind)) {
    throw new Error("Refund kind is invalid.");
  }
  const normalizedReason = normalizeRefundReason(reason);
  const provider = String(providerKey ?? "mock")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(provider)) {
    throw new Error("Refund provider key is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-refund:" + reservationId],
    );
    const context = await reservationContext(
      client,
      campgroundId,
      reservationId,
    );
    if (!context) {
      throw new Error("Reservation was not found.");
    }
    if (refundKind === "cancellation" && context.status !== "cancelled") {
      throw new Error("Cancellation refund requires a cancelled reservation.");
    }

    const policy = await effectivePolicy(client, campgroundId);
    const rows = await capturedPaymentRows(client, reservationId);
    const payment = rows.find((row) => row.id === originalPaymentId);
    if (!payment) {
      throw new Error("Captured original payment was not found.");
    }
    if (!payment.provider_payment_reference) {
      throw new Error("Original payment is missing its provider reference.");
    }

    const remaining = refundRemainingCents({
      capturedCents: Number(payment.amount_cents),
      reservedOrRefundedCents: Number(payment.reserved_refund_cents),
    });
    if (amount > remaining) {
      throw new Error("Refund exceeds the unrefunded captured payment amount.");
    }
    if (refundKind === "full" && amount !== remaining) {
      throw new Error("Full refund must equal the entire remaining captured payment.");
    }
    if (policy.currencyCode !== payment.currency_code) {
      throw new Error("Refund policy currency does not match the original payment.");
    }

    const recommendation = recommendationFromRows(
      context,
      policy,
      rows,
      true,
    );
    const allocation = recommendation.allocations.find(
      (item) => item.paymentId === payment.id,
    );
    const policyRecommendedCents =
      context.status === "cancelled"
        ? allocation?.recommendedCents ?? 0
        : amount;
    const approval = refundApprovalRequirement({
      amountCents: amount,
      approvalThresholdCents: policy.approvalThresholdCents,
      policyRecommendedCents,
    });

    const inserted = await client.query(
      `insert into public.reservation_refunds (
         organization_id,
         campground_id,
         reservation_id,
         original_payment_id,
         policy_id,
         requested_by_user_id,
         refund_kind,
         amount_cents,
         currency_code,
         reason,
         policy_snapshot,
         approval_required,
         approval_state,
         refund_state,
         provider_key,
         idempotency_key
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16
       )
       on conflict (campground_id, idempotency_key)
       do update set id = public.reservation_refunds.id
       returning *`,
      [
        context.organization_id,
        campgroundId,
        reservationId,
        payment.id,
        policy.id,
        actorUserId,
        refundKind,
        amount,
        payment.currency_code,
        normalizedReason,
        JSON.stringify(policySnapshot(policy, recommendation)),
        approval.approvalRequired,
        approval.approvalRequired ? "pending" : "not_required",
        approval.approvalRequired ? "pending_approval" : "approved",
        provider,
        idempotencyKey,
      ],
    );

    const row = inserted.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: context.organization_id,
      campgroundId,
      actionKey: "reservation.refund.request",
      permissionKey: "refund.issue",
      riskLevel: "high",
      reason: normalizedReason,
      subjectType: "reservation.refund",
      subjectId: row.id,
      afterState: {
        reservationId,
        originalPaymentId: payment.id,
        amountCents: amount,
        currencyCode: payment.currency_code,
        approvalRequired: row.approval_required,
        approvalState: row.approval_state,
        refundState: row.refund_state,
      },
      metadata: {
        rawPaymentCredentialsExcluded: true,
        providerSecretsExcluded: true,
      },
    });
    await client.query("commit");
    return mapRefund(row);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function approveReservationRefund({
  actorUserId,
  campgroundId,
  refundId,
  reason,
}) {
  await assertAnyPermission(actorUserId, campgroundId, ["finance.manage"]);
  const normalizedReason = normalizeRefundReason(reason);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const locked = await client.query(
      `select *
       from public.reservation_refunds
       where id = $1
         and campground_id = $2
       limit 1
       for update`,
      [refundId, campgroundId],
    );
    if (locked.rowCount !== 1) {
      throw new Error("Refund request was not found.");
    }
    const before = locked.rows[0];
    if (!before.approval_required || before.approval_state !== "pending") {
      throw new Error("Refund is not awaiting approval.");
    }
    if (before.requested_by_user_id === actorUserId) {
      throw new Error("Refund requester cannot approve their own refund.");
    }

    const result = await client.query(
      `update public.reservation_refunds
       set approved_by_user_id = $2,
           approval_state = 'approved',
           refund_state = 'approved',
           approved_at = statement_timestamp()
       where id = $1
       returning *`,
      [refundId, actorUserId],
    );
    const row = result.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.refund.approve",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: normalizedReason,
      subjectType: "reservation.refund",
      subjectId: refundId,
      beforeState: {
        approvalState: before.approval_state,
        refundState: before.refund_state,
      },
      afterState: {
        approvalState: row.approval_state,
        refundState: row.refund_state,
      },
      metadata: {
        requesterApproverSeparated: true,
      },
    });
    await client.query("commit");
    return mapRefund(row);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectReservationRefund({
  actorUserId,
  campgroundId,
  refundId,
  reason,
}) {
  await assertAnyPermission(actorUserId, campgroundId, ["finance.manage"]);
  const normalizedReason = normalizeRefundReason(reason);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const result = await client.query(
      `update public.reservation_refunds
       set approved_by_user_id = $2,
           approval_state = 'rejected',
           refund_state = 'rejected',
           completed_at = statement_timestamp(),
           last_error_code = 'approval_rejected'
       where id = $1
         and campground_id = $3
         and approval_state = 'pending'
         and requested_by_user_id <> $2
       returning *`,
      [refundId, actorUserId, campgroundId],
    );
    if (result.rowCount !== 1) {
      throw new Error(
        "Refund is not awaiting approval or requester/approver separation failed.",
      );
    }
    const row = result.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.refund.reject",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: normalizedReason,
      subjectType: "reservation.refund",
      subjectId: refundId,
      afterState: {
        approvalState: row.approval_state,
        refundState: row.refund_state,
      },
    });
    await client.query("commit");
    return mapRefund(row);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function maybeResolveCancelledReview(client, refundRow, actorUserId) {
  const context = await reservationContext(
    client,
    refundRow.campground_id,
    refundRow.reservation_id,
  );
  if (!context || context.status !== "cancelled") return false;

  const policy = await effectivePolicy(client, refundRow.campground_id);
  const rows = await capturedPaymentRows(client, refundRow.reservation_id);
  const recommendation = recommendationFromRows(
    context,
    policy,
    rows,
    false,
  );
  if (recommendation.recommendedRefundCents > 0) return false;

  const pending = await client.query(
    `select count(*)::integer as count
     from public.reservation_refunds
     where reservation_id = $1
       and refund_state in ('pending_approval','approved','submitted')`,
    [refundRow.reservation_id],
  );
  if (Number(pending.rows[0].count) > 0) return false;

  const result = await client.query(
    `update public.reservation_management_state
     set financial_review_required = false,
         financial_review_reason = null,
         updated_by_user_id = $2
     where reservation_id = $1
       and financial_review_required
     returning id`,
    [refundRow.reservation_id, actorUserId],
  );
  return result.rowCount === 1;
}

export async function executeReservationRefund({
  actorUserId,
  campgroundId,
  refundId,
  provider,
}) {
  await assertAnyPermission(actorUserId, campgroundId, ["refund.issue"]);
  if (!provider || typeof provider.refundPayment !== "function") {
    throw new Error("Refund provider adapter is required.");
  }

  const client = await getPool().connect();
  let refund;
  let payment;
  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-refund-execute:" + refundId],
    );
    const result = await client.query(
      `select rf.*, p.provider_payment_reference,
              p.payment_state, p.amount_cents as original_amount_cents,
              p.currency_code as original_currency_code
       from public.reservation_refunds rf
       join public.reservation_payments p
         on p.id = rf.original_payment_id
       where rf.id = $1
         and rf.campground_id = $2
       limit 1
       for update of rf`,
      [refundId, campgroundId],
    );
    if (result.rowCount !== 1) {
      throw new Error("Refund request was not found.");
    }
    refund = result.rows[0];
    payment = result.rows[0];
    if (refund.refund_state === "succeeded") {
      await client.query("commit");
      return { refund: mapRefund(refund), duplicate: true };
    }
    if (refund.refund_state !== "approved") {
      throw new Error("Refund must be approved before provider execution.");
    }
    if (payment.payment_state !== "captured") {
      throw new Error("Original payment is not captured.");
    }
    if (!payment.provider_payment_reference) {
      throw new Error("Original payment provider reference is missing.");
    }

    const updated = await client.query(
      `update public.reservation_refunds
       set refund_state = 'submitted',
           submitted_at = statement_timestamp(),
           last_error_code = null
       where id = $1
       returning *`,
      [refundId],
    );
    refund = updated.rows[0];
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  let event;
  try {
    event = await provider.refundPayment({
      refundId: refund.id,
      originalPaymentReference: payment.provider_payment_reference,
      amountCents: Number(refund.amount_cents),
      currencyCode: refund.currency_code,
      idempotencyKey: refund.idempotency_key,
    });
  } catch (error) {
    await getPool().query(
      `update public.reservation_refunds
       set refund_state = 'failed',
           last_error_code = 'provider_refund_failed',
           completed_at = statement_timestamp()
       where id = $1
         and refund_state = 'submitted'`,
      [refund.id],
    );
    throw error;
  }

  const trusted = await getPool().connect();
  try {
    await trusted.query("begin");
    const current = await trusted.query(
      `select *
       from public.reservation_refunds
       where id = $1
       limit 1
       for update`,
      [refund.id],
    );
    const row = current.rows[0];
    if (!row) throw new Error("Refund disappeared during provider execution.");
    if (row.refund_state === "succeeded") {
      await trusted.query("commit");
      return { refund: mapRefund(row), duplicate: true };
    }

    const eventInsert = await trusted.query(
      `insert into icamp_private.refund_provider_events (
         provider_key,
         provider_event_id,
         refund_id,
         event_type,
         event_status,
         metadata,
         occurred_at
       )
       values ($1,$2,$3,$4,$5,$6::jsonb,$7)
       on conflict (provider_key, provider_event_id) do nothing
       returning id`,
      [
        event.providerKey,
        event.providerEventId,
        refund.id,
        event.eventType,
        event.eventStatus,
        JSON.stringify({
          sandbox: event.sandbox === true,
          amountCents: Number(event.amountCents),
          currencyCode: event.currencyCode,
          rawProviderPayloadExcluded: true,
          paymentCredentialsExcluded: true,
        }),
        event.occurredAt,
      ],
    );

    if (
      Number(row.amount_cents) !== Number(event.amountCents) ||
      row.currency_code !== event.currencyCode
    ) {
      throw new Error("Refund provider event amount does not match request.");
    }

    const updated = await trusted.query(
      `update public.reservation_refunds
       set refund_state = 'succeeded',
           provider_refund_reference = $2,
           completed_at = coalesce(completed_at, $3::timestamptz),
           last_error_code = null
       where id = $1
       returning *`,
      [refund.id, event.providerRefundReference, event.occurredAt],
    );

    if (eventInsert.rowCount === 1) {
      await trusted.query(
        `insert into public.reservation_financial_adjustments (
           organization_id,
           campground_id,
           reservation_id,
           refund_id,
           original_payment_id,
           adjustment_kind,
           financial_effect,
           amount_cents,
           currency_code,
           reason,
           evidence,
           actor_user_id,
           idempotency_key
         )
         values (
           $1,$2,$3,$4,$5,'refund','customer_credit',$6,$7,$8,$9::jsonb,$10,$11
         )
         on conflict (campground_id, idempotency_key) do nothing`,
        [
          row.organization_id,
          row.campground_id,
          row.reservation_id,
          row.id,
          row.original_payment_id,
          Number(row.amount_cents),
          row.currency_code,
          row.reason,
          JSON.stringify({
            providerKey: event.providerKey,
            providerRefundReference: event.providerRefundReference,
            originalPaymentLinked: true,
            rawPaymentCredentialsExcluded: true,
          }),
          actorUserId,
          "refund-adjustment:" + row.id,
        ],
      );
    }

    await maybeResolveCancelledReview(trusted, updated.rows[0], actorUserId);
    await appendAuditEvent(trusted, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.refund.execute",
      permissionKey: "refund.issue",
      riskLevel: "high",
      reason: row.reason,
      subjectType: "reservation.refund",
      subjectId: row.id,
      afterState: {
        refundState: "succeeded",
        amountCents: Number(row.amount_cents),
        currencyCode: row.currency_code,
        originalPaymentId: row.original_payment_id,
      },
      metadata: {
        providerKey: event.providerKey,
        originalPaymentLinked: true,
        rawPaymentCredentialsExcluded: true,
      },
    });
    await trusted.query("commit");
    return { refund: mapRefund(updated.rows[0]), duplicate: false };
  } catch (error) {
    await trusted.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    trusted.release();
  }
}

export async function recordReservationFinancialAdjustment({
  actorUserId,
  campgroundId,
  reservationId,
  adjustmentKind,
  financialEffect,
  amountCents,
  currencyCode,
  reason,
  idempotencyKey = randomUUID(),
}) {
  await assertAnyPermission(actorUserId, campgroundId, ["finance.manage"]);
  if (!["credit", "charge", "forfeit", "writeoff"].includes(adjustmentKind)) {
    throw new Error("Financial adjustment kind is invalid.");
  }
  if (
    !["customer_credit", "customer_debit", "retained", "none"].includes(
      financialEffect,
    )
  ) {
    throw new Error("Financial effect is invalid.");
  }
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 1 || amount > 200000000) {
    throw new Error("Financial adjustment amount is invalid.");
  }
  const currency = String(currencyCode ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) {
    throw new Error("Financial adjustment currency is invalid.");
  }
  const normalizedReason = normalizeRefundReason(reason);

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const context = await reservationContext(
      client,
      campgroundId,
      reservationId,
    );
    if (!context) throw new Error("Reservation was not found.");
    if (currency !== context.currency_code) {
      throw new Error("Financial adjustment currency does not match reservation.");
    }

    const result = await client.query(
      `insert into public.reservation_financial_adjustments (
         organization_id,
         campground_id,
         reservation_id,
         adjustment_kind,
         financial_effect,
         amount_cents,
         currency_code,
         reason,
         evidence,
         actor_user_id,
         idempotency_key
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       on conflict (campground_id, idempotency_key)
       do update set id = public.reservation_financial_adjustments.id
       returning *`,
      [
        context.organization_id,
        campgroundId,
        reservationId,
        adjustmentKind,
        financialEffect,
        amount,
        currency,
        normalizedReason,
        JSON.stringify({
          build044FinancialReviewPreserved: true,
          originalPaymentEvidenceUnchanged: true,
        }),
        actorUserId,
        idempotencyKey,
      ],
    );
    const row = result.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: context.organization_id,
      campgroundId,
      actionKey: "reservation.financial_adjustment.record",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: normalizedReason,
      subjectType: "reservation.financial_adjustment",
      subjectId: row.id,
      afterState: {
        adjustmentKind,
        financialEffect,
        amountCents: amount,
        currencyCode: currency,
      },
      metadata: {
        appendOnly: true,
        originalEvidencePreserved: true,
      },
    });
    await client.query("commit");
    return mapAdjustment(row);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCancellationForfeit({
  actorUserId,
  campgroundId,
  reservationId,
  reason,
  idempotencyKey = randomUUID(),
}) {
  await assertAnyPermission(actorUserId, campgroundId, ["finance.manage"]);
  const normalizedReason = normalizeRefundReason(reason);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-cancellation-forfeit:" + reservationId],
    );
    const context = await reservationContext(
      client,
      campgroundId,
      reservationId,
    );
    if (!context || context.status !== "cancelled") {
      throw new Error("Cancellation forfeit requires a cancelled reservation.");
    }
    const policy = await effectivePolicy(client, campgroundId);
    const rows = await capturedPaymentRows(client, reservationId);
    const recommendation = recommendationFromRows(
      context,
      policy,
      rows,
      false,
    );
    if (recommendation.recommendedRefundCents > 0) {
      throw new Error(
        "Policy still recommends a refund; refund or approve an override instead.",
      );
    }
    const pending = await client.query(
      `select count(*)::integer as count
       from public.reservation_refunds
       where reservation_id = $1
         and refund_state in ('pending_approval','approved','submitted')`,
      [reservationId],
    );
    if (Number(pending.rows[0].count) > 0) {
      throw new Error("Pending refund work must be completed first.");
    }

    const amount = recommendation.capturedRemainingCents;
    if (amount > 0) {
      await client.query(
        `insert into public.reservation_financial_adjustments (
           organization_id,
           campground_id,
           reservation_id,
           adjustment_kind,
           financial_effect,
           amount_cents,
           currency_code,
           reason,
           evidence,
           actor_user_id,
           idempotency_key
         )
         values ($1,$2,$3,'forfeit','retained',$4,$5,$6,$7::jsonb,$8,$9)
         on conflict (campground_id, idempotency_key) do nothing`,
        [
          context.organization_id,
          campgroundId,
          reservationId,
          amount,
          context.currency_code,
          normalizedReason,
          JSON.stringify({
            policySnapshot: policySnapshot(policy, recommendation),
            policyRefundDueCents: 0,
          }),
          actorUserId,
          idempotencyKey,
        ],
      );
    }

    await client.query("reset role");
    await client.query(
      `update public.reservation_management_state
       set financial_review_required = false,
           financial_review_reason = null,
           updated_by_user_id = $2
       where reservation_id = $1
         and financial_review_required`,
      [reservationId, actorUserId],
    );
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: context.organization_id,
      campgroundId,
      actionKey: "reservation.cancellation_forfeit.record",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: normalizedReason,
      subjectType: "reservation",
      subjectId: reservationId,
      afterState: {
        retainedCents: amount,
        currencyCode: context.currency_code,
        financialReviewRequired: false,
      },
      metadata: {
        cancellationPolicyApplied: true,
        originalPaymentEvidencePreserved: true,
      },
    });
    await client.query("commit");
    return {
      retainedCents: amount,
      currencyCode: context.currency_code,
      financialReviewRequired: false,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
