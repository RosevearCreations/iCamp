import { randomUUID } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assertVisitorContactRequirement,
  effectiveVisitorStatus,
  normalizeVisitorPolicyInput,
  normalizeVisitorRegistrationInput,
  normalizeVisitorRevocationReason,
  normalizeVisitorSourceChannel,
} from "./core.mjs";

const { Pool } = pg;
let pool;

const DEFAULT_VISITOR_RULE =
  "Visitors must remain within their registered host site and approved visit window unless campground staff direct otherwise.";

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required for visitor registration operations.",
      );
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

export async function closeVisitorRegistrationPoolForTests() {
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
  const [read, register, paymentRead, paymentCapture, configure, pricing] =
    await Promise.all([
      hasCampgroundPermission(userId, campgroundId, "visitor.read"),
      hasCampgroundPermission(userId, campgroundId, "visitor.register"),
      hasCampgroundPermission(userId, campgroundId, "payment.read"),
      hasCampgroundPermission(userId, campgroundId, "payment.capture"),
      hasCampgroundPermission(userId, campgroundId, "campground.configuration"),
      hasCampgroundPermission(userId, campgroundId, "pricing.manage"),
    ]);

  return { read, register, paymentRead, paymentCapture, configure, pricing };
}

async function assertVisitorRead(userId, campgroundId) {
  const value = await permissions(userId, campgroundId);
  if (!value.read && !value.register && !value.paymentRead) {
    throw new Error("Not authorized to read visitor registrations.");
  }
  return value;
}

async function assertVisitorRegister(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "visitor.register"))
  ) {
    throw new Error("Visitor registration permission is required.");
  }
}

async function assertVisitorPolicyManage(userId, campgroundId) {
  const [configure, pricing] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "campground.configuration"),
    hasCampgroundPermission(userId, campgroundId, "pricing.manage"),
  ]);
  if (!configure || !pricing) {
    throw new Error(
      "Campground configuration and pricing permissions are required to manage visitor policy.",
    );
  }
}

async function assertVisitorPayment(userId, campgroundId) {
  const [register, capture] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "visitor.register"),
    hasCampgroundPermission(userId, campgroundId, "payment.capture"),
  ]);
  if (!register || !capture) {
    throw new Error(
      "Visitor registration and payment capture permissions are required.",
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
    throw new Error("Visitor registration idempotency key is invalid.");
  }
  return key;
}

function makeVisitorNumber() {
  return "VR-" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function mapPolicy(row) {
  if (!row) {
    return {
      id: null,
      dayVisitChargeId: null,
      weekVisitChargeId: null,
      identityVerificationMode: "host_attested",
      contactRequirement: "either",
      visitorRule: DEFAULT_VISITOR_RULE,
      rowVersion: 0,
      persisted: false,
    };
  }

  return {
    id: row.id,
    dayVisitChargeId: row.day_visit_charge_id ?? null,
    weekVisitChargeId: row.week_visit_charge_id ?? null,
    identityVerificationMode: row.identity_verification_mode,
    contactRequirement: row.contact_requirement,
    visitorRule: row.visitor_rule,
    rowVersion: Number(row.row_version),
    persisted: true,
  };
}

function mapCharge(row) {
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    currencyCode: row.currency_code,
    unitPriceCents: Number(row.unit_price_cents),
    passDurationDays: Number(row.pass_duration_days),
  };
}

function mapRegistration(row) {
  return {
    id: row.id,
    visitorNumber: row.visitor_number,
    reservationId: row.reservation_id,
    hostAccommodationId: row.host_accommodation_id,
    hostAccommodationLabel: row.host_accommodation_label,
    visitorName: row.visitor_name,
    contactPhone: row.contact_phone ?? null,
    contactEmail: row.contact_email ?? null,
    identityVerificationMode: row.identity_verification_mode_snapshot,
    identityVerifiedAt: iso(row.identity_verified_at),
    contactRequirement: row.contact_requirement_snapshot,
    visitKind: row.visit_kind,
    validFrom: iso(row.valid_from),
    validUntil: iso(row.valid_until),
    effectiveMaxVisitors:
      row.effective_max_visitors == null
        ? null
        : Number(row.effective_max_visitors),
    capacityRuleId: row.capacity_rule_id ?? null,
    capacityRuleScope: row.capacity_rule_scope_snapshot ?? null,
    sourceChargeId: row.source_charge_id ?? null,
    feeAmountCents: Number(row.fee_amount_cents),
    currencyCode: row.currency_code,
    paymentState: row.payment_state,
    registrationStatus: row.registration_status,
    effectiveStatus:
      row.effective_status ??
      effectiveVisitorStatus({
        registrationStatus: row.registration_status,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
      }),
    visitorRuleSnapshot: row.visitor_rule_snapshot,
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
    visitorRegistrationId: row.visitor_registration_id,
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
    "select id,organization_id,display_name,time_zone," +
      "to_char(statement_timestamp() at time zone time_zone," +
      " 'YYYY-MM-DD\"T\"HH24:MI') local_datetime," +
      "(statement_timestamp() at time zone time_zone)::date local_date " +
      "from public.campgrounds where id=$1 limit 1",
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground was not found.");
  }
  return result.rows[0];
}

