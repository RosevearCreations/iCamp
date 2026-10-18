import { randomUUID } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  credentialSubjectKindForLink,
  credentialTypeForPresentation,
  effectivePassValidationStatus,
  fingerprintPassValidationToken,
  formatQrPassPayload,
  generatePassValidationToken,
  maskPassValidationHint,
  normalizeAccessPassInput,
  normalizePassRevocationReason,
  normalizePassSourceChannel,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for access pass operations.");
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

export async function closeAccessPassPoolForTests() {
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

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error(permission + " permission is required.");
  }
}

function normalizeIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 8 || key.length > 200) {
    throw new Error("Access pass idempotency key is invalid.");
  }
  return key;
}

function makeCredentialNumber() {
  return "AC-" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function makePassNumber() {
  return "AP-" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function mapPass(row) {
  return {
    id: row.id,
    passNumber: row.pass_number,
    credentialId: row.credential_id,
    presentationKind: row.presentation_kind,
    linkKind: row.link_kind,
    visitorRegistrationId: row.visitor_registration_id ?? null,
    vehiclePassId: row.vehicle_pass_id ?? null,
    eventReference: row.event_reference ?? null,
    dayUseReference: row.day_use_reference ?? null,
    subjectLabel: row.subject_label,
    validationHint: row.validation_hint,
    sourceChannel: row.source_channel,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function validationContextForPass(row, now) {
  if (row.link_kind === "visitor") {
    return {
      sourceActive:
        row.visitor_registration_status === "active" &&
        new Date(row.visitor_valid_from) <= now &&
        new Date(row.visitor_valid_until) >= now,
      accessContext: {
        subjectKind: "visitor",
        activeStay: false,
        eventReference: null,
      },
    };
  }

  if (row.link_kind === "vehicle_pass") {
    return {
      sourceActive:
        row.vehicle_pass_status === "active" &&
        new Date(row.vehicle_valid_from) <= now &&
        new Date(row.vehicle_valid_until) >= now,
      accessContext: {
        subjectKind: "guest",
        activeStay: false,
        eventReference: null,
      },
    };
  }

  if (row.link_kind === "event") {
    return {
      sourceActive: true,
      accessContext: {
        subjectKind: "event",
        activeStay: false,
        eventReference: row.event_reference,
      },
    };
  }

  return {
    sourceActive: true,
    accessContext: {
      subjectKind: "guest",
      activeStay: false,
      eventReference: null,
    },
  };
}

export async function issueAccessPass({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "access.credential.issue",
  );

  const value = normalizeAccessPassInput(input);
  const channel = normalizePassSourceChannel(sourceChannel);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const validationToken = generatePassValidationToken();
  const validationFingerprint =
    fingerprintPassValidationToken(validationToken);
  const validationHint = maskPassValidationHint(validationToken);
  const credentialType = credentialTypeForPresentation(
    value.presentationKind,
  );
  const credentialSubjectKind = credentialSubjectKindForLink(value.linkKind);
  const credentialSubjectReferenceId =
    value.visitorRegistrationId ?? value.vehiclePassId ?? null;
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);

    const existing = await client.query(
      `select p.*,c.valid_from,c.valid_until,c.status credential_status
       from public.access_passes p
       join public.access_credentials c
         on c.organization_id=p.organization_id
        and c.campground_id=p.campground_id
        and c.id=p.credential_id
       where p.campground_id=$1
         and p.idempotency_key=$2
       limit 1`,
      [campgroundId, key],
    );

    if (existing.rowCount === 1) {
      await client.query("commit");
      return {
        pass: mapPass(existing.rows[0]),
        idempotent: true,
        validationToken: null,
        qrPayload: null,
        bearerSecretAvailable: false,
      };
    }

    const scope = await client.query(
      "select organization_id from public.campgrounds where id=$1 limit 1",
      [campgroundId],
    );
    if (scope.rowCount !== 1) {
      throw new Error("Campground scope is unavailable.");
    }

    const organizationId = scope.rows[0].organization_id;
    const credentialNumber = makeCredentialNumber();
    const passNumber = makePassNumber();

    const credentialResult = await client.query(
      `insert into public.access_credentials (
         organization_id,campground_id,credential_number,credential_type,
         subject_kind,subject_reference_id,subject_label,secret_fingerprint,
         display_hint,status,valid_from,valid_until,issued_by_user_id
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12
       ) returning *`,
      [
        organizationId,
        campgroundId,
        credentialNumber,
        credentialType,
        credentialSubjectKind,
        credentialSubjectReferenceId,
        value.subjectLabel,
        value.presentationKind === "qr_code" ? validationFingerprint : null,
        validationHint,
        value.validFrom,
        value.validUntil,
        actorUserId,
      ],
    );
    const credential = credentialResult.rows[0];

    await client.query(
      `insert into public.access_credential_events (
         organization_id,campground_id,credential_id,event_kind,
         actor_user_id,reason,event_metadata
       ) values ($1,$2,$3,'issued',$4,$5,$6::jsonb)`,
      [
        organizationId,
        campgroundId,
        credential.id,
        actorUserId,
        "Build 061 access pass issued",
        JSON.stringify({
          presentationKind: value.presentationKind,
          linkKind: value.linkKind,
          rawValidationTokenStored: false,
        }),
      ],
    );

    const passResult = await client.query(
      `insert into public.access_passes (
         organization_id,campground_id,pass_number,credential_id,
         presentation_kind,link_kind,visitor_registration_id,vehicle_pass_id,
         event_reference,day_use_reference,subject_label,
         validation_fingerprint,validation_hint,source_channel,
         idempotency_key,issued_by_user_id
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
       ) returning *`,
      [
        organizationId,
        campgroundId,
        passNumber,
        credential.id,
        value.presentationKind,
        value.linkKind,
        value.visitorRegistrationId,
        value.vehiclePassId,
        value.eventReference,
        value.dayUseReference,
        value.subjectLabel,
        validationFingerprint,
        validationHint,
        channel,
        key,
        actorUserId,
      ],
    );
    const pass = passResult.rows[0];

    await client.query(
      `insert into public.access_pass_events (
         organization_id,campground_id,pass_id,event_kind,
         actor_user_id,source_channel,reason,event_metadata
       ) values ($1,$2,$3,'issued',$4,$5,$6,$7::jsonb)`,
      [
        organizationId,
        campgroundId,
        pass.id,
        actorUserId,
        channel,
        "Access pass bearer presentation issued",
        JSON.stringify({
          presentationKind: value.presentationKind,
          linkKind: value.linkKind,
          rawValidationTokenStored: false,
        }),
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "access.pass.issue",
      permissionKey: "access.credential.issue",
      riskLevel: "standard",
      subjectType: "access_pass",
      subjectId: pass.id,
      beforeState: null,
      afterState: {
        passNumber: pass.pass_number,
        credentialId: credential.id,
        presentationKind: value.presentationKind,
        linkKind: value.linkKind,
        validationHint,
      },
      metadata: {
        rawValidationTokenStored: false,
        validationTokenReturnedOnce: true,
      },
    });

    await client.query("commit");

    return {
      pass: mapPass(pass),
      idempotent: false,
      validationToken,
      qrPayload:
        value.presentationKind === "qr_code"
          ? formatQrPassPayload(validationToken)
          : null,
      bearerSecretAvailable: true,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function validateAccessPass({
  campgroundId,
  presentedValue,
  sourceChannel = "system",
  now = new Date(),
}) {
  const channel = normalizePassSourceChannel(sourceChannel);
  let fingerprint;
  try {
    fingerprint = fingerprintPassValidationToken(presentedValue);
  } catch {
    return {
      valid: false,
      status: "invalid",
      pass: null,
      accessContext: null,
    };
  }
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) {
    throw new Error("Validation time is invalid.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `select
         p.*,
         c.status credential_status,
         c.valid_from credential_valid_from,
         c.valid_until credential_valid_until,
         vr.registration_status visitor_registration_status,
         vr.valid_from visitor_valid_from,
         vr.valid_until visitor_valid_until,
         vp.pass_status vehicle_pass_status,
         vp.valid_from vehicle_valid_from,
         vp.valid_until vehicle_valid_until
       from public.access_passes p
       join public.access_credentials c
         on c.organization_id=p.organization_id
        and c.campground_id=p.campground_id
        and c.id=p.credential_id
       left join public.visitor_registrations vr
         on vr.organization_id=p.organization_id
        and vr.campground_id=p.campground_id
        and vr.id=p.visitor_registration_id
       left join public.vehicle_passes vp
         on vp.organization_id=p.organization_id
        and vp.campground_id=p.campground_id
        and vp.id=p.vehicle_pass_id
       where p.campground_id=$1
         and p.validation_fingerprint=$2
       limit 1
       for update of p`,
      [campgroundId, fingerprint],
    );

    if (result.rowCount !== 1) {
      await client.query("commit");
      return {
        valid: false,
        status: "invalid",
        pass: null,
        accessContext: null,
      };
    }

    const row = result.rows[0];
    const source = validationContextForPass(row, current);
    const status = effectivePassValidationStatus({
      credentialStatus: row.credential_status,
      validFrom: row.credential_valid_from,
      validUntil: row.credential_valid_until,
      sourceActive: source.sourceActive,
      now: current,
    });
    const valid = status === "valid";

    await client.query(
      `insert into public.access_pass_events (
         organization_id,campground_id,pass_id,event_kind,
         validation_outcome,source_channel,reason,event_metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        row.organization_id,
        campgroundId,
        row.id,
        valid ? "validated" : "validation_denied",
        status,
        channel,
        valid ? "Bearer presentation validated" : "Bearer presentation denied",
        JSON.stringify({
          presentationKind: row.presentation_kind,
          linkKind: row.link_kind,
          rawValidationTokenStored: false,
        }),
      ],
    );

    if (status === "expired") {
      await client.query(
        `insert into public.access_pass_events (
           organization_id,campground_id,pass_id,event_kind,
           source_channel,reason,event_metadata
         ) values ($1,$2,$3,'expired_observed',$4,$5,$6::jsonb)
         on conflict do nothing`,
        [
          row.organization_id,
          campgroundId,
          row.id,
          channel,
          "Pass expiry observed during validation",
          JSON.stringify({ rawValidationTokenStored: false }),
        ],
      );
    }

    await client.query("commit");

    return {
      valid,
      status,
      pass: {
        ...mapPass(row),
        validFrom: new Date(row.credential_valid_from).toISOString(),
        validUntil: new Date(row.credential_valid_until).toISOString(),
      },
      accessContext: valid ? source.accessContext : null,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeAccessPass({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  passId,
  reason,
  sourceChannel = "staff",
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "access.credential.revoke",
  );

  const normalizedReason = normalizePassRevocationReason(reason);
  const channel = normalizePassSourceChannel(sourceChannel);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);

    const result = await client.query(
      `select p.*,c.status credential_status,c.row_version credential_row_version
       from public.access_passes p
       join public.access_credentials c
         on c.organization_id=p.organization_id
        and c.campground_id=p.campground_id
        and c.id=p.credential_id
       where p.campground_id=$1
         and p.id=$2
       limit 1
       for update of c`,
      [campgroundId, passId],
    );

    if (result.rowCount !== 1) {
      throw new Error("Access pass was not found.");
    }

    const pass = result.rows[0];
    if (pass.credential_status === "revoked") {
      await client.query("commit");
      return { pass: mapPass(pass), idempotent: true };
    }

    await client.query(
      `update public.access_credentials
       set status='revoked',
           revoked_at=statement_timestamp(),
           revoked_by_user_id=$3,
           revocation_reason=$4
       where campground_id=$1
         and id=$2`,
      [campgroundId, pass.credential_id, actorUserId, normalizedReason],
    );

    await client.query(
      `insert into public.access_credential_events (
         organization_id,campground_id,credential_id,event_kind,
         actor_user_id,reason,event_metadata
       ) values ($1,$2,$3,'revoked',$4,$5,$6::jsonb)`,
      [
        pass.organization_id,
        campgroundId,
        pass.credential_id,
        actorUserId,
        normalizedReason,
        JSON.stringify({ accessPassId: pass.id }),
      ],
    );

    await client.query(
      `insert into public.access_pass_events (
         organization_id,campground_id,pass_id,event_kind,
         actor_user_id,source_channel,reason,event_metadata
       ) values ($1,$2,$3,'revoked',$4,$5,$6,$7::jsonb)`,
      [
        pass.organization_id,
        campgroundId,
        pass.id,
        actorUserId,
        channel,
        normalizedReason,
        JSON.stringify({ credentialId: pass.credential_id }),
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: pass.organization_id,
      campgroundId,
      actionKey: "access.pass.revoke",
      permissionKey: "access.credential.revoke",
      riskLevel: "standard",
      subjectType: "access_pass",
      subjectId: pass.id,
      beforeState: {
        credentialStatus: pass.credential_status,
      },
      afterState: {
        credentialStatus: "revoked",
        reason: normalizedReason,
      },
      metadata: {
        presentationKind: pass.presentation_kind,
        linkKind: pass.link_kind,
      },
    });

    await client.query("commit");
    return { pass: mapPass(pass), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
