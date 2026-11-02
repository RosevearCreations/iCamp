import pg from "pg";

import { getMyStayDetail } from "../my-stay/postgres.mjs";
import { cancellationDecisionPreview } from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Reservation review storage is unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeReservationDecisionsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function withRls(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function date(value) {
  if (value == null) return null;
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function mapRequest(row) {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    campgroundId: row.campground_id,
    kind: row.request_kind,
    state: row.request_state,
    arrivalDate: date(row.requested_arrival_date),
    departureDate: date(row.requested_departure_date),
    reason: row.reason,
    submittedAt: new Date(row.submitted_at).toISOString(),
    withdrawnAt:
      row.withdrawn_at == null
        ? null
        : new Date(row.withdrawn_at).toISOString(),
    sourceReservationVersion: Number(row.source_reservation_version),
    sourcePolicyVersion:
      row.source_policy_version == null
        ? null
        : Number(row.source_policy_version),
    campgroundName: row.campground_name ?? null,
    accommodationCode: row.accommodation_code ?? null,
  };
}

export async function getOwnReservationDecisionSource({
  userId,
  reservationId,
}) {
  // The My Stay query applies both active guest account validation and the
  // reservation's owner predicate before any financial data is loaded.
  const stay = await getMyStayDetail({ userId, reservationId });
  if (!stay) return null;

  const source = await getPool().query(
    `select p.* from public.campground_cancellation_refund_policies p
     join public.reservations r on r.campground_id=p.campground_id
     where r.id=$1 and r.guest_user_id=$2 limit 1`,
    [reservationId, userId],
  );
  const policyRow = source.rows[0] ?? null;
  const policy = policyRow
    ? {
        id: policyRow.id,
        rowVersion: Number(policyRow.row_version),
        currencyCode: policyRow.currency_code,
        freeCancellationDaysBeforeArrival: Number(
          policyRow.free_cancellation_days_before_arrival,
        ),
        earlyRefundBasisPoints: Number(policyRow.early_refund_basis_points),
        lateRefundBasisPoints: Number(policyRow.late_refund_basis_points),
        securityDepositRefundBasisPoints: Number(
          policyRow.security_deposit_refund_basis_points,
        ),
        cancellationFeeCents: Number(policyRow.cancellation_fee_cents),
        approvalThresholdCents: Number(policyRow.approval_threshold_cents),
      }
    : null;

  const paymentResult = await getPool().query(
    `select p.id,p.payment_purpose,p.amount_cents,p.currency_code,
       coalesce(sum(rf.amount_cents) filter (
         where rf.refund_state = 'succeeded'
       ),0)::bigint as refunded_cents
     from public.reservation_payments p
     left join public.reservation_refunds rf on rf.original_payment_id=p.id
     where p.reservation_id=$1 and p.guest_user_id=$2 and p.payment_state='captured'
     group by p.id
     order by p.captured_at asc nulls last,p.created_at asc`,
    [reservationId, userId],
  );
  const payments = paymentResult.rows.map((row) => ({
    id: row.id,
    paymentPurpose: row.payment_purpose,
    amountCents: Number(row.amount_cents),
    refundedCents: Number(row.refunded_cents),
    currencyCode: row.currency_code,
  }));
  const unsettled = await getPool().query(
    `select
       exists (select 1 from public.reservation_payments p
         where p.reservation_id=$1 and p.guest_user_id=$2
           and p.payment_state in ('created','submitted','authorized')) as pending_payments,
       exists (select 1 from public.reservation_refunds rf
         join public.reservations r on r.id=rf.reservation_id
         where r.id=$1 and r.guest_user_id=$2
           and rf.refund_state in ('pending_approval','approved','submitted')) as pending_refunds`,
    [reservationId, userId],
  );
  const { pending_payments: pendingPayments, pending_refunds: pendingRefunds } =
    unsettled.rows[0];
  return {
    stay,
    policy,
    payments,
    pendingPayments,
    pendingRefunds,
    cancellation: cancellationDecisionPreview({
      stay,
      policy,
      payments,
      pendingRefunds,
      pendingPayments,
    }),
  };
}

export async function listOwnReservationReviewRequests({
  userId,
  reservationId,
}) {
  const rows = await withRls(userId, async (client) => {
    const result = await client.query(
      `select * from public.guest_reservation_review_requests
       where user_account_id=$1 and reservation_id=$2
       order by submitted_at desc,id desc limit 30`,
      [userId, reservationId],
    );
    return result.rows;
  });
  return rows.map(mapRequest);
}

export async function submitOwnReservationReviewRequest({
  userId,
  reservationId,
  idempotencyKey,
  expectedReservationVersion,
  expectedPolicyVersion,
  input,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const owner = await client.query(
      `select r.organization_id,r.campground_id,r.status,r.arrival_date,r.departure_date,
         r.row_version,to_char(statement_timestamp() at time zone c.timezone,'YYYY-MM-DD') as local_date,
         p.row_version as policy_version
       from public.reservations r
       join public.campgrounds c on c.id=r.campground_id
       left join public.campground_cancellation_refund_policies p on p.campground_id=r.campground_id
       where r.id=$1 and r.guest_user_id=$2 for share of r`,
      [reservationId, userId],
    );
    if (owner.rowCount !== 1)
      throw new Error("Reservation could not be verified.");
    const row = owner.rows[0];
    if (!["confirmed", "checked_in"].includes(row.status)) {
      throw new Error("This reservation cannot accept a review request.");
    }
    if (
      Number(row.row_version) !== expectedReservationVersion ||
      (row.policy_version == null ? null : Number(row.policy_version)) !==
        expectedPolicyVersion
    ) {
      throw new Error(
        "Reservation or policy changed. Review the latest details.",
      );
    }
    if (
      input.kind === "change_dates" &&
      (row.status !== "confirmed" ||
        date(row.arrival_date) <= row.local_date ||
        (input.arrivalDate === date(row.arrival_date) &&
          input.departureDate === date(row.departure_date)))
    ) {
      throw new Error("Choose different future dates for staff review.");
    }
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const values = [
      row.organization_id,
      row.campground_id,
      reservationId,
      userId,
      input.kind,
      input.arrivalDate,
      input.departureDate,
      input.reason,
      expectedReservationVersion,
      expectedPolicyVersion,
      idempotencyKey,
    ];
    const inserted = await client.query(
      `insert into public.guest_reservation_review_requests (
         organization_id,campground_id,reservation_id,user_account_id,
         request_kind,requested_arrival_date,requested_departure_date,reason,
         source_reservation_version,source_policy_version,idempotency_key
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict on constraint guest_review_requests_idempotency_unique
       do nothing returning id`,
      values,
    );
    const existing =
      inserted.rows[0] ??
      (
        await client.query(
          `select id from public.guest_reservation_review_requests
         where user_account_id=$1 and idempotency_key=$2`,
          [userId, idempotencyKey],
        )
      ).rows[0];
    if (!existing) throw new Error("Could not save the review request.");
    await client.query("commit");
    return existing.id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function withdrawOwnReservationReviewRequest({
  userId,
  reservationId,
  requestId,
}) {
  return withRls(userId, async (client) => {
    const result = await client.query(
      `update public.guest_reservation_review_requests
       set request_state='withdrawn',withdrawn_at=statement_timestamp()
       where id=$1 and user_account_id=$2 and reservation_id=$3
         and request_state='submitted'
       returning id`,
      [requestId, userId, reservationId],
    );
    return result.rowCount === 1;
  });
}

export async function listStaffReservationReviewRequests({ userId }) {
  const rows = await withRls(userId, async (client) => {
    const result = await client.query(
      `select q.* from public.guest_reservation_review_requests q
       order by case when q.request_state='submitted' then 0 else 1 end,
         q.submitted_at desc,q.id desc limit 100`,
    );
    return result.rows;
  });
  if (rows.length === 0) return [];
  // Resolve labels only after the app-role/RLS query has selected the rows.
  // Staff with reservation.read need not also hold accommodation.read; an
  // inner join under both table policies would incorrectly hide their queue.
  const detail = await getPool().query(
    `select r.id,c.name as campground_name,a.code as accommodation_code
       from public.reservations r
       join public.campgrounds c on c.id=r.campground_id
       join public.accommodations a on a.id=r.accommodation_id
       where r.id = any($1::uuid[])`,
    [rows.map((row) => row.reservation_id)],
  );
  const byReservation = new Map(detail.rows.map((row) => [row.id, row]));
  return rows.map((row) =>
    mapRequest({ ...row, ...byReservation.get(row.reservation_id) }),
  );
}
