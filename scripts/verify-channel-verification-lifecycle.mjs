import assert from "node:assert/strict";

import pg from "pg";

import {
  closeAuthPoolForTests,
  createSession,
  createStaffAccountForBootstrap,
  reauthenticateSession,
} from "../lib/auth/postgres.mjs";
import { closeAuthorizationPoolForTests } from "../lib/authz/postgres.mjs";
import {
  assertChannelVerificationGrant,
  closeVerificationPoolForTests,
  completeStaffChallengeWithRecentSession,
  getChannelVerificationHealth,
  issueGuestVerificationChallenge,
  issueStaffVerificationChallenge,
  setStaffChannelPin,
  verifyGuestVerificationChallenge,
  verifyStaffChannelPin,
  verifyStaffOneTimeCode,
} from "../lib/verification/postgres.mjs";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 013 verification.");
}

const setupPool = new Pool({ connectionString: databaseUrl, max: 2 });
const password = ["build013", "staff", "password", "one"].join("-");

async function assignOwner(userId, organizationId, campgroundId) {
  const assignment = await setupPool.query(
    "insert into icamp_private.campground_assignments " +
      "(user_id, organization_id, campground_id) values ($1,$2,$3) returning id",
    [userId, organizationId, campgroundId],
  );
  const role = await setupPool.query(
    "select id from icamp_private.roles where role_kind = 'template' " +
      "and role_code = 'owner_admin' and lifecycle_state = 'active' limit 1",
  );
  assert.equal(role.rowCount, 1);
  await setupPool.query(
    "insert into icamp_private.campground_assignment_roles " +
      "(assignment_id, role_id) values ($1,$2)",
    [assignment.rows[0].id, role.rows[0].id],
  );
}

async function createPhoneEndpoint(organizationId, campgroundId, value, hint) {
  const result = await setupPool.query(
    "insert into icamp_private.communication_endpoints " +
      "(organization_id, campground_id, endpoint_kind, endpoint_value, display_hint, verified_at) " +
      "values ($1,$2,'phone',$3,$4,statement_timestamp()) returning id",
    [organizationId, campgroundId, value, hint],
  );
  return result.rows[0].id;
}

