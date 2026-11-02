import { randomUUID } from "node:crypto";

import pg from "pg";

import {
  fingerprintCredentialSecret,
  generateCredentialSecret,
  maskCredentialHint,
} from "../access-credentials/core.mjs";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  classifyCredentialValidityChange,
  credentialNeedsGeneratedSecret,
  normalizeCredentialLifecycleReason,
  normalizeCredentialLifecycleSourceChannel,
  normalizeReservationCredentialProvisionInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required for reservation credential lifecycle operations.",
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

export async function closeCredentialLifecyclePoolForTests() {
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
    throw new Error("Credential lifecycle idempotency key is invalid.");
  }
  return key;
}

function makeCredentialNumber() {
  return "AC-" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

async function lifecycleContext(client, campgroundId, reservationId) {
  const result = await client.query(
    `select
       r.id reservation_id,
       r.organization_id,
       r.campground_id,
       r.status reservation_status,
       r.departure_date,
       c.timezone campground_timezone,
       ci.id check_in_id,
       coalesce(p.checkout_local_time,'11:00'::time) checkout_local_time,
       coalesce(p.grace_minutes,0)::integer grace_minutes
     from public.reservations r
     join public.campgrounds c
       on c.organization_id=r.organization_id
      and c.id=r.campground_id
     left join public.reservation_check_ins ci
       on ci.organization_id=r.organization_id
      and ci.campground_id=r.campground_id
      and ci.reservation_id=r.id
     left join public.campground_credential_lifecycle_policies p
       on p.organization_id=r.organization_id
      and p.campground_id=r.campground_id
     where r.campground_id=$1
       and r.id=$2
     limit 1`,
    [campgroundId, reservationId],
  );

  if (result.rowCount !== 1) {
    throw new Error("Reservation credential lifecycle context is unavailable.");
  }

  const row = result.rows[0];
  const expiry = await client.query(
    `select (
       ($1::date + $2::time) at time zone $3
       + ($4::integer * interval '1 minute')
     ) as expires_at`,
    [
      String(row.departure_date).slice(0, 10),
      row.checkout_local_time,
      row.campground_timezone,
      row.grace_minutes,
    ],
  );

  return {
    ...row,
    expires_at: expiry.rows[0].expires_at,
  };
}

function mapAssignment(row) {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    checkInId: row.check_in_id,
    credentialId: row.credential_id,
    lifecycleState: row.lifecycle_state,
    syncWithStay: row.sync_with_stay === true,
    replacementForAssignmentId: row.replacement_for_assignment_id ?? null,
    sourceChannel: row.source_channel,
    provisionedAt: new Date(row.provisioned_at).toISOString(),
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    endReason: row.end_reason ?? null,
  };
}

