import { randomUUID } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  effectiveVehiclePassStatus,
  normalizeExtraVehiclePassInput,
  normalizeNonStayVehiclePassInput,
  normalizeVehiclePassPolicyInput,
  normalizeVehiclePassRevocationReason,
  normalizeVehiclePassSourceChannel,
} from "./core.mjs";

const { Pool } = pg;
let pool;

const DEFAULT_PARKING_RULE =
  "Park only in designated areas or as directed by campground staff.";
const DEFAULT_ACCESS_RULE =
  "Vehicle access is limited to the pass validity window and campground operating rules.";

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for vehicle pass operations.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeVehiclePassPoolForTests() {
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

async function permissions(userId, campgroundId) {
  const [read, issue, paymentRead, paymentCapture, configure, pricing] =
    await Promise.all([
      hasCampgroundPermission(userId, campgroundId, "vehicle.read"),
      hasCampgroundPermission(userId, campgroundId, "vehicle.pass.issue"),
      hasCampgroundPermission(userId, campgroundId, "payment.read"),
      hasCampgroundPermission(userId, campgroundId, "payment.capture"),
      hasCampgroundPermission(userId, campgroundId, "campground.configuration"),
      hasCampgroundPermission(userId, campgroundId, "pricing.manage"),
    ]);
  return { read, issue, paymentRead, paymentCapture, configure, pricing };
}

async function assertPassRead(userId, campgroundId) {
  const value = await permissions(userId, campgroundId);
  if (!value.read && !value.issue && !value.paymentRead) {
    throw new Error("Not authorized to read vehicle passes.");
  }
  return value;
}

async function assertPassIssue(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "vehicle.pass.issue"))
  ) {
    throw new Error("Vehicle pass issuance permission is required.");
  }
}

async function assertPassPolicyManage(userId, campgroundId) {
  const [configure, pricing] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "campground.configuration"),
    hasCampgroundPermission(userId, campgroundId, "pricing.manage"),
  ]);
  if (!configure || !pricing) {
    throw new Error(
      "Campground configuration and pricing permissions are required to manage vehicle pass policy.",
    );
  }
}

async function assertPassPayment(userId, campgroundId) {
  const [issue, capture] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "vehicle.pass.issue"),
    hasCampgroundPermission(userId, campgroundId, "payment.capture"),
  ]);
  if (!issue || !capture) {
    throw new Error(
      "Vehicle pass issuance and payment capture permissions are required.",
    );
  }
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function isoDate(value) {
  return value == null ? null : String(value).slice(0, 10);
}

function requiredId(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(label + " is required.");
  return normalized;
}

function normalizeIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 8 || key.length > 200) {
    throw new Error("Vehicle pass idempotency key is invalid.");
  }
  return key;
}

function makePassNumber() {
  return (
    "VP-" +
    randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()
  );
}

function mapPolicy(row) {
  if (!row) {
    return {
      id: null,
      dayPassChargeId: null,
      weekPassChargeId: null,
      extraVehicleChargeId: null,
      includedStayVehicleCount: 1,
      parkingRule: DEFAULT_PARKING_RULE,
      accessRule: DEFAULT_ACCESS_RULE,
      rowVersion: 0,
      persisted: false,
    };
  }

  return {
    id: row.id,
    dayPassChargeId: row.day_pass_charge_id ?? null,
    weekPassChargeId: row.week_pass_charge_id ?? null,
    extraVehicleChargeId: row.extra_vehicle_charge_id ?? null,
    includedStayVehicleCount: Number(row.included_stay_vehicle_count),
    parkingRule: row.parking_rule,
    accessRule: row.access_rule,
    rowVersion: Number(row.row_version),
    persisted: true,
  };
}

function mapCharge(row) {
  return {
    id: row.id,
    chargeKind: row.charge_kind,
    code: row.code,
    displayName: row.display_name,
    currencyCode: row.currency_code,
    pricingBasis: row.pricing_basis,
    unitPriceCents:
      row.unit_price_cents == null ? null : Number(row.unit_price_cents),
    passDurationDays:
      row.pass_duration_days == null ? null : Number(row.pass_duration_days),
    feeCategoryCode: row.fee_category_code ?? null,
  };
}