try {
  const organization = await setupPool.query(
    "insert into public.organizations (name, slug) " +
      "values ('Build 013 Lifecycle Org','build-013-lifecycle-org') returning id",
  );
  const organizationId = organization.rows[0].id;
  const campground = await setupPool.query(
    "insert into public.campgrounds (organization_id,name,slug,timezone) " +
      "values ($1,'Build 013 Lifecycle Camp','build-013-lifecycle-camp','America/Toronto') returning id",
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const guestEndpointId = await createPhoneEndpoint(
    organizationId,
    campgroundId,
    "+15555551301",
    "Build 013 guest endpoint ending 1301",
  );
  const staffEndpointId = await createPhoneEndpoint(
    organizationId,
    campgroundId,
    "+15555551302",
    "Build 013 staff endpoint ending 1302",
  );

  let guestDeliveredCode = null;
  const guest = await issueGuestVerificationChallenge({
    organizationId,
    campgroundId,
    remoteEndpointId: guestEndpointId,
    channel: "sms",
    subjectKind: "reservation",
    subjectReference: "7654321",
    codeFactory: () => "902114",
    deliverCode: ({ code }) => {
      guestDeliveredCode = code;
    },
  });

  assert.equal(guestDeliveredCode, "902114");
  assert.equal(guest.status, "pending");
  assert.equal(guest.secretsExcluded, true);
  assert.equal(guest.callerOrSenderHintIsAuthentication, false);
  assert.doesNotMatch(JSON.stringify(guest), /7654321|902114/u);

  const wrongGuest = await verifyGuestVerificationChallenge({
    challengeId: guest.id,
    subjectReference: "7654321",
    verificationCode: "902115",
  });
  assert.equal(wrongGuest.verified, false);
  assert.equal(wrongGuest.challenge.attemptCount, 1);

  const verifiedGuest = await verifyGuestVerificationChallenge({
    challengeId: guest.id,
    subjectReference: "7654321",
    verificationCode: "902114",
  });
  assert.equal(verifiedGuest.verified, true);
  assert.equal(verifiedGuest.challenge.status, "satisfied");
  assert.equal(verifiedGuest.challenge.assuranceLevel, "aal1");

  const lockChallenge = await issueGuestVerificationChallenge({
    organizationId,
    campgroundId,
    remoteEndpointId: guestEndpointId,
    channel: "voice",
    subjectKind: "site",
    subjectReference: "42",
    maxAttempts: 2,
    codeFactory: () => "112233",
  });
  for (const code of ["000001", "000002"]) {
    await verifyGuestVerificationChallenge({
      challengeId: lockChallenge.id,
      subjectReference: "42",
      verificationCode: code,
    });
  }
  const lockedRow = await setupPool.query(
    "select status, locked_until, fraud_signals from " +
      "icamp_private.channel_verification_challenges where id = $1",
    [lockChallenge.id],
  );
  assert.equal(lockedRow.rows[0].status, "locked");
  assert.ok(lockedRow.rows[0].locked_until);
  assert.ok(
    lockedRow.rows[0].fraud_signals.includes("attempt_limit_reached") ||
      lockedRow.rows[0].fraud_signals.includes("code_mismatch"),
  );

  const staff = await createStaffAccountForBootstrap({
    email: "build013-owner@example.test",
    password,
  });
  await assignOwner(staff.id, organizationId, campgroundId);
  await setStaffChannelPin({ userId: staff.id, pin: "2468" });

  let staffDeliveredCode = null;
  const staffOtpChallenge = await issueStaffVerificationChallenge({
    organizationId,
    campgroundId,
    remoteEndpointId: staffEndpointId,
    channel: "sms",
    userId: staff.id,
    purpose: "staff_privileged",
    codeFactory: () => "731905",
    deliverCode: ({ code }) => {
      staffDeliveredCode = code;
    },
  });
  assert.equal(staffDeliveredCode, "731905");

  const pinStep = await verifyStaffChannelPin({
    challengeId: staffOtpChallenge.id,
    userId: staff.id,
    pin: "2468",
  });
  assert.equal(pinStep.verified, true);
  assert.equal(pinStep.requiresSecondFactor, true);
  assert.equal(pinStep.challenge.status, "pending");

  const otpStep = await verifyStaffOneTimeCode({
    challengeId: staffOtpChallenge.id,
    userId: staff.id,
    verificationCode: "731905",
  });
  assert.equal(otpStep.verified, true);
  assert.equal(otpStep.challenge.status, "satisfied");
  assert.equal(otpStep.challenge.assuranceLevel, "aal2");

  const grant = await assertChannelVerificationGrant({
    challengeId: staffOtpChallenge.id,
    userId: staff.id,
    campgroundId,
    permission: "system.admin",
    riskLevel: "high",
    reason: "Verify Build 013 privileged channel grant.",
  });
  assert.equal(grant.assuranceLevel, "aal2");
  assert.equal(grant.secretsExcluded, true);

  const session = await createSession({ userId: staff.id });
  await setupPool.query(
    "update icamp_private.auth_sessions set " +
      "reauthenticated_at = statement_timestamp() - interval '20 minutes' " +
      "where id = $1",
    [session.sessionId],
  );

  const staffSessionChallenge = await issueStaffVerificationChallenge({
    organizationId,
    campgroundId,
    remoteEndpointId: staffEndpointId,
    channel: "voice",
    userId: staff.id,
    purpose: "staff_privileged",
    codeFactory: () => "445566",
  });
  const sessionPin = await verifyStaffChannelPin({
    challengeId: staffSessionChallenge.id,
    userId: staff.id,
    pin: "2468",
  });
  assert.equal(sessionPin.requiresSecondFactor, true);

  const stale = await completeStaffChallengeWithRecentSession({
    challengeId: staffSessionChallenge.id,
    userId: staff.id,
    sessionId: session.sessionId,
  });
  assert.equal(stale.verified, false);
  assert.equal(stale.challenge.status, "pending");

  const refreshed = await reauthenticateSession({
    sessionId: session.sessionId,
    userId: staff.id,
    password,
  });
  assert.ok(refreshed?.reauthenticatedAt);

  const sessionVerified = await completeStaffChallengeWithRecentSession({
    challengeId: staffSessionChallenge.id,
    userId: staff.id,
    sessionId: session.sessionId,
  });
  assert.equal(sessionVerified.verified, true);
  assert.equal(sessionVerified.challenge.assuranceLevel, "aal2");

  const persisted = await setupPool.query(
    "select c.subject_reference_hash, c.code_hash, c.fraud_signals, " +
      "p.pin_hash from icamp_private.channel_verification_challenges c " +
      "left join icamp_private.staff_channel_pin_credentials p " +
      "on p.user_id = $1 where c.id = any($2::uuid[])",
    [
      staff.id,
      [
        guest.id,
        lockChallenge.id,
        staffOtpChallenge.id,
        staffSessionChallenge.id,
      ],
    ],
  );
  const storedText = JSON.stringify(persisted.rows);
  for (const raw of [
    "7654321",
    "902114",
    "112233",
    "2468",
    "731905",
    "445566",
  ]) {
    assert.doesNotMatch(storedText, new RegExp(raw, "u"));
  }

  const audit = await setupPool.query(
    "select action_key, metadata from icamp_private.audit_events " +
      "where action_key = 'identity.channel.reauthenticate' " +
      "and actor_user_id = $1 order by occurred_at",
    [staff.id],
  );
  assert.ok(audit.rowCount >= 2);
  const auditText = JSON.stringify(audit.rows);
  assert.match(auditText, /rawSecretsExcluded/u);
  assert.match(auditText, /callerOrSenderHintIsAuthentication/u);
  for (const raw of ["2468", "731905", "445566"]) {
    assert.doesNotMatch(auditText, new RegExp(raw, "u"));
  }

  const health = await getChannelVerificationHealth();
  assert.equal(health.challenges.satisfied24h >= 3, true);
  assert.equal(health.challenges.locked24h >= 1, true);
  assert.equal(health.privacy.rawSecretsExcluded, true);
  assert.equal(health.privacy.callerOrSenderHintIsAuthentication, false);

  process.stdout.write(
    "Build 013 telephone/SMS identity verification lifecycle passed.\n",
  );
} finally {
  await closeVerificationPoolForTests();
  await closeAuthPoolForTests();
  await closeAuthorizationPoolForTests();
  await setupPool.end();
}