async function policyRow(client, campgroundId) {
  const result = await client.query(
    "select * from public.campground_visitor_policies " +
      "where campground_id=$1 limit 1",
    [campgroundId],
  );
  return result.rows[0] ?? null;
}

async function chargeRow(client, campgroundId, chargeId) {
  if (!chargeId) return null;
  const result = await client.query(
    "select * from public.booking_charge_catalog " +
      "where campground_id=$1 and id=$2 and is_active limit 1",
    [campgroundId, chargeId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Configured visitor charge is unavailable.");
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
    "insert into public.visitor_registration_events (" +
      "organization_id,campground_id,visitor_registration_id,event_kind," +
      "prior_status,new_status,reason,source_channel,actor_user_id" +
      ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
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

export async function listVisitorRegistrationDesk({ userId, campgroundId }) {
  const allowed = await assertVisitorRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);
    const campground = await campgroundScope(client, campgroundId);

    const [policyResult, chargesResult, registrationsResult] =
      await Promise.all([
        client.query(
          "select * from public.campground_visitor_policies " +
            "where campground_id=$1 limit 1",
          [campgroundId],
        ),
        client.query(
          "select id,code,display_name,currency_code,unit_price_cents," +
            "pass_duration_days from public.booking_charge_catalog " +
            "where campground_id=$1 and is_active and charge_kind='pass' " +
            "and pricing_basis<>'percent_of_stay' and unit_price_cents is not null " +
            "and pass_duration_days in (1,7) order by pass_duration_days,display_name",
          [campgroundId],
        ),
        client.query(
          "select v.*,case " +
            "when v.registration_status='active' and statement_timestamp()<v.valid_from then 'scheduled' " +
            "when v.registration_status='active' and statement_timestamp()>v.valid_until then 'expired' " +
            "else v.registration_status end effective_status," +
            "(select p.payment_state from public.visitor_registration_payments p " +
            "where p.visitor_registration_id=v.id order by p.created_at desc limit 1) latest_payment_state " +
            "from public.visitor_registrations v where v.campground_id=$1 " +
            "order by case when v.registration_status in ('pending_payment','active') " +
            "and v.valid_until>=statement_timestamp() then 0 else 1 end," +
            "v.valid_until desc,v.created_at desc limit 500",
          [campgroundId],
        ),
      ]);

    let reservations = [];
    if (allowed.register) {
      const reservationResult = await client.query(
        "select r.id,r.accommodation_id,r.arrival_date,r.departure_date,r.status," +
          "r.external_reference,a.code accommodation_code,a.display_name accommodation_name," +
          "lim.max_visitors,lim.rule_id capacity_rule_id,lim.scope_kind capacity_scope," +
          "(select count(*)::integer from public.visitor_registrations open_v " +
          "where open_v.campground_id=r.campground_id " +
          "and open_v.host_accommodation_id=r.accommodation_id " +
          "and open_v.registration_status in ('pending_payment','active') " +
          "and open_v.valid_until>statement_timestamp()) current_open_visitors " +
          "from public.reservations r " +
          "join public.accommodations a on a.organization_id=r.organization_id " +
          "and a.campground_id=r.campground_id and a.id=r.accommodation_id " +
          "left join lateral icamp_private.resolve_visitor_limit(" +
          "r.campground_id,r.accommodation_id) lim on true " +
          "where r.campground_id=$1 and r.status in ('pending','confirmed','checked_in') " +
          "and r.departure_date >= (statement_timestamp() at time zone $2)::date " +
          "order by r.arrival_date,a.code limit 500",
        [campgroundId, campground.time_zone],
      );

      reservations = reservationResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        status: row.status,
        externalReference: row.external_reference ?? null,
        effectiveMaxVisitors:
          row.max_visitors == null ? null : Number(row.max_visitors),
        capacityRuleId: row.capacity_rule_id ?? null,
        capacityRuleScope: row.capacity_scope ?? null,
        currentOpenVisitors: Number(row.current_open_visitors),
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
      reservations,
      registrations: registrationsResult.rows.map(mapRegistration),
      canRegister: allowed.register,
      canCapturePayment: allowed.register && allowed.paymentCapture,
      canManagePolicy: allowed.configure && allowed.pricing,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveVisitorPolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  input = {},
}) {
  await assertVisitorPolicyManage(actorUserId, campgroundId);
  const value = normalizeVisitorPolicyInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("Visitor policy row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const existing = await client.query(
      "select * from public.campground_visitor_policies " +
        "where campground_id=$1 limit 1 for update",
      [campgroundId],
    );
    const before = existing.rows[0] ?? null;
    let saved;

    if (before) {
      if (Number(before.row_version) !== expected) {
        throw new Error(
          "Visitor policy changed since this page loaded. Refresh and try again.",
        );
      }

      const updated = await client.query(
        "update public.campground_visitor_policies set " +
          "day_visit_charge_id=$3,week_visit_charge_id=$4," +
          "identity_verification_mode=$5,contact_requirement=$6," +
          "visitor_rule=$7,updated_by_user_id=$8 " +
          "where campground_id=$1 and organization_id=$2 and row_version=$9 " +
          "returning *",
        [
          campgroundId,
          campground.organization_id,
          value.dayVisitChargeId,
          value.weekVisitChargeId,
          value.identityVerificationMode,
          value.contactRequirement,
          value.visitorRule,
          actorUserId,
          expected,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Visitor policy changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
    } else {
      if (expected !== 0) {
        throw new Error(
          "Visitor policy changed since this page loaded. Refresh and try again.",
        );
      }

      const inserted = await client.query(
        "insert into public.campground_visitor_policies (" +
          "organization_id,campground_id,day_visit_charge_id,week_visit_charge_id," +
          "identity_verification_mode,contact_requirement,visitor_rule,updated_by_user_id" +
          ") values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
        [
          campground.organization_id,
          campgroundId,
          value.dayVisitChargeId,
          value.weekVisitChargeId,
          value.identityVerificationMode,
          value.contactRequirement,
          value.visitorRule,
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
      actionKey: "visitor.policy.update",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground_visitor_policy",
      subjectId: saved.id,
      beforeState: before ? mapPolicy(before) : null,
      afterState: mapPolicy(saved),
      metadata: {
        pricingPermissionRequired: true,
        sensitiveGovernmentIdStorage: false,
        credentialBoundary: "Build 056",
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

async function visitorPricing(client, campgroundId, visitKind, policy) {
  const chargeId =
    visitKind === "day"
      ? policy?.day_visit_charge_id
      : policy?.week_visit_charge_id;
  const charge = await chargeRow(client, campgroundId, chargeId);

  return {
    sourceChargeId: charge?.id ?? null,
    feeAmountCents: charge ? Number(charge.unit_price_cents) : 0,
    currencyCode: charge?.currency_code ?? "CAD",
  };
}

function initialFinancialState(feeAmountCents) {
  return feeAmountCents > 0
    ? { paymentState: "unpaid", registrationStatus: "pending_payment" }
    : { paymentState: "not_required", registrationStatus: "active" };
}

export async function createVisitorRegistration({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
}) {
  await assertVisitorRegister(actorUserId, campgroundId);
  const value = normalizeVisitorRegistrationInput(input);
  const channel = normalizeVisitorSourceChannel(sourceChannel);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);

    const existing = await client.query(
      "select * from public.visitor_registrations " +
        "where campground_id=$1 and idempotency_key=$2 limit 1",
      [campgroundId, key],
    );
    if (existing.rowCount === 1) {
      await client.query("commit");
      return {
        registration: mapRegistration(existing.rows[0]),
        idempotent: true,
      };
    }

    const campground = await campgroundScope(client, campgroundId);
    const policy = await policyRow(client, campgroundId);
    const effectivePolicy = mapPolicy(policy);

    assertVisitorContactRequirement(effectivePolicy.contactRequirement, value);
    if (
      effectivePolicy.identityVerificationMode !== "none" &&
      !value.identityVerified
    ) {
      throw new Error(
        "Confirm the configured visitor identity verification before registration.",
      );
    }

    const reservationResult = await client.query(
      "select r.*,a.code accommodation_code,a.display_name accommodation_name " +
        "from public.reservations r join public.accommodations a " +
        "on a.organization_id=r.organization_id " +
        "and a.campground_id=r.campground_id and a.id=r.accommodation_id " +
        "where r.campground_id=$1 and r.id=$2 " +
        "and r.status in ('pending','confirmed','checked_in') limit 1",
      [campgroundId, value.reservationId],
    );
    if (reservationResult.rowCount !== 1) {
      throw new Error(
        "Host reservation is unavailable for visitor registration.",
      );
    }
    const reservation = reservationResult.rows[0];

    const limitResult = await client.query(
      "select * from icamp_private.resolve_visitor_limit($1,$2)",
      [campgroundId, reservation.accommodation_id],
    );
    const limit = limitResult.rows[0] ?? null;
    const pricing = await visitorPricing(
      client,
      campgroundId,
      value.visitKind,
      policy,
    );
    const states = initialFinancialState(pricing.feeAmountCents);

    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "visitor-registration:" +
        campgroundId +
        ":" +
        reservation.accommodation_id,
    ]);

    const inserted = await client.query(
      "insert into public.visitor_registrations (" +
        "organization_id,campground_id,visitor_number,reservation_id," +
        "host_accommodation_id,host_accommodation_label,visitor_name," +
        "contact_phone,contact_email,identity_verification_mode_snapshot," +
        "identity_verified_at,identity_verified_by_user_id,contact_requirement_snapshot," +
        "visit_kind,valid_from,valid_until,effective_max_visitors,capacity_rule_id," +
        "capacity_rule_scope_snapshot,source_charge_id,fee_amount_cents,currency_code," +
        "payment_state,registration_status,visitor_rule_snapshot,source_channel,notes," +
        "idempotency_key,registered_by_user_id,updated_by_user_id" +
        ") values (" +
        "$1,$2,$3,$4,$5,$6,$7,$8,$9,$10," +
        "case when $10='none' then null else statement_timestamp() end," +
        "case when $10='none' then null else $11::uuid end,$12,$13," +
        "($14::timestamp at time zone $15),($16::timestamp at time zone $15)," +
        "$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$11,$11" +
        ") returning *",
      [
        campground.organization_id,
        campgroundId,
        makeVisitorNumber(),
        reservation.id,
        reservation.accommodation_id,
        reservation.accommodation_code + " · " + reservation.accommodation_name,
        value.visitorName,
        value.contactPhone,
        value.contactEmail,
        effectivePolicy.identityVerificationMode,
        actorUserId,
        effectivePolicy.contactRequirement,
        value.visitKind,
        value.validFromLocal,
        campground.time_zone,
        value.validUntilLocal,
        limit?.max_visitors == null ? null : Number(limit.max_visitors),
        limit?.rule_id ?? null,
        limit?.scope_kind ?? null,
        pricing.sourceChargeId,
        pricing.feeAmountCents,
        pricing.currencyCode,
        states.paymentState,
        states.registrationStatus,
        effectivePolicy.visitorRule,
        channel,
        value.notes,
        key,
      ],
    );
    const row = inserted.rows[0];

    await lifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "registered",
      priorStatus: null,
      newStatus: row.registration_status,
      sourceChannel: channel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "visitor.registration.register",
      permissionKey: "visitor.register",
      riskLevel: "standard",
      subjectType: "visitor_registration",
      subjectId: row.id,
      beforeState: null,
      afterState: {
        visitorNumber: row.visitor_number,
        reservationId: row.reservation_id,
        hostAccommodationId: row.host_accommodation_id,
        visitKind: row.visit_kind,
        validFrom: iso(row.valid_from),
        validUntil: iso(row.valid_until),
        effectiveMaxVisitors:
          row.effective_max_visitors == null
            ? null
            : Number(row.effective_max_visitors),
        feeAmountCents: Number(row.fee_amount_cents),
        currencyCode: row.currency_code,
        paymentState: row.payment_state,
        status: row.registration_status,
      },
      metadata: {
        sourceChannel: channel,
        identityVerificationMode: row.identity_verification_mode_snapshot,
        governmentIdNumberStored: false,
        credentialBoundary: "Build 056/062/063",
        accessRuleBoundary: "Build 060",
      },
    });

    await client.query("commit");
    return { registration: mapRegistration(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (
      String(error?.message ?? "").includes(
        "Visitor registration would exceed the effective site-specific visitor limit",
      )
    ) {
      throw new Error(
        "This visitor would exceed the effective visitor limit for the host site during the selected visit window.",
      );
    }
    if (error?.code === "23505") {
      throw new Error(
        "This visitor registration was already submitted. Refresh the visitor desk.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeVisitorRegistration({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  visitorRegistrationId,
  expectedRowVersion,
  reason,
  sourceChannel = "staff",
}) {
  await assertVisitorRegister(actorUserId, campgroundId);
  const registrationId = requiredId(
    visitorRegistrationId,
    "Visitor registration",
  );
  const revocationReason = normalizeVisitorRevocationReason(reason);
  const channel = normalizeVisitorSourceChannel(sourceChannel);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Visitor registration row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const current = await client.query(
      "select * from public.visitor_registrations " +
        "where campground_id=$1 and id=$2 for update",
      [campgroundId, registrationId],
    );
    if (current.rowCount !== 1) {
      throw new Error("Visitor registration was not found.");
    }
    const before = current.rows[0];

    if (before.registration_status === "revoked") {
      await client.query("commit");
      return {
        registration: mapRegistration(before),
        idempotent: true,
      };
    }

    const updated = await client.query(
      "update public.visitor_registrations set " +
        "registration_status='revoked',revoked_at=statement_timestamp()," +
        "revocation_reason=$3,updated_by_user_id=$4 " +
        "where campground_id=$1 and id=$2 and row_version=$5 returning *",
      [campgroundId, registrationId, revocationReason, actorUserId, expected],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Visitor registration changed since this page loaded. Refresh and try again.",
      );
    }
    const row = updated.rows[0];

    await lifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "revoked",
      priorStatus: before.registration_status,
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
      actionKey: "visitor.registration.revoke",
      permissionKey: "visitor.register",
      riskLevel: "standard",
      subjectType: "visitor_registration",
      subjectId: row.id,
      beforeState: {
        status: before.registration_status,
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
    return { registration: mapRegistration(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function startVisitorRegistrationPayment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  visitorRegistrationId,
  provider,
}) {
  await assertVisitorPayment(actorUserId, campgroundId);
  if (
    !provider ||
    typeof provider.createPayment !== "function" ||
    typeof provider.capturePayment !== "function"
  ) {
    throw new Error("Payment provider adapter is required.");
  }

  const registrationId = requiredId(
    visitorRegistrationId,
    "Visitor registration",
  );
  const client = await getPool().connect();
  let payment;

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "visitor-registration-payment:" + registrationId,
    ]);

    const registrationResult = await client.query(
      "select * from public.visitor_registrations " +
        "where campground_id=$1 and id=$2 limit 1 for update",
      [campgroundId, registrationId],
    );
    if (registrationResult.rowCount !== 1) {
      throw new Error("Visitor registration was not found.");
    }
    const registration = registrationResult.rows[0];

    if (registration.payment_state === "captured") {
      await client.query("commit");
      return {
        registration: mapRegistration(registration),
        payment: null,
        alreadySatisfied: true,
      };
    }

    if (
      registration.fee_amount_cents <= 0 ||
      registration.payment_state !== "unpaid" ||
      registration.registration_status !== "pending_payment"
    ) {
      throw new Error("Visitor registration does not have a payable open fee.");
    }

    const active = await client.query(
      "select * from public.visitor_registration_payments " +
        "where visitor_registration_id=$1 " +
        "and payment_state in ('created','submitted','authorized') " +
        "order by created_at desc limit 1 for update",
      [registrationId],
    );
    if (active.rowCount === 1) {
      await client.query("commit");
      return {
        registration: mapRegistration(registration),
        payment: mapPayment(active.rows[0]),
        alreadySatisfied: false,
        active: true,
      };
    }

    const count = await client.query(
      "select count(*)::integer count from public.visitor_registration_payments " +
        "where visitor_registration_id=$1",
      [registrationId],
    );
    const attempt = Number(count.rows[0].count) + 1;
    const idempotencyKey =
      "visitor-registration:" + registrationId + ":attempt:" + attempt;

    const inserted = await client.query(
      "insert into public.visitor_registration_payments (" +
        "organization_id,campground_id,visitor_registration_id,provider_key," +
        "idempotency_key,amount_cents,currency_code,created_by_user_id" +
        ") values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      [
        registration.organization_id,
        campgroundId,
        registrationId,
        provider.providerKey,
        idempotencyKey,
        Number(registration.fee_amount_cents),
        registration.currency_code,
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
      "update public.visitor_registration_payments set " +
        "payment_state='failed',last_error_code='provider_create_failed'," +
        "failed_at=statement_timestamp() " +
        "where id=$1 and payment_state='created'",
      [payment.id],
    );
    throw error;
  }

  await getPool().query(
    "update public.visitor_registration_payments set " +
      "provider_payment_reference=$2,payment_state='submitted' " +
      "where id=$1 and payment_state='created'",
    [payment.id, created.providerPaymentReference],
  );

  const event = await provider.capturePayment({
    paymentId: payment.id,
    providerPaymentReference: created.providerPaymentReference,
    amountCents: payment.amountCents,
    currencyCode: payment.currencyCode,
  });

  return ingestVisitorRegistrationPaymentProviderEvent({
    event,
    actorSessionId,
  });
}

export async function ingestVisitorRegistrationPaymentProviderEvent({
  event,
  actorSessionId = null,
}) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const lookup = await client.query(
      "select p.*,v.registration_status," +
        "v.payment_state registration_payment_state " +
        "from public.visitor_registration_payments p " +
        "join public.visitor_registrations v on v.id=p.visitor_registration_id " +
        "where p.provider_key=$1 and p.provider_payment_reference=$2 " +
        "limit 1 for update of p,v",
      [event.providerKey, event.providerPaymentReference],
    );
    if (lookup.rowCount !== 1) {
      throw new Error(
        "Payment provider event does not match a visitor registration payment.",
      );
    }

    const row = lookup.rows[0];
    if (
      Number(row.amount_cents) !== Number(event.amountCents) ||
      row.currency_code !== event.currencyCode
    ) {
      throw new Error(
        "Payment provider event amount does not match visitor registration fee.",
      );
    }

    const inserted = await client.query(
      "insert into icamp_private.visitor_registration_payment_provider_events (" +
        "provider_key,provider_event_id,payment_id,event_type,event_status," +
        "metadata,occurred_at" +
        ") values ($1,$2,$3,$4,$5,$6::jsonb,$7) " +
        "on conflict (provider_key,provider_event_id) do nothing returning id",
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
      const current = await client.query(
        "select * from public.visitor_registrations where id=$1",
        [row.visitor_registration_id],
      );
      await client.query("commit");
      return {
        duplicate: true,
        registration: mapRegistration(current.rows[0]),
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
      "update public.visitor_registration_payments set payment_state=$2," +
        "authorized_at=case when $2='authorized' " +
        "then coalesce(authorized_at,$3::timestamptz) else authorized_at end," +
        "captured_at=case when $2='captured' " +
        "then coalesce(captured_at,$3::timestamptz) else captured_at end," +
        "failed_at=case when $2='failed' " +
        "then coalesce(failed_at,$3::timestamptz) else failed_at end," +
        "last_error_code=case when $2='failed' then 'provider_failed' " +
        "else last_error_code end where id=$1 returning *",
      [row.id, nextState, event.occurredAt],
    );

    const registrationResult = await client.query(
      "select * from public.visitor_registrations where id=$1 for update",
      [row.visitor_registration_id],
    );
    let registration = registrationResult.rows[0];

    if (
      nextState === "captured" &&
      registration.payment_state === "unpaid" &&
      registration.registration_status === "pending_payment"
    ) {
      const activated = await client.query(
        "update public.visitor_registrations set " +
          "payment_state='captured',registration_status='active'," +
          "updated_by_user_id=$2 where id=$1 returning *",
        [registration.id, row.created_by_user_id],
      );
      registration = activated.rows[0];

      await lifecycleEvent(client, {
        row: registration,
        actorUserId: row.created_by_user_id,
        eventKind: "payment_captured",
        priorStatus: "pending_payment",
        newStatus: "active",
        sourceChannel: "system",
      });

      await appendAuditEvent(client, {
        actorUserId: row.created_by_user_id,
        actorSessionId,
        organizationId: registration.organization_id,
        campgroundId: registration.campground_id,
        actionKey: "visitor.registration.payment.capture",
        permissionKey: "payment.capture",
        riskLevel: "standard",
        subjectType: "visitor_registration",
        subjectId: registration.id,
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
      registration: mapRegistration(registration),
      payment: mapPayment(paymentUpdate.rows[0]),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