function mapPass(row) {
  return {
    id: row.id,
    passNumber: row.pass_number,
    passKind: row.pass_kind,
    reservationId: row.reservation_id ?? null,
    roadVehicleRegistrationId: row.road_vehicle_registration_id ?? null,
    hostAccommodationId: row.host_accommodation_id ?? null,
    sourceChargeId: row.source_charge_id ?? null,
    plateNumber: row.plate_number,
    plateJurisdiction: row.plate_jurisdiction,
    vehicleDescription: row.vehicle_description,
    driverName: row.driver_name,
    validFrom: iso(row.valid_from),
    validUntil: iso(row.valid_until),
    feeAmountCents: Number(row.fee_amount_cents),
    currencyCode: row.currency_code,
    paymentState: row.payment_state,
    passStatus: row.pass_status,
    effectiveStatus:
      row.effective_status ??
      effectiveVehiclePassStatus({
        passStatus: row.pass_status,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
      }),
    parkingRuleSnapshot: row.parking_rule_snapshot,
    accessRuleSnapshot: row.access_rule_snapshot,
    revokedAt: iso(row.revoked_at),
    revocationReason: row.revocation_reason ?? null,
    sourceChannel: row.source_channel,
    notes: row.notes ?? null,
    latestPaymentState: row.latest_payment_state ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    rowVersion: Number(row.row_version),
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    vehiclePassId: row.vehicle_pass_id,
    providerKey: row.provider_key,
    providerPaymentReference: row.provider_payment_reference ?? null,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code,
    state: row.payment_state,
    authorizedAt: iso(row.authorized_at),
    capturedAt: iso(row.captured_at),
    failedAt: iso(row.failed_at),
    createdAt: iso(row.created_at),
  };
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select
       id,
       organization_id,
       display_name,
       time_zone,
       to_char(
         statement_timestamp() at time zone time_zone,
         'YYYY-MM-DD"T"HH24:MI'
       ) local_datetime,
       (statement_timestamp() at time zone time_zone)::date local_date
     from public.campgrounds
     where id=$1
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground was not found.");
  }
  return result.rows[0];
}

async function policyRow(client, campgroundId) {
  const result = await client.query(
    `select *
     from public.campground_vehicle_pass_policies
     where campground_id=$1
     limit 1`,
    [campgroundId],
  );
  return result.rows[0] ?? null;
}

