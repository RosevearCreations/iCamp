import pg from "pg";
import { classifyMissingConfirmation268 } from "./core.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let pool;
function connection() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw Error("ORIGINAL_DATABASE_UNAVAILABLE");
  return value;
}
function db() {
  if (!pool) pool = new Pool({connectionString:connection(), max:3,
    connectionTimeoutMillis:3500,idleTimeoutMillis:10000});
  return pool;
}
function runtimeHost() {
  try { return new URL(connection()).hostname.toLowerCase(); } catch { return null; }
}
export async function inspectOriginalRuntime268() {
  const host = runtimeHost();
  const expected = process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST?.trim().toLowerCase() || null;
  const result = {
    status:"HOLD_NO_ORIGINAL_DATABASE",
    hostPinConfigured:!!expected,
    runtimeTargetPinMatches:!!host && !!expected && host===expected,
    migrationHistoryPresent:false,
    migration0241:false,migration0242:false,migration0243:false,
    campRosevear: "UNKNOWN",
    // Hostname and credentials are never returned.
  };
  if (!host) return result;
  try {
    const rows = await db().query(
      "select to_regclass('icamp_meta.schema_migrations') is not null as ledger," +
      "to_regclass('icamp_private.campground_support265') is not null as support," +
      "to_regclass('icamp_private.support_ownership267') is not null as owned," +
      "to_regclass('icamp_private.booking_recovery268') is not null as recovery");
    const row = rows.rows[0];
    result.migrationHistoryPresent = row.ledger;
    if (row.ledger) {
      const m = await db().query(
        "select version from icamp_meta.schema_migrations where version in ('0241','0242','0243')");
      const adopted = new Set(m.rows.map(x=>x.version));
      result.migration0241 = adopted.has("0241") && row.support;
      result.migration0242 = adopted.has("0242") && row.owned;
      result.migration0243 = adopted.has("0243") && row.recovery;
    }
    if (await db().query("select to_regclass('public.campgrounds') is not null as exists")
      .then(x=>x.rows[0]?.exists)) {
      const x=await db().query(
        "select lifecycle_state from public.campgrounds where lower(name)='camp rosevear' limit 1");
      result.campRosevear=x.rowCount===1 ? x.rows[0].lifecycle_state : "NOT_FOUND";
    }
    result.status=result.runtimeTargetPinMatches && result.migration0241 &&
      result.migration0242 && result.migration0243
      ? "ORIGINAL_RUNTIME_SCHEMA_READY_NEEDS_INDEPENDENT_WITNESS"
      : "HOLD_ORIGINAL_RUNTIME_SCHEMA_OR_HOST_PIN";
  } catch {
    result.status="HOLD_RUNTIME_QUERY_FAILED";
  }
  return result;
}
// Only assigned campground personnel can follow a reservation's financial evidence.
// No guest contact, payment processor reference, credentials or sensitive booking body leaves this return value.
export async function diagnoseCampgroundBooking268({userId,campgroundId,reservationId}) {
  if (![userId,campgroundId,reservationId].every(v=>UUID.test(v)) ||
      !(await hasCampgroundPermission(userId,campgroundId,"campground.operations.manage")))
    throw Error("Active campground operator permission required");
  const ready=await inspectOriginalRuntime268();
  if (!ready.migration0241 || !ready.migration0242)
    return {status:"HOLD_ORIGINAL_DATABASE",stage:"SOURCE_MISSING",evidence:null};
  try {
    const r=await db().query(
      "select id,status from public.reservations where id=$1 and campground_id=$2 limit 1",
      [reservationId,campgroundId]);
    if(!r.rowCount) return {status:"NOT_FOUND_IN_ASSIGNED_CAMPGROUND",stage:"SOURCE_MISSING",evidence:null};
    const [schedule,payments,confirmations,receipts,providerEvents,deliveries] =
      await Promise.all([
        db().query("select booking_due_cents from public.reservation_payment_schedules where reservation_id=$1 and campground_id=$2 limit 1",[reservationId,campgroundId]),
        db().query("select coalesce(sum(amount_cents) filter(where payment_state='captured'),0)::integer as captured, count(*)::integer as payments from public.reservation_payments where reservation_id=$1 and campground_id=$2",[reservationId,campgroundId]),
        db().query("select id from public.reservation_confirmations where reservation_id=$1 and campground_id=$2 limit 1",[reservationId,campgroundId]),
        db().query("select count(*)::integer as n from public.reservation_receipts where reservation_id=$1 and campground_id=$2",[reservationId,campgroundId]),
        db().query("select count(*)::integer as n from icamp_private.payment_provider_events e join public.reservation_payments p on p.id=e.payment_id where p.reservation_id=$1 and p.campground_id=$2",[reservationId,campgroundId]),
        db().query("select delivery_state from icamp_private.communication_dispatches where campground_id=$2 and idempotency_key=$1 order by created_at desc limit 1",["reservation-confirmation:"+reservationId+":email",campgroundId]),
      ]);
    const evidence={
      reservationStatus:r.rows[0].status,
      bookingDueCents:schedule.rows[0]?.booking_due_cents??null,
      capturedCents:payments.rows[0]?.captured??0,
      paymentRows:payments.rows[0]?.payments??0,
      providerEventRows:providerEvents.rows[0]?.n??0,
      confirmationExists:!!confirmations.rowCount,
      receiptRows:receipts.rows[0]?.n??0,
      deliveryState:deliveries.rows[0]?.delivery_state??"missing",
      // A database webhook receipt is not independent processor/bank settlement evidence.
      providerReconciled:false,
      holdVerified:false,
    };
    return {
      status:"ORIGINAL_TENANT_SCOPED_EVIDENCE_OBSERVED",
      stage:classifyMissingConfirmation268({
        originalReservation:true,bookingDueCents:evidence.bookingDueCents,
        capturedCents:evidence.capturedCents,
        providerReconciled:false,holdVerified:false,
        reservationStatus:evidence.reservationStatus,
        confirmationExists:evidence.confirmationExists,
        receiptExists:evidence.receiptRows>0,
        deliveryState:evidence.deliveryState,
      }),
      evidence,
    };
  } catch {
    return {status:"HOLD_SOURCE_QUERY_FAILED",stage:"SOURCE_MISSING",evidence:null};
  }
}
export async function getRecoveryShellSummary268() {
  const ready=await inspectOriginalRuntime268();
  if(!ready.migration0243)
    return {status:"HOLD_ORIGINAL_0243",opened:null,overdue:null,
      queuedAlerts:null,deliveredAlerts:null};
  try {
    const [a,b]=await Promise.all([
      db().query("select count(*)::integer as opened,"+
        "count(*) filter(where state<>'closed' and next_update_at<now())::integer as overdue "+
        "from icamp_private.booking_recovery268"),
      db().query("select count(*) filter(where delivery_state='queued')::integer queued,"+
        "count(*) filter(where delivery_state='acknowledged')::integer acknowledged "+
        "from icamp_private.support_sla_outbox268"),
    ]);
    return {status:"ORIGINAL_AGGREGATE_RECEIPTS",opened:a.rows[0].opened,
      overdue:a.rows[0].overdue,queuedAlerts:b.rows[0].queued,
      deliveredAlerts:b.rows[0].acknowledged};
  } catch {
    return {status:"HOLD_ORIGINAL_QUERY_FAILED",opened:null,overdue:null,
      queuedAlerts:null,deliveredAlerts:null};
  }
}
// Safe idempotent SLA queue. This DOES NOT claim that an email/SMS was sent.
export async function queueOverdueSupport268() {
  const ready=await inspectOriginalRuntime268();
  if(!ready.runtimeTargetPinMatches || !ready.migration0243) return {status:"HOLD_DATABASE",queued:0};
  const sql=
    "insert into icamp_private.support_sla_outbox268 "+
    "(case_id,assigned_user_id,alert_tier) "+
    "select s.id,o.assigned_user_id,s.severity "+
    "from icamp_private.campground_support265 s "+
    "join icamp_private.support_ownership267 o on o.case_id=s.id "+
    "where s.status<>'resolved' and s.reviewed_at is null "+
    "and s.created_at < now()- (case s.severity "+
    "when 'critical' then interval '1 hour' "+
    "when 'priority' then interval '8 hours' "+
    "else interval '48 hours' end) "+
    "on conflict(case_id,alert_tier) do nothing returning id";
  const x=await db().query(sql);
  return {status:"QUEUED_NOT_DELIVERED",queued:x.rowCount};
}
