import pg from "pg";

import {
  assertPrivilegedActionControl,
  assertRecentReauthentication,
} from "../audit/privileged.mjs";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  VERIFICATION_CHALLENGE_SECONDS,
  VERIFICATION_ISSUE_LIMIT,
  VERIFICATION_ISSUE_WINDOW_SECONDS,
  VERIFICATION_LOCK_SECONDS,
  VERIFICATION_MAX_ATTEMPTS,
  evaluateVerificationAvailability,
  generateVerificationCode,
  hashStaffPin,
  hashSubjectReference,
  hashVerificationCode,
  mergeFraudSignals,
  normalizeVerificationChannel,
  normalizeVerificationPurpose,
  normalizeVerificationSubjectKind,
  sanitizeVerificationChallenge,
  verifyStaffPin,
  verifySubjectReference,
  verifyVerificationCode,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for channel verification.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertEndpoint(
  client,
  organizationId,
  campgroundId,
  endpointId,
) {
  const result = await client.query(
    "select id from icamp_private.communication_endpoints " +
      "where id = $1 and organization_id = $2 and campground_id = $3 " +
      "and endpoint_kind = 'phone' and lifecycle_state = 'active' limit 1",
    [endpointId, organizationId, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Verification endpoint is not available.");
  }
}

async function assertStaff(client, userId, organizationId, campgroundId) {
  const result = await client.query(
    "select a.user_id from icamp_private.campground_assignments a " +
      "join icamp_private.user_accounts u on u.id = a.user_id " +
      "where a.user_id = $1 and a.organization_id = $2 and a.campground_id = $3 " +
      "and a.assignment_state = 'active' and a.starts_at <= statement_timestamp() " +
      "and (a.ends_at is null or a.ends_at > statement_timestamp()) " +
      "and u.account_type = 'staff' and u.account_state = 'active' limit 1",
    [userId, organizationId, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Staff verification context is not available.");
  }
}

async function assertIssueRate(client, campgroundId, endpointId, channel) {
  const result = await client.query(
    "select count(*)::integer as issued " +
      "from icamp_private.channel_verification_challenges " +
      "where campground_id = $1 and remote_endpoint_id = $2 and channel = $3 " +
      "and created_at >= statement_timestamp() - ($4 * interval '1 second')",
    [campgroundId, endpointId, channel, VERIFICATION_ISSUE_WINDOW_SECONDS],
  );
  if (Number(result.rows[0]?.issued ?? 0) >= VERIFICATION_ISSUE_LIMIT) {
    throw new Error("Verification is temporarily unavailable.");
  }
}

async function attempt(
  client,
  challengeId,
  factorKind,
  outcome,
  riskSignal = null,
) {
  await client.query(
    "insert into icamp_private.channel_verification_attempts " +
      "(challenge_id, factor_kind, outcome, risk_signal) values ($1, $2, $3, $4)",
    [challengeId, factorKind, outcome, riskSignal],
  );
}

async function loadForUpdate(client, challengeId) {
  const result = await client.query(
    "select * from icamp_private.channel_verification_challenges " +
      "where id = $1 for update",
    [challengeId],
  );
  return result.rows[0] ?? null;
}

async function availableOrClose(client, challenge, factorKind) {
  const state = evaluateVerificationAvailability({
    status: challenge.status,
    expiresAt: challenge.expires_at,
    lockedUntil: challenge.locked_until,
    attemptCount: Number(challenge.attempt_count),
    maxAttempts: Number(challenge.max_attempts),
  });
  if (state.usable) return { usable: true, challenge };

  if (state.reason === "expired" && challenge.status === "pending") {
    const updated = await client.query(
      "update icamp_private.channel_verification_challenges " +
        "set status = 'expired', fraud_signals = $2::text[] where id = $1 returning *",
      [
        challenge.id,
        mergeFraudSignals(challenge.fraud_signals, "challenge_expired"),
      ],
    );
    await attempt(
      client,
      challenge.id,
      factorKind,
      "expired",
      "challenge_expired",
    );
    return { usable: false, challenge: updated.rows[0] };
  }

  return { usable: false, challenge };
}

async function reject(
  client,
  challenge,
  factorKind,
  riskSignal,
  outcome = "rejected",
) {
  const next = Number(challenge.attempt_count ?? 0) + 1;
  const locked = next >= Number(challenge.max_attempts);
  const result = await client.query(
    "update icamp_private.channel_verification_challenges set " +
      "attempt_count = $2, " +
      "status = case when $3 then 'locked' else status end, " +
      "locked_until = case when $3 then statement_timestamp() + ($4 * interval '1 second') else locked_until end, " +
      "fraud_signals = $5::text[] where id = $1 returning *",
    [
      challenge.id,
      next,
      locked,
      VERIFICATION_LOCK_SECONDS,
      mergeFraudSignals(challenge.fraud_signals, riskSignal),
    ],
  );
  await attempt(
    client,
    challenge.id,
    factorKind,
    locked ? "locked" : outcome,
    locked ? "attempt_limit_reached" : riskSignal,
  );
  return result.rows[0];
}

async function auditStaff(client, challenge, secondFactor) {
  const high = challenge.purpose === "staff_privileged";
  const riskLevel = high ? "high" : "elevated";
  const assuranceLevel = challenge.assurance_level;
  const reason = "Staff channel identity verification.";
  const privileged = assertPrivilegedActionControl({
    riskLevel,
    reason,
    reauthenticatedAt: challenge.satisfied_at,
    assuranceLevel,
    minimumAssuranceLevel: high ? "aal2" : "aal1",
  });
  await appendAuditEvent(client, {
    actorUserId: challenge.staff_user_id,
    organizationId: challenge.organization_id,
    campgroundId: challenge.campground_id,
    actionKey: "identity.channel.reauthenticate",
    riskLevel,
    outcome: "succeeded",
    reason: privileged.reason,
    subjectType: "identity.verification",
    subjectId: challenge.id,
    metadata: {
      channel: challenge.channel,
      purpose: challenge.purpose,
      secondFactor,
      rawSecretsExcluded: true,
      callerOrSenderHintIsAuthentication: false,
    },
    reauthenticatedAt: privileged.reauthenticatedAt,
    assuranceLevel,
  });
}

async function cancelDelivery(challengeId) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const challenge = await loadForUpdate(client, challengeId);
    if (challenge?.status === "pending") {
      await client.query(
        "update icamp_private.channel_verification_challenges " +
          "set status = 'cancelled', fraud_signals = $2::text[] where id = $1",
        [
          challengeId,
          mergeFraudSignals(challenge.fraud_signals, "delivery_failed"),
        ],
      );
      await attempt(
        client,
        challengeId,
        "one_time_code",
        "delivery_failed",
        "delivery_failed",
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function issueChallenge({
  organizationId,
  campgroundId,
  remoteEndpointId,
  channel,
  actorKind,
  purpose,
  subjectKind,
  subjectReference = null,
  staffUserId = null,
  maxAttempts = VERIFICATION_MAX_ATTEMPTS,
  codeFactory = generateVerificationCode,
  deliverCode = null,
}) {
  const normalizedChannel = normalizeVerificationChannel(channel);
  const normalizedPurpose = normalizeVerificationPurpose(purpose);
  const normalizedSubjectKind = normalizeVerificationSubjectKind(subjectKind);
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > VERIFICATION_MAX_ATTEMPTS
  ) {
    throw new Error("Verification attempt limit is invalid.");
  }

  const needsCode =
    actorKind === "guest" || normalizedPurpose === "staff_privileged";
  const code = needsCode ? codeFactory() : null;
  const codeHash = code ? await hashVerificationCode(code) : null;
  const referenceHash =
    actorKind === "guest"
      ? await hashSubjectReference(normalizedSubjectKind, subjectReference)
      : null;

  const client = await getPool().connect();
  let row;
  try {
    await client.query("begin");
    await assertEndpoint(
      client,
      organizationId,
      campgroundId,
      remoteEndpointId,
    );
    await assertIssueRate(
      client,
      campgroundId,
      remoteEndpointId,
      normalizedChannel,
    );
    if (actorKind === "staff") {
      await assertStaff(client, staffUserId, organizationId, campgroundId);
    }
    const result = await client.query(
      "insert into icamp_private.channel_verification_challenges " +
        "(organization_id, campground_id, remote_endpoint_id, staff_user_id, " +
        "channel, actor_kind, purpose, subject_kind, subject_reference_hash, " +
        "code_hash, max_attempts, expires_at) " +
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11," +
        "statement_timestamp() + ($12 * interval '1 second')) returning *",
      [
        organizationId,
        campgroundId,
        remoteEndpointId,
        staffUserId,
        normalizedChannel,
        actorKind,
        normalizedPurpose,
        normalizedSubjectKind,
        referenceHash,
        codeHash,
        maxAttempts,
        VERIFICATION_CHALLENGE_SECONDS,
      ],
    );
    row = result.rows[0];
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  if (code && typeof deliverCode === "function") {
    try {
      await deliverCode({
        challengeId: row.id,
        organizationId,
        campgroundId,
        remoteEndpointId,
        channel: normalizedChannel,
        code,
      });
    } catch {
      await cancelDelivery(row.id);
      throw new Error("Verification delivery failed.");
    }
  }

  return sanitizeVerificationChallenge(row);
}

export async function setStaffChannelPin({ userId, pin }) {
  const pinHash = await hashStaffPin(pin);
  const result = await getPool().query(
    "insert into icamp_private.staff_channel_pin_credentials (user_id, pin_hash) " +
      "values ($1,$2) on conflict (user_id) do update set " +
      "pin_hash = excluded.pin_hash, failed_attempt_count = 0, locked_until = null, " +
      "changed_at = statement_timestamp() returning user_id, changed_at",
    [userId, pinHash],
  );
  return {
    userId: result.rows[0].user_id,
    changedAt: result.rows[0].changed_at,
    rawPinExcluded: true,
  };
}

export function issueGuestVerificationChallenge(input) {
  return issueChallenge({
    ...input,
    actorKind: "guest",
    purpose: "guest_lookup",
    staffUserId: null,
  });
}

export function issueStaffVerificationChallenge({
  purpose = "staff_privileged",
  userId,
  ...input
}) {
  return issueChallenge({
    ...input,
    actorKind: "staff",
    purpose,
    subjectKind: "staff",
    subjectReference: null,
    staffUserId: userId,
  });
}

export async function verifyGuestVerificationChallenge({
  challengeId,
  subjectReference,
  verificationCode,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    let challenge = await loadForUpdate(client, challengeId);
    if (!challenge || challenge.actor_kind !== "guest") {
      throw new Error("Verification challenge is not available.");
    }

    const gate = await availableOrClose(client, challenge, "one_time_code");
    challenge = gate.challenge;
    if (!gate.usable) {
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(challenge),
      };
    }

    const [referenceOk, codeOk] = await Promise.all([
      verifySubjectReference(
        challenge.subject_kind,
        subjectReference,
        challenge.subject_reference_hash,
      ),
      verifyVerificationCode(verificationCode, challenge.code_hash),
    ]);

    if (!referenceOk || !codeOk) {
      const failed = await reject(
        client,
        challenge,
        referenceOk ? "one_time_code" : "subject_reference",
        referenceOk ? "code_mismatch" : "context_mismatch",
        referenceOk ? "rejected" : "context_mismatch",
      );
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(failed),
      };
    }

    const result = await client.query(
      "update icamp_private.channel_verification_challenges set " +
        "status = 'satisfied', code_verified_at = statement_timestamp(), " +
        "assurance_level = 'aal1', satisfied_at = statement_timestamp() " +
        "where id = $1 returning *",
      [challenge.id],
    );
    await attempt(client, challenge.id, "subject_reference", "accepted");
    await attempt(client, challenge.id, "one_time_code", "accepted");
    await client.query("commit");
    return {
      verified: true,
      challenge: sanitizeVerificationChallenge(result.rows[0]),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyStaffChannelPin({ challengeId, userId, pin }) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    let challenge = await loadForUpdate(client, challengeId);
    if (
      !challenge ||
      challenge.actor_kind !== "staff" ||
      challenge.staff_user_id !== userId
    ) {
      throw new Error("Verification challenge is not available.");
    }

    const gate = await availableOrClose(client, challenge, "staff_pin");
    challenge = gate.challenge;
    if (!gate.usable) {
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(challenge),
      };
    }

    const credentialResult = await client.query(
      "select * from icamp_private.staff_channel_pin_credentials " +
        "where user_id = $1 for update",
      [userId],
    );
    const credential = credentialResult.rows[0];
    if (!credential) {
      throw new Error("Staff channel PIN is not configured.");
    }

    const locked =
      credential.locked_until &&
      new Date(credential.locked_until).getTime() > Date.now();
    if (locked) {
      const failed = await reject(
        client,
        challenge,
        "staff_pin",
        "staff_pin_locked",
        "locked",
      );
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(failed),
      };
    }

    const valid = await verifyStaffPin(pin, credential.pin_hash);
    if (!valid) {
      const failures = Number(credential.failed_attempt_count ?? 0) + 1;
      const pinLocked = failures >= VERIFICATION_MAX_ATTEMPTS;
      await client.query(
        "update icamp_private.staff_channel_pin_credentials set " +
          "failed_attempt_count = $2, locked_until = case when $3 then " +
          "statement_timestamp() + ($4 * interval '1 second') else null end " +
          "where user_id = $1",
        [userId, failures, pinLocked, VERIFICATION_LOCK_SECONDS],
      );
      const failed = await reject(
        client,
        challenge,
        "staff_pin",
        pinLocked ? "staff_pin_locked" : "staff_pin_mismatch",
        pinLocked ? "locked" : "rejected",
      );
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(failed),
      };
    }

    await client.query(
      "update icamp_private.staff_channel_pin_credentials set " +
        "failed_attempt_count = 0, locked_until = null where user_id = $1",
      [userId],
    );

    const staffAccess = challenge.purpose === "staff_access";
    const result = await client.query(
      "update icamp_private.channel_verification_challenges set " +
        "pin_verified_at = statement_timestamp(), " +
        "status = case when $2 then 'satisfied' else status end, " +
        "assurance_level = case when $2 then 'aal1' else assurance_level end, " +
        "satisfied_at = case when $2 then statement_timestamp() else satisfied_at end " +
        "where id = $1 returning *",
      [challenge.id, staffAccess],
    );
    await attempt(client, challenge.id, "staff_pin", "accepted");
    if (staffAccess) {
      await auditStaff(client, result.rows[0], "not_required");
    }
    await client.query("commit");
    return {
      verified: true,
      requiresSecondFactor: !staffAccess,
      challenge: sanitizeVerificationChallenge(result.rows[0]),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyStaffOneTimeCode({
  challengeId,
  userId,
  verificationCode,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    let challenge = await loadForUpdate(client, challengeId);
    if (
      !challenge ||
      challenge.actor_kind !== "staff" ||
      challenge.staff_user_id !== userId ||
      challenge.purpose !== "staff_privileged" ||
      !challenge.pin_verified_at
    ) {
      throw new Error(
        "Verification challenge is not ready for a second factor.",
      );
    }

    const gate = await availableOrClose(client, challenge, "one_time_code");
    challenge = gate.challenge;
    if (!gate.usable) {
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(challenge),
      };
    }

    const valid = await verifyVerificationCode(
      verificationCode,
      challenge.code_hash,
    );
    if (!valid) {
      const failed = await reject(
        client,
        challenge,
        "one_time_code",
        "code_mismatch",
      );
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(failed),
      };
    }

    const result = await client.query(
      "update icamp_private.channel_verification_challenges set " +
        "code_verified_at = statement_timestamp(), status = 'satisfied', " +
        "assurance_level = 'aal2', satisfied_at = statement_timestamp() " +
        "where id = $1 returning *",
      [challenge.id],
    );
    await attempt(client, challenge.id, "one_time_code", "accepted");
    await auditStaff(client, result.rows[0], "one_time_code");
    await client.query("commit");
    return {
      verified: true,
      challenge: sanitizeVerificationChallenge(result.rows[0]),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeStaffChallengeWithRecentSession({
  challengeId,
  userId,
  sessionId,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    let challenge = await loadForUpdate(client, challengeId);
    if (
      !challenge ||
      challenge.actor_kind !== "staff" ||
      challenge.staff_user_id !== userId ||
      challenge.purpose !== "staff_privileged" ||
      !challenge.pin_verified_at
    ) {
      throw new Error(
        "Verification challenge is not ready for session re-authentication.",
      );
    }

    const gate = await availableOrClose(
      client,
      challenge,
      "session_reauthentication",
    );
    challenge = gate.challenge;
    if (!gate.usable) {
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(challenge),
      };
    }

    const sessionResult = await client.query(
      "select id, user_id, reauthenticated_at from icamp_private.auth_sessions " +
        "where id = $1 and user_id = $2 and revoked_at is null " +
        "and expires_at > statement_timestamp() limit 1",
      [sessionId, userId],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      const failed = await reject(
        client,
        challenge,
        "session_reauthentication",
        "session_context_mismatch",
        "context_mismatch",
      );
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(failed),
      };
    }

    try {
      assertRecentReauthentication({
        reauthenticatedAt: session.reauthenticated_at,
      });
    } catch {
      await attempt(
        client,
        challenge.id,
        "session_reauthentication",
        "rejected",
        "session_reauthentication_stale",
      );
      await client.query("commit");
      return {
        verified: false,
        challenge: sanitizeVerificationChallenge(challenge),
      };
    }

    const result = await client.query(
      "update icamp_private.channel_verification_challenges set " +
        "session_reauthenticated_at = $2, status = 'satisfied', " +
        "assurance_level = 'aal2', satisfied_at = statement_timestamp() " +
        "where id = $1 returning *",
      [challenge.id, session.reauthenticated_at],
    );
    await attempt(client, challenge.id, "session_reauthentication", "accepted");
    await auditStaff(client, result.rows[0], "recent_session_reauthentication");
    await client.query("commit");
    return {
      verified: true,
      challenge: sanitizeVerificationChallenge(result.rows[0]),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function assertChannelVerificationGrant({
  challengeId,
  userId,
  campgroundId,
  permission,
  riskLevel = "elevated",
  reason,
}) {
  const result = await getPool().query(
    "select * from icamp_private.channel_verification_challenges " +
      "where id = $1 and staff_user_id = $2 and campground_id = $3 " +
      "and actor_kind = 'staff' and status = 'satisfied' " +
      "and satisfied_at is not null and expires_at > statement_timestamp() limit 1",
    [challengeId, userId, campgroundId],
  );
  const challenge = result.rows[0];
  if (!challenge) {
    throw new Error("Verified channel identity is required.");
  }
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error("The staff identity is not authorized for this action.");
  }
  const privileged = assertPrivilegedActionControl({
    riskLevel,
    reason,
    reauthenticatedAt: challenge.satisfied_at,
    assuranceLevel: challenge.assurance_level,
    minimumAssuranceLevel: riskLevel === "high" ? "aal2" : "aal1",
  });
  return {
    challengeId: challenge.id,
    userId,
    campgroundId,
    permission,
    channel: challenge.channel,
    purpose: challenge.purpose,
    assuranceLevel: challenge.assurance_level,
    verifiedAt: challenge.satisfied_at,
    reason: privileged.reason,
    secretsExcluded: true,
  };
}

export async function getChannelVerificationHealth() {
  const [challenges, attempts, pins] = await Promise.all([
    getPool().query(
      "select " +
        "count(*) filter (where status = 'pending' and expires_at > statement_timestamp())::integer as pending, " +
        "count(*) filter (where status = 'satisfied' and satisfied_at >= statement_timestamp() - interval '24 hours')::integer as satisfied_24h, " +
        "count(*) filter (where status = 'locked' and updated_at >= statement_timestamp() - interval '24 hours')::integer as locked_24h, " +
        "count(*) filter (where cardinality(fraud_signals) > 0 and updated_at >= statement_timestamp() - interval '24 hours')::integer as flagged_24h " +
        "from icamp_private.channel_verification_challenges",
    ),
    getPool().query(
      "select count(*) filter (where outcome in ('rejected','locked','context_mismatch') " +
        "and occurred_at >= statement_timestamp() - interval '24 hours')::integer as rejected_24h " +
        "from icamp_private.channel_verification_attempts",
    ),
    getPool().query(
      "select count(*) filter (where locked_until > statement_timestamp())::integer as locked " +
        "from icamp_private.staff_channel_pin_credentials",
    ),
  ]);
  const c = challenges.rows[0];
  return {
    status:
      Number(c.locked_24h) > 0 || Number(c.flagged_24h) > 0
        ? "degraded"
        : "operational",
    challenges: {
      pending: Number(c.pending),
      satisfied24h: Number(c.satisfied_24h),
      locked24h: Number(c.locked_24h),
      flagged24h: Number(c.flagged_24h),
    },
    attempts: { rejected24h: Number(attempts.rows[0].rejected_24h) },
    staffPins: { locked: Number(pins.rows[0].locked) },
    privacy: {
      rawSecretsExcluded: true,
      callerOrSenderHintIsAuthentication: false,
    },
  };
}

export async function closeVerificationPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