async function insertCredentialEvent(
  client,
  {
    organizationId,
    campgroundId,
    credentialId,
    eventKind,
    actorUserId,
    reason,
    metadata = {},
  },
) {
  await client.query(
    `insert into public.access_credential_events (
       organization_id,campground_id,credential_id,event_kind,
       actor_user_id,reason,event_metadata
     ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      organizationId,
      campgroundId,
      credentialId,
      eventKind,
      actorUserId,
      reason,
      JSON.stringify(metadata),
    ],
  );
}

export async function provisionReservationCredential({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  reservationId,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
  replacementForAssignmentId = null,
}) {
  await assertPermission(actorUserId, campgroundId, "access.credential.issue");

  const value = normalizeReservationCredentialProvisionInput(input);
  const channel = normalizeCredentialLifecycleSourceChannel(sourceChannel);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "icamp-credential-lifecycle:" + reservationId,
    ]);

    const existing = await client.query(
      `select a.*,c.credential_number,c.credential_type,c.display_hint,
              c.valid_from,c.valid_until,c.status credential_status
       from public.reservation_access_credential_assignments a
       join public.access_credentials c
         on c.organization_id=a.organization_id
        and c.campground_id=a.campground_id
        and c.id=a.credential_id
       where a.campground_id=$1
         and a.idempotency_key=$2
       limit 1`,
      [campgroundId, key],
    );

    if (existing.rowCount === 1) {
      await client.query("commit");
      return {
        assignment: mapAssignment(existing.rows[0]),
        credentialNumber: existing.rows[0].credential_number,
        credentialType: existing.rows[0].credential_type,
        displayHint: existing.rows[0].display_hint,
        generatedSecret: null,
        idempotent: true,
      };
    }

    const context = await lifecycleContext(client, campgroundId, reservationId);

    if (context.reservation_status !== "checked_in" || !context.check_in_id) {
      throw new Error(
        "Reservation credentials can only be provisioned after front desk check-in.",
      );
    }

    let replacement = null;
    if (replacementForAssignmentId) {
      const result = await client.query(
        `select *
         from public.reservation_access_credential_assignments
         where campground_id=$1
           and reservation_id=$2
           and id=$3
         limit 1
         for update`,
        [campgroundId, reservationId, replacementForAssignmentId],
      );
      if (result.rowCount !== 1) {
        throw new Error("Replacement assignment was not found.");
      }
      replacement = result.rows[0];
      if (replacement.lifecycle_state !== "replaced") {
        throw new Error(
          "Replacement provisioning requires the prior assignment to be marked replaced first.",
        );
      }
    }

    const generatedSecret = credentialNeedsGeneratedSecret(value.credentialType)
      ? generateCredentialSecret()
      : null;
    const fingerprint = generatedSecret
      ? fingerprintCredentialSecret(generatedSecret)
      : null;
    const displayHint = generatedSecret
      ? maskCredentialHint(generatedSecret)
      : value.credentialType === "provider_reference"
        ? "Provider-managed"
        : value.credentialType.replaceAll("_", " ");

    const credentialResult = await client.query(
      `insert into public.access_credentials (
         organization_id,campground_id,credential_number,credential_type,
         subject_kind,subject_reference_id,subject_label,provider_code,
         provider_credential_reference,secret_fingerprint,display_hint,
         status,valid_from,valid_until,issued_by_user_id
       ) values (
         $1,$2,$3,$4,'reservation',$5,$6,$7,$8,$9,$10,'active',
         statement_timestamp(),$11,$12
       ) returning *`,
      [
        context.organization_id,
        campgroundId,
        makeCredentialNumber(),
        value.credentialType,
        reservationId,
        value.subjectLabel,
        value.providerCode,
        value.providerCredentialReference,
        fingerprint,
        displayHint,
        context.expires_at,
        actorUserId,
      ],
    );
    const credential = credentialResult.rows[0];

    await insertCredentialEvent(client, {
      organizationId: context.organization_id,
      campgroundId,
      credentialId: credential.id,
      eventKind: "issued",
      actorUserId,
      reason: replacement
        ? "Replacement reservation credential issued."
        : "Reservation arrival credential provisioned.",
      metadata: {
        reservationId,
        checkInId: context.check_in_id,
        replacementForAssignmentId: replacement?.id ?? null,
        generatedSecretStored: false,
      },
    });

    const assignmentResult = await client.query(
      `insert into public.reservation_access_credential_assignments (
         organization_id,campground_id,reservation_id,check_in_id,
         credential_id,lifecycle_state,sync_with_stay,
         replacement_for_assignment_id,source_channel,idempotency_key,
         provisioned_by_user_id
       ) values (
         $1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10
       ) returning *`,
      [
        context.organization_id,
        campgroundId,
        reservationId,
        context.check_in_id,
        credential.id,
        value.syncWithStay,
        replacement?.id ?? null,
        channel,
        key,
        actorUserId,
      ],
    );
    const assignment = assignmentResult.rows[0];

    if (replacement) {
      await insertCredentialEvent(client, {
        organizationId: context.organization_id,
        campgroundId,
        credentialId: credential.id,
        eventKind: "replaced",
        actorUserId,
        reason: replacement.end_reason,
        metadata: {
          reservationId,
          replacesAssignmentId: replacement.id,
          replacesCredentialId: replacement.credential_id,
        },
      });
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: context.organization_id,
      campgroundId,
      actionKey: replacement
        ? "access.credential.lifecycle.replace"
        : "access.credential.lifecycle.provision",
      permissionKey: "access.credential.issue",
      riskLevel: "elevated",
      subjectType: "access_credential",
      subjectId: credential.id,
      beforeState: null,
      afterState: {
        reservationId,
        assignmentId: assignment.id,
        credentialType: value.credentialType,
        syncWithStay: value.syncWithStay,
        validUntil: new Date(credential.valid_until).toISOString(),
        displayHint,
      },
      metadata: {
        generatedSecretStored: false,
        generatedSecretReturnedOnce: generatedSecret != null,
        replacementForAssignmentId: replacement?.id ?? null,
      },
    });

    await client.query("commit");

    return {
      assignment: mapAssignment(assignment),
      credentialNumber: credential.credential_number,
      credentialType: credential.credential_type,
      displayHint,
      generatedSecret,
      idempotent: false,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function syncReservationCredentialValidityWithClient(
  client,
  {
    actorUserId,
    campgroundId,
    reservationId,
    reason = "Reservation stay dates changed.",
  },
) {
  const context = await lifecycleContext(client, campgroundId, reservationId);
  if (context.reservation_status !== "checked_in") {
    return { changed: 0, extended: 0, shortened: 0 };
  }

  const result = await client.query(
    `select a.id assignment_id,c.*
     from public.reservation_access_credential_assignments a
     join public.access_credentials c
       on c.organization_id=a.organization_id
      and c.campground_id=a.campground_id
      and c.id=a.credential_id
     where a.campground_id=$1
       and a.reservation_id=$2
       and a.lifecycle_state='active'
       and a.sync_with_stay
       and c.status='active'
     order by a.provisioned_at
     for update of a,c`,
    [campgroundId, reservationId],
  );

  let extended = 0;
  let shortened = 0;

  for (const row of result.rows) {
    const eventKind = classifyCredentialValidityChange(
      row.valid_until,
      context.expires_at,
    );
    if (eventKind === "unchanged") continue;

    await client.query(
      `update public.access_credentials
       set valid_until=$3
       where campground_id=$1
         and id=$2
         and status='active'`,
      [campgroundId, row.id, context.expires_at],
    );

    await insertCredentialEvent(client, {
      organizationId: context.organization_id,
      campgroundId,
      credentialId: row.id,
      eventKind,
      actorUserId,
      reason,
      metadata: {
        reservationId,
        assignmentId: row.assignment_id,
        previousValidUntil: new Date(row.valid_until).toISOString(),
        revisedValidUntil: new Date(context.expires_at).toISOString(),
      },
    });

    if (eventKind === "validity_extended") extended += 1;
    else shortened += 1;
  }

  return { changed: extended + shortened, extended, shortened };
}

async function endReservationCredentialAssignmentWithClient(
  client,
  {
    actorUserId,
    campgroundId,
    reservationId,
    assignmentId,
    reason,
    assignmentState,
  },
) {
  const normalizedReason = normalizeCredentialLifecycleReason(
    reason,
    "Credential lifecycle end reason",
  );
  if (!["revoked", "replaced"].includes(assignmentState)) {
    throw new Error("Credential lifecycle end state is invalid.");
  }

  const result = await client.query(
    `select a.*,c.status credential_status
     from public.reservation_access_credential_assignments a
     join public.access_credentials c
       on c.organization_id=a.organization_id
      and c.campground_id=a.campground_id
      and c.id=a.credential_id
     where a.campground_id=$1
       and a.reservation_id=$2
       and a.id=$3
     limit 1
     for update of a,c`,
    [campgroundId, reservationId, assignmentId],
  );

  if (result.rowCount !== 1) {
    throw new Error("Credential lifecycle assignment was not found.");
  }

  const row = result.rows[0];
  if (row.lifecycle_state !== "active") {
    throw new Error("Only active credential assignments can be ended.");
  }

  if (row.credential_status === "active") {
    await client.query(
      `update public.access_credentials
       set status='revoked',
           revoked_at=statement_timestamp(),
           revoked_by_user_id=$3,
           revocation_reason=$4
       where campground_id=$1
         and id=$2
         and status='active'`,
      [campgroundId, row.credential_id, actorUserId, normalizedReason],
    );

    await insertCredentialEvent(client, {
      organizationId: row.organization_id,
      campgroundId,
      credentialId: row.credential_id,
      eventKind: assignmentState === "replaced" ? "lost" : "revoked",
      actorUserId,
      reason: normalizedReason,
      metadata: {
        reservationId,
        assignmentId: row.id,
        lifecycleState: assignmentState,
      },
    });
  }

  await client.query(
    `update public.reservation_access_credential_assignments
     set lifecycle_state=$3,
         ended_at=statement_timestamp(),
         ended_by_user_id=$4,
         end_reason=$5
     where campground_id=$1
       and id=$2
       and lifecycle_state='active'`,
    [campgroundId, row.id, assignmentState, actorUserId, normalizedReason],
  );

  return row;
}

export async function revokeReservationCredentialsWithClient(
  client,
  {
    actorUserId,
    campgroundId,
    reservationId,
    reason,
    assignmentState = "revoked",
  },
) {
  const normalizedReason = normalizeCredentialLifecycleReason(
    reason,
    "Credential lifecycle end reason",
  );
  if (!["revoked", "replaced"].includes(assignmentState)) {
    throw new Error("Credential lifecycle end state is invalid.");
  }

  const assignments = await client.query(
    `select a.*,c.status credential_status
     from public.reservation_access_credential_assignments a
     join public.access_credentials c
       on c.organization_id=a.organization_id
      and c.campground_id=a.campground_id
      and c.id=a.credential_id
     where a.campground_id=$1
       and a.reservation_id=$2
       and a.lifecycle_state='active'
     order by a.provisioned_at
     for update of a,c`,
    [campgroundId, reservationId],
  );

  let changed = 0;
  for (const row of assignments.rows) {
    if (row.credential_status === "active") {
      await client.query(
        `update public.access_credentials
         set status='revoked',
             revoked_at=statement_timestamp(),
             revoked_by_user_id=$3,
             revocation_reason=$4
         where campground_id=$1
           and id=$2
           and status='active'`,
        [campgroundId, row.credential_id, actorUserId, normalizedReason],
      );

      await insertCredentialEvent(client, {
        organizationId: row.organization_id,
        campgroundId,
        credentialId: row.credential_id,
        eventKind: assignmentState === "replaced" ? "lost" : "revoked",
        actorUserId,
        reason: normalizedReason,
        metadata: {
          reservationId,
          assignmentId: row.id,
          lifecycleState: assignmentState,
        },
      });
    }

    await client.query(
      `update public.reservation_access_credential_assignments
       set lifecycle_state=$3,
           ended_at=statement_timestamp(),
           ended_by_user_id=$4,
           end_reason=$5
       where campground_id=$1
         and id=$2
         and lifecycle_state='active'`,
      [campgroundId, row.id, assignmentState, actorUserId, normalizedReason],
    );
    changed += 1;
  }

  return { changed };
}

export async function replaceLostReservationCredential({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  reservationId,
  assignmentId,
  reason,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
}) {
  await Promise.all([
    assertPermission(actorUserId, campgroundId, "access.credential.revoke"),
    assertPermission(actorUserId, campgroundId, "access.credential.issue"),
  ]);

  const normalizedReason = normalizeCredentialLifecycleReason(
    reason,
    "Lost/replacement reason",
  );
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "icamp-credential-lifecycle:" + reservationId,
    ]);

    const target = await client.query(
      `select a.*,c.credential_type,c.subject_label,c.provider_code
       from public.reservation_access_credential_assignments a
       join public.access_credentials c
         on c.organization_id=a.organization_id
        and c.campground_id=a.campground_id
        and c.id=a.credential_id
       where a.campground_id=$1
         and a.reservation_id=$2
         and a.id=$3
       limit 1
       for update of a,c`,
      [campgroundId, reservationId, assignmentId],
    );

    if (target.rowCount !== 1) {
      throw new Error("Credential lifecycle assignment was not found.");
    }
    if (!["active", "replaced"].includes(target.rows[0].lifecycle_state)) {
      throw new Error(
        "Only active or already-replaced credentials can enter lost/replacement workflow.",
      );
    }

    if (target.rows[0].lifecycle_state === "active") {
      await endReservationCredentialAssignmentWithClient(client, {
        actorUserId,
        campgroundId,
        reservationId,
        assignmentId,
        reason: normalizedReason,
        assignmentState: "replaced",
      });
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return provisionReservationCredential({
    actorUserId,
    actorSessionId,
    campgroundId,
    reservationId,
    idempotencyKey,
    input,
    sourceChannel,
    replacementForAssignmentId: assignmentId,
  });
}