async function chargeRow(client, campgroundId, chargeId) {
  if (!chargeId) return null;
  const result = await client.query(
    `select *
     from public.booking_charge_catalog
     where campground_id=$1
       and id=$2
       and is_active
     limit 1`,
    [campgroundId, chargeId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Configured vehicle pass charge is unavailable.");
  }
  return result.rows[0];
}

async function lifecycleEvent(
  client,
  {
    row,
    actorUserId,
    eventKind,
    priorStatus,
    newStatus,
    reason = null,
    sourceChannel,
  },
) {
  await client.query(
    `insert into public.vehicle_pass_events (
       organization_id,campground_id,vehicle_pass_id,event_kind,
       prior_status,new_status,reason,source_channel,actor_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      row.organization_id,
      row.campground_id,
      row.id,
      eventKind,
      priorStatus,
      newStatus,
      reason,
      sourceChannel,
      actorUserId,
    ],
  );
}

export async function listVehiclePassDesk({ userId, campgroundId }) {
  const allowed = await assertPassRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);
    const campground = await campgroundScope(client, campgroundId);
    const [policyResult, chargesResult, passesResult] = await Promise.all([
      client.query(
        `select *
         from public.campground_vehicle_pass_policies
         where campground_id=$1
         limit 1`,
        [campgroundId],
      ),
      client.query(
        `select *
         from public.booking_charge_catalog
         where campground_id=$1
           and is_active
           and unit_price_cents is not null
           and (
             (charge_kind='pass' and pass_duration_days in (1,7))
             or
             (charge_kind in ('add_on','service_fee') and pricing_basis='per_unit')
           )
         order by charge_kind,pass_duration_days,display_name`,
        [campgroundId],
      ),
      client.query(
        `select
           vp.*,
           case
             when vp.pass_status='active'
              and statement_timestamp() < vp.valid_from then 'scheduled'
             when vp.pass_status='active'
              and statement_timestamp() > vp.valid_until then 'expired'
             else vp.pass_status
           end effective_status,
           (
             select p.payment_state
             from public.vehicle_pass_payments p
             where p.vehicle_pass_id=vp.id
             order by p.created_at desc
             limit 1
           ) latest_payment_state
         from public.vehicle_passes vp
         where vp.campground_id=$1
         order by
           case when vp.pass_status in ('pending_payment','active')
             and vp.valid_until >= statement_timestamp() then 0 else 1 end,
           vp.valid_until desc,
           vp.created_at desc
         limit 500`,
        [campgroundId],
      ),
    ]);

    let registrations = [];
    if (allowed.issue) {
      const registrationResult = await client.query(
        `select
           r.id,
           r.reservation_id,
           r.host_accommodation_id,
           r.host_accommodation_label,
           r.plate_number,
           r.plate_jurisdiction,
           r.vehicle_description,
           r.primary_driver_name,
           r.valid_from,
           r.valid_until,
           res.arrival_date,
           res.departure_date,
           res.status reservation_status,
           count(*) over (partition by r.reservation_id) active_vehicle_count,
           exists (
             select 1
             from public.vehicle_passes vp
             where vp.road_vehicle_registration_id=r.id
               and vp.pass_kind='extra_vehicle'
               and vp.pass_status in ('pending_payment','active')
           ) has_open_extra_pass
         from public.road_vehicle_registrations r
         join public.reservations res
           on res.id=r.reservation_id
          and res.campground_id=r.campground_id
         where r.campground_id=$1
           and r.registration_status='active'
           and r.reservation_id is not null
           and res.status in ('pending','confirmed','checked_in')
         order by res.arrival_date desc,r.host_accommodation_label,r.plate_number
         limit 500`,
        [campgroundId],
      );

      registrations = registrationResult.rows.map((row) => ({
        id: row.id,
        reservationId: row.reservation_id,
        hostAccommodationId: row.host_accommodation_id,
        hostAccommodationLabel: row.host_accommodation_label,
        plateNumber: row.plate_number,
        plateJurisdiction: row.plate_jurisdiction,
        vehicleDescription: row.vehicle_description,
        driverName: row.primary_driver_name,
        registrationValidFrom: isoDate(row.valid_from),
        registrationValidUntil: isoDate(row.valid_until),
        reservationArrivalDate: isoDate(row.arrival_date),
        reservationDepartureDate: isoDate(row.departure_date),
        reservationStatus: row.reservation_status,
        activeVehicleCount: Number(row.active_vehicle_count),
        hasOpenExtraPass: row.has_open_extra_pass === true,
      }));
    }

    await client.query("commit");
    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        displayName: campground.display_name,
        timeZone: campground.time_zone,
        localDate: isoDate(campground.local_date),
        localDateTime: campground.local_datetime,
      },
      policy: mapPolicy(policyResult.rows[0] ?? null),
      charges: chargesResult.rows.map(mapCharge),
      passes: passesResult.rows.map(mapPass),
      registrations,
      canIssue: allowed.issue,
      canCapturePayment: allowed.issue && allowed.paymentCapture,
      canManagePolicy: allowed.configure && allowed.pricing,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveVehiclePassPolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  input = {},
}) {
  await assertPassPolicyManage(actorUserId, campgroundId);
  const value = normalizeVehiclePassPolicyInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("Vehicle pass policy row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const existing = await client.query(
      `select *
       from public.campground_vehicle_pass_policies
       where campground_id=$1
       limit 1
       for update`,
      [campgroundId],
    );
    const before = existing.rows[0] ?? null;
    let saved;

    if (before) {
      if (Number(before.row_version) !== expected) {
        throw new Error(
          "Vehicle pass policy changed since this page loaded. Refresh and try again.",
        );
      }
      const updated = await client.query(
        `update public.campground_vehicle_pass_policies
         set day_pass_charge_id=$3,
             week_pass_charge_id=$4,
             extra_vehicle_charge_id=$5,
             included_stay_vehicle_count=$6,
             parking_rule=$7,
             access_rule=$8,
             updated_by_user_id=$9
         where campground_id=$1
           and organization_id=$2
           and row_version=$10
         returning *`,
        [
          campgroundId,
          campground.organization_id,
          value.dayPassChargeId,
          value.weekPassChargeId,
          value.extraVehicleChargeId,
          value.includedStayVehicleCount,
          value.parkingRule,
          value.accessRule,
          actorUserId,
          expected,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Vehicle pass policy changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
    } else {
      if (expected !== 0) {
        throw new Error(
          "Vehicle pass policy changed since this page loaded. Refresh and try again.",
        );
      }
      const inserted = await client.query(
        `insert into public.campground_vehicle_pass_policies (
           organization_id,campground_id,day_pass_charge_id,
           week_pass_charge_id,extra_vehicle_charge_id,
           included_stay_vehicle_count,parking_rule,access_rule,
           updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning *`,
        [
          campground.organization_id,
          campgroundId,
          value.dayPassChargeId,
          value.weekPassChargeId,
          value.extraVehicleChargeId,
          value.includedStayVehicleCount,
          value.parkingRule,
          value.accessRule,
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
      actionKey: "vehicle.pass.policy.update",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground_vehicle_pass_policy",
      subjectId: saved.id,
      beforeState: before
        ? {
            dayPassChargeId: before.day_pass_charge_id,
            weekPassChargeId: before.week_pass_charge_id,
            extraVehicleChargeId: before.extra_vehicle_charge_id,
            includedStayVehicleCount: Number(before.included_stay_vehicle_count),
          }
        : null,
      afterState: {
        dayPassChargeId: saved.day_pass_charge_id,
        weekPassChargeId: saved.week_pass_charge_id,
        extraVehicleChargeId: saved.extra_vehicle_charge_id,
        includedStayVehicleCount: Number(saved.included_stay_vehicle_count),
      },
      metadata: {
        pricingPermissionRequired: true,
        accessEnforcementBoundary: "Build 056-060",
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

async function passPricing(client, campgroundId, passKind, policy) {
  const chargeId =
    passKind === "day"
      ? policy?.day_pass_charge_id
      : passKind === "week"
        ? policy?.week_pass_charge_id
        : policy?.extra_vehicle_charge_id;
  const charge = await chargeRow(client, campgroundId, chargeId);
  return {
    sourceChargeId: charge?.id ?? null,
    feeAmountCents: charge ? Number(charge.unit_price_cents) : 0,
    currencyCode: charge?.currency_code ?? "CAD",
  };
}

function initialFinancialState(feeAmountCents) {
  return feeAmountCents > 0
    ? { paymentState: "unpaid", passStatus: "pending_payment" }
    : { paymentState: "not_required", passStatus: "active" };
}

export async function createNonStayVehiclePass({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
}) {
  await assertPassIssue(actorUserId, campgroundId);
  const value = normalizeNonStayVehiclePassInput(input);
  const channel = normalizeVehiclePassSourceChannel(sourceChannel);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const existing = await client.query(
      `select *
       from public.vehicle_passes
       where campground_id=$1 and idempotency_key=$2
       limit 1`,
      [campgroundId, key],
    );
    if (existing.rowCount === 1) {
      await client.query("commit");
      return { pass: mapPass(existing.rows[0]), idempotent: true };
    }

    const campground = await campgroundScope(client, campgroundId);
    const policy = await policyRow(client, campgroundId);
    const pricing = await passPricing(client, campgroundId, value.passKind, policy);
    const states = initialFinancialState(pricing.feeAmountCents);

    const plateLockKey =
      "vehicle-pass:" +
      campgroundId +
      ":" +
      value.plateJurisdiction +
      ":" +
      value.plateNumber;
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      plateLockKey,
    ]);

    const overlap = await client.query(
      `select id
       from public.vehicle_passes
       where campground_id=$1
         and plate_jurisdiction=$2
         and plate_number=$3
         and pass_kind in ('day','week')
         and pass_status in ('pending_payment','active')
         and not (
           valid_until <= ($4::timestamp at time zone $6)
           or valid_from >= ($5::timestamp at time zone $6)
         )
       limit 1`,
      [
        campgroundId,
        value.plateJurisdiction,
        value.plateNumber,
        value.validFromLocal,
        value.validUntilLocal,
        campground.time_zone,
      ],
    );
    if (overlap.rowCount > 0) {
      throw new Error(
        "This plate already has an overlapping open day/week vehicle pass.",
      );
    }

    const inserted = await client.query(
      `insert into public.vehicle_passes (
         organization_id,campground_id,pass_number,pass_kind,source_charge_id,
         plate_number,plate_jurisdiction,vehicle_description,driver_name,
         valid_from,valid_until,fee_amount_cents,currency_code,payment_state,
         pass_status,parking_rule_snapshot,access_rule_snapshot,source_channel,
         notes,idempotency_key,issued_by_user_id,updated_by_user_id
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         ($10::timestamp at time zone $11),
         ($12::timestamp at time zone $11),
         $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22
       )
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        makePassNumber(),
        value.passKind,
        pricing.sourceChargeId,
        value.plateNumber,
        value.plateJurisdiction,
        value.vehicleDescription,
        value.driverName,
        value.validFromLocal,
        campground.time_zone,
        value.validUntilLocal,
        pricing.feeAmountCents,
        pricing.currencyCode,
        states.paymentState,
        states.passStatus,
        policy?.parking_rule ?? DEFAULT_PARKING_RULE,
        policy?.access_rule ?? DEFAULT_ACCESS_RULE,
        channel,
        value.notes,
        key,
        actorUserId,
      ],
    );
    const row = inserted.rows[0];

    await lifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "issued",
      priorStatus: null,
      newStatus: row.pass_status,
      sourceChannel: channel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "vehicle.pass.issue",
      permissionKey: "vehicle.pass.issue",
      riskLevel: "standard",
      subjectType: "vehicle_pass",
      subjectId: row.id,
      beforeState: null,
      afterState: {
        passNumber: row.pass_number,
        passKind: row.pass_kind,
        plateJurisdiction: row.plate_jurisdiction,
        plateNumber: row.plate_number,
        validFrom: iso(row.valid_from),
        validUntil: iso(row.valid_until),
        feeAmountCents: Number(row.fee_amount_cents),
        currencyCode: row.currency_code,
        paymentState: row.payment_state,
        status: row.pass_status,
      },
      metadata: {
        sourceChannel: channel,
        nonStay: true,
        credentialBoundary: "Build 056/063",
        accessRuleBoundary: "Build 060",
      },
    });

    await client.query("commit");
    return { pass: mapPass(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error?.code === "23505") {
      throw new Error(
        "This vehicle pass was already submitted. Refresh the pass desk.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function createExtraVehiclePass({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
}) {
  await assertPassIssue(actorUserId, campgroundId);
  const value = normalizeExtraVehiclePassInput(input);
  const channel = normalizeVehiclePassSourceChannel(sourceChannel);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const existing = await client.query(
      `select *
       from public.vehicle_passes
       where campground_id=$1 and idempotency_key=$2
       limit 1`,
      [campgroundId, key],
    );
    if (existing.rowCount === 1) {
      await client.query("commit");
      return { pass: mapPass(existing.rows[0]), idempotent: true };
    }

    const campground = await campgroundScope(client, campgroundId);
    const policy = await policyRow(client, campgroundId);
    const registrationResult = await client.query(
      `select
         r.*,
         res.arrival_date,
         res.departure_date,
         res.status reservation_status,
         (
           select count(*)::integer
           from public.road_vehicle_registrations active_registration
           where active_registration.campground_id=r.campground_id
             and active_registration.reservation_id=r.reservation_id
             and active_registration.registration_status='active'
         ) active_vehicle_count
       from public.road_vehicle_registrations r
       join public.reservations res
         on res.id=r.reservation_id
        and res.campground_id=r.campground_id
       where r.campground_id=$1
         and r.id=$2
         and r.registration_status='active'
         and r.reservation_id is not null
         and res.status in ('pending','confirmed','checked_in')
       limit 1`,
      [campgroundId, value.roadVehicleRegistrationId],
    );
    if (registrationResult.rowCount !== 1) {
      throw new Error(
        "Extra-vehicle fee requires an active stay-linked road vehicle registration.",
      );
    }
    const registration = registrationResult.rows[0];
    const included = Number(policy?.included_stay_vehicle_count ?? 1);
    if (Number(registration.active_vehicle_count) <= included) {
      throw new Error(
        "This stay is still within the configured included vehicle count.",
      );
    }

    const pricing = await passPricing(
      client,
      campgroundId,
      "extra_vehicle",
      policy,
    );
    const states = initialFinancialState(pricing.feeAmountCents);

    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "extra-vehicle-pass:" + registration.id,
    ]);

    const inserted = await client.query(
      `insert into public.vehicle_passes (
         organization_id,campground_id,pass_number,pass_kind,reservation_id,
         road_vehicle_registration_id,host_accommodation_id,source_charge_id,
         plate_number,plate_jurisdiction,vehicle_description,driver_name,
         valid_from,valid_until,fee_amount_cents,currency_code,payment_state,
         pass_status,parking_rule_snapshot,access_rule_snapshot,source_channel,
         notes,idempotency_key,issued_by_user_id,updated_by_user_id
       )
       values (
         $1,$2,$3,'extra_vehicle',$4,$5,$6,$7,$8,$9,$10,$11,
         ($12::timestamp at time zone $13),
         ($14::timestamp at time zone $13),
         $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24
       )
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        makePassNumber(),
        registration.reservation_id,
        registration.id,
        registration.host_accommodation_id,
        pricing.sourceChargeId,
        registration.plate_number,
        registration.plate_jurisdiction,
        registration.vehicle_description,
        registration.primary_driver_name,
        value.validFromLocal,
        campground.time_zone,
        value.validUntilLocal,
        pricing.feeAmountCents,
        pricing.currencyCode,
        states.paymentState,
        states.passStatus,
        policy?.parking_rule ?? DEFAULT_PARKING_RULE,
        policy?.access_rule ?? DEFAULT_ACCESS_RULE,
        channel,
        value.notes,
        key,
        actorUserId,
      ],
    );
    const row = inserted.rows[0];

    await lifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "issued",
      priorStatus: null,
      newStatus: row.pass_status,
      sourceChannel: channel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "vehicle.pass.extra_vehicle.issue",
      permissionKey: "vehicle.pass.issue",
      riskLevel: "standard",
      subjectType: "vehicle_pass",
      subjectId: row.id,
      beforeState: null,
      afterState: {
        passNumber: row.pass_number,
        reservationId: row.reservation_id,
        roadVehicleRegistrationId: row.road_vehicle_registration_id,
        plateJurisdiction: row.plate_jurisdiction,
        plateNumber: row.plate_number,
        feeAmountCents: Number(row.fee_amount_cents),
        currencyCode: row.currency_code,
        paymentState: row.payment_state,
        status: row.pass_status,
      },
      metadata: {
        sourceChannel: channel,
        includedStayVehicleCount: included,
        activeVehicleCount: Number(registration.active_vehicle_count),
        refundBoundary: "Build 045 safeguards apply to financial reversals",
      },
    });

    await client.query("commit");
    return { pass: mapPass(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error?.code === "23505") {
      throw new Error(
        "This vehicle already has an open extra-vehicle pass or the request was already submitted.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeVehiclePass({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  vehiclePassId,
  expectedRowVersion,
  reason,
  sourceChannel = "staff",
}) {
  await assertPassIssue(actorUserId, campgroundId);
  const passId = requiredId(vehiclePassId, "Vehicle pass");
  const revocationReason = normalizeVehiclePassRevocationReason(reason);
  const channel = normalizeVehiclePassSourceChannel(sourceChannel);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Vehicle pass row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const current = await client.query(
      `select *
       from public.vehicle_passes
       where campground_id=$1 and id=$2
       for update`,
      [campgroundId, passId],
    );
    if (current.rowCount !== 1) {
      throw new Error("Vehicle pass was not found.");
    }
    const before = current.rows[0];
    if (before.pass_status === "revoked") {
      await client.query("commit");
      return { pass: mapPass(before), idempotent: true };
    }

    const updated = await client.query(
      `update public.vehicle_passes
       set pass_status='revoked',
           revoked_at=statement_timestamp(),
           revocation_reason=$3,
           updated_by_user_id=$4
       where campground_id=$1
         and id=$2
         and row_version=$5
       returning *`,
      [campgroundId, passId, revocationReason, actorUserId, expected],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Vehicle pass changed since this page loaded. Refresh and try again.",
      );
    }
    const row = updated.rows[0];

    await lifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "revoked",
      priorStatus: before.pass_status,
      newStatus: "revoked",
      reason: revocationReason,
      sourceChannel: channel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "vehicle.pass.revoke",
      permissionKey: "vehicle.pass.issue",
      riskLevel: "standard",
      subjectType: "vehicle_pass",
      subjectId: row.id,
      beforeState: {
        status: before.pass_status,
        paymentState: before.payment_state,
      },
      afterState: {
        status: "revoked",
        paymentState: row.payment_state,
        reason: revocationReason,
      },
      metadata: {
        sourceChannel: channel,
        capturedPaymentNotRefundedAutomatically:
          row.payment_state === "captured",
      },
    });

    await client.query("commit");
    return { pass: mapPass(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function startVehiclePassPayment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  vehiclePassId,
  provider,
}) {
  await assertPassPayment(actorUserId, campgroundId);
  if (
    !provider ||
    typeof provider.createPayment !== "function" ||
    typeof provider.capturePayment !== "function"
  ) {
    throw new Error("Payment provider adapter is required.");
  }

  const passId = requiredId(vehiclePassId, "Vehicle pass");
  const client = await getPool().connect();
  let payment;

  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1,0))",
      ["vehicle-pass-payment:" + passId],
    );

    const passResult = await client.query(
      `select *
       from public.vehicle_passes
       where campground_id=$1 and id=$2
       limit 1
       for update`,
      [campgroundId, passId],
    );
    if (passResult.rowCount !== 1) {
      throw new Error("Vehicle pass was not found.");
    }
    const pass = passResult.rows[0];

    if (pass.payment_state === "captured") {
      await client.query("commit");
      return { pass: mapPass(pass), payment: null, alreadySatisfied: true };
    }
    if (
      pass.fee_amount_cents <= 0 ||
      pass.payment_state !== "unpaid" ||
      pass.pass_status !== "pending_payment"
    ) {
      throw new Error("Vehicle pass does not have a payable open fee.");
    }

    const active = await client.query(
      `select *
       from public.vehicle_pass_payments
       where vehicle_pass_id=$1
         and payment_state in ('created','submitted','authorized')
       order by created_at desc
       limit 1
       for update`,
      [passId],
    );
    if (active.rowCount === 1) {
      await client.query("commit");
      return {
        pass: mapPass(pass),
        payment: mapPayment(active.rows[0]),
        alreadySatisfied: false,
        active: true,
      };
    }

    const count = await client.query(
      `select count(*)::integer count
       from public.vehicle_pass_payments
       where vehicle_pass_id=$1`,
      [passId],
    );
    const attempt = Number(count.rows[0].count) + 1;
    const idempotencyKey =
      "vehicle-pass:" + passId + ":attempt:" + attempt;

    const inserted = await client.query(
      `insert into public.vehicle_pass_payments (
         organization_id,campground_id,vehicle_pass_id,provider_key,
         idempotency_key,amount_cents,currency_code,created_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        pass.organization_id,
        campgroundId,
        passId,
        provider.providerKey,
        idempotencyKey,
        Number(pass.fee_amount_cents),
        pass.currency_code,
        actorUserId,
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
      `update public.vehicle_pass_payments
       set payment_state='failed',
           last_error_code='provider_create_failed',
           failed_at=statement_timestamp()
       where id=$1 and payment_state='created'`,
      [payment.id],
    );
    throw error;
  }

  await getPool().query(
    `update public.vehicle_pass_payments
     set provider_payment_reference=$2,
         payment_state='submitted'
     where id=$1 and payment_state='created'`,
    [payment.id, created.providerPaymentReference],
  );

  const event = await provider.capturePayment({
    paymentId: payment.id,
    providerPaymentReference: created.providerPaymentReference,
    amountCents: payment.amountCents,
    currencyCode: payment.currencyCode,
  });

  return ingestVehiclePassPaymentProviderEvent({
    event,
    actorSessionId,
  });
}

