import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { dateInTimeZone } from "../booking-rules/core.mjs";
import {
  calculatePaymentProgress,
  calculateReservationPaymentSchedule,
  defaultPaymentPolicy,
  validatePaymentPolicyInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for payment operations.");
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

export async function closePaymentsPoolForTests() {
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

async function assertCanManagePolicy(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "campground.configuration",
    ))
  ) {
    throw new Error("Not authorized to manage campground payment policy.");
  }
}

function mapPolicy(row) {
  if (!row) {
    return {
      ...defaultPaymentPolicy,
      rowVersion: 0,
      persisted: false,
      id: null,
    };
  }

  return {
    id: row.id,
    depositMode: row.deposit_mode,
    depositFixedCents:
      row.deposit_fixed_cents == null ? null : Number(row.deposit_fixed_cents),
    depositPercentageBasisPoints:
      row.deposit_percentage_basis_points == null
        ? null
        : Number(row.deposit_percentage_basis_points),
    securityDepositCents: Number(row.security_deposit_cents),
    securityDepositDueStage: row.security_deposit_due_stage,
    balanceDueMode: row.balance_due_mode,
    balanceDueDaysBeforeArrival:
      row.balance_due_days_before_arrival == null
        ? null
        : Number(row.balance_due_days_before_arrival),
    currencyCode: row.currency_code,
    rowVersion: Number(row.row_version),
    persisted: true,
  };
}

function mapSchedule(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    reservationId: row.reservation_id,
    guestUserId: row.guest_user_id,
    paymentPolicyId: row.payment_policy_id,
    policySnapshot: row.policy_snapshot,
    bookingDate: String(row.booking_date).slice(0, 10),
    arrivalDate: String(row.arrival_date).slice(0, 10),
    currencyCode: row.currency_code,
    reservationTotalCents: Number(row.reservation_total_cents),
    bookingDepositCents: Number(row.booking_deposit_cents),
    reservationBalanceCents: Number(row.reservation_balance_cents),
    securityDepositCents: Number(row.security_deposit_cents),
    securityDepositDueStage: row.security_deposit_due_stage,
    balanceDueMode: row.balance_due_mode,
    balanceDueDate: String(row.balance_due_date).slice(0, 10),
    bookingDueCents: Number(row.booking_due_cents),
    totalPayableCents: Number(row.total_payable_cents),
    createdAt: row.created_at,
  };
}

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    reservationId: row.reservation_id,
    paymentScheduleId: row.payment_schedule_id,
    providerKey: row.provider_key,
    providerPaymentReference: row.provider_payment_reference,
    paymentPurpose: row.payment_purpose,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code,
    state: row.payment_state,
    authorizedAt: row.authorized_at,
    capturedAt: row.captured_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
  };
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select id, organization_id, name, timezone
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