export async function ingestVehiclePassPaymentProviderEvent({
  event,
  actorSessionId = null,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const lookup = await client.query(
      `select
         p.*,
         vp.pass_status,
         vp.payment_state pass_payment_state
       from public.vehicle_pass_payments p
       join public.vehicle_passes vp on vp.id=p.vehicle_pass_id
       where p.provider_key=$1
         and p.provider_payment_reference=$2
       limit 1
       for update of p,vp`,
      [event.providerKey, event.providerPaymentReference],
    );
    if (lookup.rowCount !== 1) {
      throw new Error("Payment provider event does not match a vehicle pass payment.");
    }

    const row = lookup.rows[0];
    if (
      Number(row.amount_cents) !== Number(event.amountCents) ||
      row.currency_code !== event.currencyCode
    ) {
      throw new Error("Payment provider event amount does not match vehicle pass fee.");
    }

    const inserted = await client.query(
      `insert into icamp_private.vehicle_pass_payment_provider_events (
         provider_key,provider_event_id,payment_id,event_type,event_status,
         metadata,occurred_at
       )
       values ($1,$2,$3,$4,$5,$6::jsonb,$7)
       on conflict (provider_key,provider_event_id) do nothing
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
      const currentPass = await client.query(
        "select * from public.vehicle_passes where id=$1",
        [row.vehicle_pass_id],
      );
      await client.query("commit");
      return {
        duplicate: true,
        pass: mapPass(currentPass.rows[0]),
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

    const paymentUpdate = await client.query(
      `update public.vehicle_pass_payments
       set payment_state=$2,
           authorized_at=case
             when $2='authorized' then coalesce(authorized_at,$3::timestamptz)
             else authorized_at end,
           captured_at=case
             when $2='captured' then coalesce(captured_at,$3::timestamptz)
             else captured_at end,
           failed_at=case
             when $2='failed' then coalesce(failed_at,$3::timestamptz)
             else failed_at end,
           last_error_code=case
             when $2='failed' then 'provider_failed'
             else last_error_code end
       where id=$1
       returning *`,
      [row.id, nextState, event.occurredAt],
    );

    let passResult = await client.query(
      "select * from public.vehicle_passes where id=$1 for update",
      [row.vehicle_pass_id],
    );
    let pass = passResult.rows[0];

    if (
      nextState === "captured" &&
      pass.payment_state === "unpaid" &&
      pass.pass_status === "pending_payment"
    ) {
      const activated = await client.query(
        `update public.vehicle_passes
         set payment_state='captured',
             pass_status='active',
             updated_by_user_id=$2
         where id=$1
         returning *`,
        [pass.id, row.created_by_user_id],
      );
      pass = activated.rows[0];

      await lifecycleEvent(client, {
        row: pass,
        actorUserId: row.created_by_user_id,
        eventKind: "payment_captured",
        priorStatus: "pending_payment",
        newStatus: "active",
        sourceChannel: "system",
      });

      await appendAuditEvent(client, {
        actorUserId: row.created_by_user_id,
        actorSessionId,
        organizationId: pass.organization_id,
        campgroundId: pass.campground_id,
        actionKey: "vehicle.pass.payment.capture",
        permissionKey: "payment.capture",
        riskLevel: "standard",
        subjectType: "vehicle_pass",
        subjectId: pass.id,
        beforeState: {
          status: "pending_payment",
          paymentState: "unpaid",
        },
        afterState: {
          status: "active",
          paymentState: "captured",
          amountCents: Number(row.amount_cents),
          currencyCode: row.currency_code,
        },
        metadata: {
          providerKey: event.providerKey,
          rawPaymentCredentialsStored: false,
        },
      });
    }

    await client.query("commit");
    return {
      duplicate: false,
      pass: mapPass(pass),
      payment: mapPayment(paymentUpdate.rows[0]),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