export async function getCampgroundPaymentPolicy(userId, campgroundId) {
  await assertCanManagePolicy(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const campground = await campgroundScope(client, campgroundId);
    const result = await client.query(
      `select *
       from public.campground_payment_policies
       where campground_id = $1
       limit 1`,
      [campgroundId],
    );
    await client.query("commit");
    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      policy: mapPolicy(result.rows[0] ?? null),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveCampgroundPaymentPolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  ...input
}) {
  await assertCanManagePolicy(actorUserId, campgroundId);
  const policy = validatePaymentPolicyInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("Payment policy row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const existing = await client.query(
      `select *
       from public.campground_payment_policies
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
          "Payment policy changed since this page loaded. Refresh and try again.",
        );
      }
      const updated = await client.query(
        `update public.campground_payment_policies
         set deposit_mode = $3,
             deposit_fixed_cents = $4,
             deposit_percentage_basis_points = $5,
             security_deposit_cents = $6,
             security_deposit_due_stage = $7,
             balance_due_mode = $8,
             balance_due_days_before_arrival = $9,
             currency_code = $10,
             updated_by_user_id = $11
         where campground_id = $1
           and organization_id = $2
           and row_version = $12
         returning *`,
        [
          campgroundId,
          campground.organization_id,
          policy.depositMode,
          policy.depositFixedCents,
          policy.depositPercentageBasisPoints,
          policy.securityDepositCents,
          policy.securityDepositDueStage,
          policy.balanceDueMode,
          policy.balanceDueDaysBeforeArrival,
          policy.currencyCode,
          actorUserId,
          expected,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Payment policy changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
    } else {
      if (expected !== 0) {
        throw new Error(
          "Payment policy changed since this page loaded. Refresh and try again.",
        );
      }
      const inserted = await client.query(
        `insert into public.campground_payment_policies (
           organization_id,
           campground_id,
           deposit_mode,
           deposit_fixed_cents,
           deposit_percentage_basis_points,
           security_deposit_cents,
           security_deposit_due_stage,
           balance_due_mode,
           balance_due_days_before_arrival,
           currency_code,
           updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning *`,
        [
          campground.organization_id,
          campgroundId,
          policy.depositMode,
          policy.depositFixedCents,
          policy.depositPercentageBasisPoints,
          policy.securityDepositCents,
          policy.securityDepositDueStage,
          policy.balanceDueMode,
          policy.balanceDueDaysBeforeArrival,
          policy.currencyCode,
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.payment_policy.save",
      permissionKey: "campground.configuration",
      riskLevel: "elevated",
      subjectType: "campground.payment_policy",
      subjectId: saved.id,
      beforeState: before ? mapPolicy(before) : null,
      afterState: mapPolicy(saved),
      metadata: {
        providerCredentialsExcluded: true,
        rawCardDataExcluded: true,
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

async function reservationContext(client, userId, reservationId, lock = false) {
  const result = await client.query(
    `select
       r.id,
       r.organization_id,
       r.campground_id,
       r.arrival_date,
       r.status,
       r.guest_user_id,
       c.name as campground_name,
       c.slug as campground_slug,
       c.timezone as campground_timezone,
       d.currency_code,
       d.quoted_total_cents,
       a.code as accommodation_code,
       a.display_name as accommodation_name
     from public.reservations r
     join public.reservation_checkout_details d
       on d.reservation_id = r.id
      and d.guest_user_id = r.guest_user_id
     join public.campgrounds c on c.id = r.campground_id
     join public.accommodations a on a.id = r.accommodation_id
     where r.id = $1
       and r.guest_user_id = $2
     limit 1
     ${lock ? "for update of r" : ""}`,
    [reservationId, userId],
  );
  return result.rows[0] ?? null;
}

async function ensureScheduleWithClient(client, userId, reservationId) {
  const context = await reservationContext(client, userId, reservationId, true);
  if (!context) {
    return null;
  }

  const existing = await client.query(
    `select *
     from public.reservation_payment_schedules
     where reservation_id = $1
       and guest_user_id = $2
     limit 1`,
    [reservationId, userId],
  );
  if (existing.rowCount === 1) {
    return {
      context,
      schedule: mapSchedule(existing.rows[0]),
    };
  }

  const policyResult = await client.query(
    `select *
     from public.campground_payment_policies
     where campground_id = $1
     limit 1`,
    [context.campground_id],
  );
  const policyRow = policyResult.rows[0] ?? null;
  const policy = policyRow
    ? mapPolicy(policyRow)
    : {
        ...defaultPaymentPolicy,
        currencyCode: context.currency_code,
        rowVersion: 0,
        persisted: false,
        id: null,
      };

  const schedule = calculateReservationPaymentSchedule({
    totalCents: Number(context.quoted_total_cents),
    currencyCode: context.currency_code,
    arrivalDate: String(context.arrival_date).slice(0, 10),
    bookingDate: dateInTimeZone(context.campground_timezone),
    policy,
  });

  await client.query(
    `insert into public.reservation_payment_schedules (
       organization_id,
       campground_id,
       reservation_id,
       guest_user_id,
       payment_policy_id,
       policy_snapshot,
       booking_date,
       arrival_date,
       currency_code,
       reservation_total_cents,
       booking_deposit_cents,
       reservation_balance_cents,
       security_deposit_cents,
       security_deposit_due_stage,
       balance_due_mode,
       balance_due_date,
       booking_due_cents,
       total_payable_cents
     )
     values (
       $1,$2,$3,$4,$5,$6::jsonb,$7::date,$8::date,$9,$10,$11,$12,$13,$14,$15,
       $16::date,$17,$18
     )
     on conflict (reservation_id) do nothing`,
    [
      context.organization_id,
      context.campground_id,
      reservationId,
      userId,
      policy.id,
      JSON.stringify(policy),
      schedule.bookingDate,
      schedule.arrivalDate,
      schedule.currencyCode,
      schedule.reservationTotalCents,
      schedule.bookingDepositCents,
      schedule.reservationBalanceCents,
      schedule.securityDepositCents,
      schedule.securityDepositDueStage,
      schedule.balanceDueMode,
      schedule.balanceDueDate,
      schedule.bookingDueCents,
      schedule.totalPayableCents,
    ],
  );

  const inserted = await client.query(
    `select *
     from public.reservation_payment_schedules
     where reservation_id = $1
       and guest_user_id = $2
     limit 1`,
    [reservationId, userId],
  );

  return {
    context,
    schedule: mapSchedule(inserted.rows[0]),
  };
}

export async function ensureReservationPaymentSchedule({
  userId,
  reservationId,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await ensureScheduleWithClient(
      client,
      userId,
      reservationId,
    );
    await client.query("commit");
    return result?.schedule ?? null;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getReservationPaymentSummary({ userId, reservationId }) {
  const schedule = await ensureReservationPaymentSchedule({
    userId,
    reservationId,
  });
  if (!schedule) return null;

  const result = await getPool().query(
    `select
       r.status,
       c.name as campground_name,
       c.slug as campground_slug,
       c.timezone as campground_timezone,
       a.code as accommodation_code,
       a.display_name as accommodation_name,
       coalesce(sum(p.amount_cents) filter (
         where p.payment_state = 'captured'
       ), 0)::bigint as captured_cents
     from public.reservations r
     join public.campgrounds c on c.id = r.campground_id
     join public.accommodations a on a.id = r.accommodation_id
     left join public.reservation_payments p
       on p.reservation_id = r.id
     where r.id = $1
       and r.guest_user_id = $2
     group by
       r.status,
       c.name,
       c.slug,
       c.timezone,
       a.code,
       a.display_name`,
    [reservationId, userId],
  );
  if (result.rowCount !== 1) return null;

  const row = result.rows[0];
  const progress = calculatePaymentProgress({
    schedule,
    capturedCents: Number(row.captured_cents),
    asOfDate: dateInTimeZone(row.campground_timezone),
  });

  const payments = await getPool().query(
    `select *
     from public.reservation_payments
     where reservation_id = $1
       and guest_user_id = $2
     order by created_at desc`,
    [reservationId, userId],
  );

  return {
    reservation: {
      id: reservationId,
      status: row.status,
      campgroundName: row.campground_name,
      campgroundSlug: row.campground_slug,
      accommodationCode: row.accommodation_code,
      accommodationName: row.accommodation_name,
    },
    schedule,
    progress,
    payments: payments.rows.map(mapPayment),
  };
}

function paymentPurpose(schedule, progress) {
  if (progress.capturedCents < schedule.bookingDepositCents) {
    return "booking_due";
  }

  const balanceThreshold =
    schedule.bookingDepositCents + schedule.reservationBalanceCents;

  if (
    schedule.reservationBalanceCents > 0 &&
    progress.dueToDateCents >= balanceThreshold &&
    progress.capturedCents < balanceThreshold
  ) {
    return "balance";
  }

  return "security_deposit";
}

export async function startReservationPayment({
  userId,
  reservationId,
  provider,
}) {
  if (
    !provider ||
    typeof provider.createPayment !== "function" ||
    typeof provider.capturePayment !== "function"
  ) {
    throw new Error("Payment provider adapter is required.");
  }

  const client = await getPool().connect();
  let payment;

  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-payment:" + reservationId],
    );
    const ensured = await ensureScheduleWithClient(
      client,
      userId,
      reservationId,
    );
    if (!ensured) {
      await client.query("commit");
      return null;
    }

    const { context, schedule } = ensured;
    const capturedResult = await client.query(
      `select coalesce(sum(amount_cents), 0)::bigint as captured_cents
       from public.reservation_payments
       where reservation_id = $1
         and payment_state = 'captured'`,
      [reservationId],
    );
    const progress = calculatePaymentProgress({
      schedule,
      capturedCents: Number(capturedResult.rows[0].captured_cents),
      asOfDate: dateInTimeZone(context.campground_timezone),
    });

    if (progress.dueNowCents <= 0) {
      await client.query("commit");
      return {
        payment: null,
        alreadySatisfied: true,
      };
    }

    const active = await client.query(
      `select *
       from public.reservation_payments
       where reservation_id = $1
         and payment_state in ('created','submitted','authorized')
       order by created_at desc
       limit 1
       for update`,
      [reservationId],
    );
    if (active.rowCount === 1) {
      await client.query("commit");
      return {
        payment: mapPayment(active.rows[0]),
        alreadySatisfied: false,
        active: true,
      };
    }

    const count = await client.query(
      `select count(*)::integer as count
       from public.reservation_payments
       where reservation_id = $1`,
      [reservationId],
    );
    const attempt = Number(count.rows[0].count) + 1;
    const idempotencyKey =
      "reservation:" +
      reservationId +
      ":due:" +
      progress.dueToDateCents +
      ":attempt:" +
      attempt;

    const inserted = await client.query(
      `insert into public.reservation_payments (
         organization_id,
         campground_id,
         reservation_id,
         payment_schedule_id,
         guest_user_id,
         provider_key,
         idempotency_key,
         payment_purpose,
         amount_cents,
         currency_code
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [
        context.organization_id,
        context.campground_id,
        reservationId,
        schedule.id,
        userId,
        provider.providerKey,
        idempotencyKey,
        paymentPurpose(schedule, progress),
        progress.dueNowCents,
        schedule.currencyCode,
      ],
    );
    payment = mapPayment(inserted.rows[0]);
    payment.idempotencyKey = idempotencyKey;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  let created;
  try {
    created = await provider.createPayment({
      paymentId: payment.id,
      amountCents: payment.amountCents,
      currencyCode: payment.currencyCode,
      idempotencyKey: payment.idempotencyKey,
    });
  } catch (error) {
    await getPool().query(
      `update public.reservation_payments
       set payment_state = 'failed',
           last_error_code = 'provider_create_failed',
           failed_at = statement_timestamp()
       where id = $1
         and payment_state = 'created'`,
      [payment.id],
    );
    throw error;
  }

  await getPool().query(
    `update public.reservation_payments
     set provider_payment_reference = $2,
         payment_state = 'submitted'
     where id = $1
       and payment_state = 'created'`,
    [payment.id, created.providerPaymentReference],
  );

  const event = await provider.capturePayment({
    paymentId: payment.id,
    providerPaymentReference: created.providerPaymentReference,
    amountCents: payment.amountCents,
    currencyCode: payment.currencyCode,
  });
  const eventResult = await ingestPaymentProviderEvent(event);

  return {
    payment: eventResult.payment,
    alreadySatisfied: false,
    active: false,
  };
}

export async function ingestPaymentProviderEvent(event) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const lookup = await client.query(
      `select *
       from public.reservation_payments
       where provider_key = $1
         and provider_payment_reference = $2
       limit 1
       for update`,
      [event.providerKey, event.providerPaymentReference],
    );
    if (lookup.rowCount !== 1) {
      throw new Error("Payment provider event does not match a payment.");
    }

    const row = lookup.rows[0];
    if (
      Number(row.amount_cents) !== Number(event.amountCents) ||
      row.currency_code !== event.currencyCode
    ) {
      throw new Error("Payment provider event amount does not match payment.");
    }

    const inserted = await client.query(
      `insert into icamp_private.payment_provider_events (
         provider_key,
         provider_event_id,
         payment_id,
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
        row.id,
        event.eventType,
        event.eventStatus,
        JSON.stringify({
          sandbox: event.sandbox === true,
          amountCents: Number(event.amountCents),
          currencyCode: event.currencyCode,
          rawWebhookExcluded: true,
          paymentCredentialsExcluded: true,
        }),
        event.occurredAt,
      ],
    );

    if (inserted.rowCount === 0) {
      await client.query("commit");
      return {
        duplicate: true,
        payment: mapPayment(row),
      };
    }

    let nextState = row.payment_state;
    if (
      event.eventType === "payment.authorized" &&
      ["created", "submitted"].includes(row.payment_state)
    ) {
      nextState = "authorized";
    } else if (
      event.eventType === "payment.captured" &&
      !["failed", "cancelled"].includes(row.payment_state)
    ) {
      nextState = "captured";
    } else if (
      event.eventType === "payment.failed" &&
      row.payment_state !== "captured"
    ) {
      nextState = "failed";
    } else if (
      event.eventType === "payment.cancelled" &&
      row.payment_state !== "captured"
    ) {
      nextState = "cancelled";
    }

    const updated = await client.query(
      `update public.reservation_payments
       set payment_state = $2,
           authorized_at = case
             when $2 = 'authorized'
               then coalesce(authorized_at, $3::timestamptz)
             else authorized_at
           end,
           captured_at = case
             when $2 = 'captured'
               then coalesce(captured_at, $3::timestamptz)
             else captured_at
           end,
           failed_at = case
             when $2 = 'failed'
               then coalesce(failed_at, $3::timestamptz)
             else failed_at
           end,
           last_error_code = case
             when $2 = 'failed' then 'provider_failed'
             else last_error_code
           end
       where id = $1
       returning *`,
      [row.id, nextState, event.occurredAt],
    );

    await client.query("commit");
    return {
      duplicate: false,
      payment: mapPayment(updated.rows[0]),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
