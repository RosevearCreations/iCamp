import { originalPool270 } from "../build270/postgres.mjs";
import {
  originalAdmission277,
  ownerAdoptedPins277,
} from "../build277/postgres.mjs";
import {
  classifyFieldReadback277,
  verifyFieldResponse277,
} from "../build277/core.mjs";
import { actualOwnerReadback276 } from "../build276/postgres.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { UUID276 } from "../build276/core.mjs";
import {
  validateFieldReview278,
  validateMfaReview278,
  validateExternalReadback278,
  summarizeField278,
  summarizeOwner278,
  summarizeRestore278,
  classifyClosure278,
} from "./core.mjs";

export async function originalAdmission278() {
  const previous = await originalAdmission277();
  const result = {
    adopted: false,
    host: previous.host,
    status: previous.status,
  };
  if (!previous.adopted || !previous.host.pinned) return result;
  try {
    const q = await originalPool270().query(
      "select to_regclass('icamp_private.peer_field_review278') is not null as field," +
        "to_regclass('icamp_private.owner_mfa_readback278') is not null as owner," +
        "to_regclass('icamp_private.restore_service_readback278') is not null as restore," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0251') as predecessor," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0252') as migration",
    );
    result.adopted = Object.values(q.rows[0] ?? {}).every((x) => x === true);
    result.status = result.adopted
      ? "ORIGINAL_0252_SCHEMA_READY_LIVE_EVIDENCE_REQUIRED"
      : "HOLD_ORIGINAL_MIGRATION_0252";
  } catch {
    result.status = "HOLD_ORIGINAL_0252_READBACK";
  }
  return result;
}

async function requireIndependentOperator278(actorId) {
  if (
    !UUID276.test(actorId) ||
    !(await originalAdmission278()).adopted ||
    (await getPlatformOverview(actorId, "aal2")) === null
  )
    throw Error("ORIGINAL_INDEPENDENT_AAL2_OPERATOR_REQUIRED");
}

async function withActor278(actorId, fn) {
  const client = await originalPool270().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [actorId]);
    const output = await fn(client);
    await client.query("commit");
    return output;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function recordFieldAttestation278({
  reviewerId,
  responseId,
  evidenceDigest,
}) {
  const form = validateFieldReview278({ responseId, evidenceDigest });
  await requireIndependentOperator278(reviewerId);
  const q = await originalPool270().query(
    "select c.source_id,c.key_id,c.commit_sha,c.challenge_id,c.request_nonce," +
      "c.issued_at,c.expires_at,r.signed_body,r.signature_b64url," +
      "r.body_sha256,r.accepted_at from icamp_private.peer_challenge_response277 r " +
      "join icamp_private.peer_challenge277 c on c.id=r.challenge_id where r.id=$1",
    [form.responseId],
  );
  if (q.rowCount !== 1) throw Error("ORIGINAL_RESPONSE_NOT_FOUND");
  const row = q.rows[0];
  const pins = await ownerAdoptedPins277();
  const receipt = verifyFieldResponse277({
    body: row.signed_body,
    signature: row.signature_b64url,
    pins,
    issued: {
      source: row.source_id,
      keyId: row.key_id,
      commitSha: row.commit_sha,
      challengeId: row.challenge_id,
      requestNonce: row.request_nonce,
      issuedAt: Date.parse(row.issued_at),
      expiresAt: Date.parse(row.expires_at),
    },
  });
  if (
    receipt.digest !== row.body_sha256 ||
    Date.now() - Date.parse(row.accepted_at) > 300000
  )
    throw Error("ORIGINAL_RECEIPT_EXPIRED_OR_TAMPERED");
  return withActor278(reviewerId, async (client) => {
    const r = await client.query(
      "insert into icamp_private.peer_field_review278 " +
        "(challenge_response_id,reviewer_user_id,external_source_digest_sha256) " +
        "values($1,$2,$3) on conflict do nothing returning id",
      [form.responseId, reviewerId, form.evidenceDigest],
    );
    if (r.rowCount !== 1)
      throw Error("INDEPENDENT_FIELD_REVIEW_DENIED_OR_DUPLICATE");
    return {
      stored: true,
      status: "INDEPENDENT_FIELD_REVIEW_STORED_EXTERNAL_CUSTODY_PENDING",
    };
  });
}

export async function recordOwnerMfaReadback278({
  reviewerId,
  sessionId,
  ownerId,
  evidenceDigest,
}) {
  const form = validateMfaReview278({ sessionId, ownerId, evidenceDigest });
  await requireIndependentOperator278(reviewerId);
  return withActor278(reviewerId, async (client) => {
    const r = await client.query(
      "insert into icamp_private.owner_mfa_readback278 " +
        "(session_id,owner_user_id,reviewer_user_id,external_evidence_sha256) " +
        "values($1,$2,$3,$4) on conflict do nothing returning id",
      [form.sessionId, form.ownerId, reviewerId, form.evidenceDigest],
    );
    if (r.rowCount !== 1)
      throw Error("INDEPENDENT_ORIGINAL_OWNER_MFA_REVIEW_DENIED");
    return {
      stored: true,
      status: "ORIGINAL_OWNER_MFA_REVIEW_STORED_SESSION_STILL_REQUIRED",
    };
  });
}

export async function recordRestoreServiceReadback278({
  reviewerId,
  externalReviewId,
  providerDigest,
  isolatedDigest,
  evidenceDigest,
}) {
  const form = validateExternalReadback278({
    externalReviewId,
    providerDigest,
    isolatedDigest,
    evidenceDigest,
  });
  await requireIndependentOperator278(reviewerId);
  return withActor278(reviewerId, async (client) => {
    const r = await client.query(
      "insert into icamp_private.restore_service_readback278 " +
        "(external_review_id,reviewer_user_id,provider_service_evidence_sha256," +
        "isolated_service_evidence_sha256,readback_evidence_sha256) " +
        "values($1,$2,$3,$4,$5) on conflict do nothing returning id",
      [
        form.externalReviewId,
        reviewerId,
        form.providerDigest,
        form.isolatedDigest,
        form.evidenceDigest,
      ],
    );
    if (r.rowCount !== 1)
      throw Error("EXTERNAL_RESTORE_SERVICE_WITNESS_DENIED");
    return {
      stored: true,
      status: "SERVICE_READBACK_REVIEW_STORED_NO_PRODUCTION_RESTORE",
    };
  });
}

export async function fieldReadback278() {
  const admission = await originalAdmission278();
  const empty = summarizeField278([]);
  if (!admission.adopted)
    return { ...empty, admission, status: admission.status, records: [] };
  try {
    const [q, pins] = await Promise.all([
      originalPool270().query(
        "select distinct on(c.source_id) c.source_id,c.key_id,c.commit_sha," +
          "c.challenge_id,c.request_nonce,c.issued_at,c.expires_at," +
          "r.id as response_id,r.accepted_at,r.signed_body,r.signature_b64url," +
          "r.body_sha256,w.reviewed_at " +
          "from icamp_private.peer_challenge277 c " +
          "join icamp_private.peer_challenge_response277 r on r.challenge_id=c.id " +
          "left join icamp_private.peer_field_review278 w on w.challenge_response_id=r.id " +
          "where r.accepted_at >=statement_timestamp()-interval '5 minutes' " +
          "order by c.source_id,r.accepted_at desc",
      ),
      ownerAdoptedPins277(),
    ]);
    const verified = classifyFieldReadback277(q.rows, pins);
    const items = q.rows.map((x) => ({
      source: x.source_id,
      responseId: x.response_id,
      acceptedAt: x.accepted_at,
      reviewedAt: x.reviewed_at,
      cryptographic: verified.checks.some(
        (z) => z.source === x.source_id && z.status !== "HOLD",
      ),
    }));
    const grouped = summarizeField278(items);
    return {
      ...grouped,
      admission,
      records: items.map((x) => ({
        source: x.source,
        responseId: x.responseId,
        reviewed: Boolean(x.reviewedAt),
        signed: x.cryptographic,
      })),
    };
  } catch {
    return {
      ...empty,
      admission,
      status: "HOLD_ORIGINAL_FIELD_REVIEW_READBACK",
      records: [],
    };
  }
}

export async function ownerReadback278(session) {
  const admission = await originalAdmission278();
  const owner = await actualOwnerReadback276(session);
  if (!admission.adopted) return { status: admission.status, owner };
  try {
    const r = await originalPool270().query(
      "select owner_user_id,session_id from icamp_private.owner_mfa_readback278 " +
        "where session_id=$1 and owner_user_id=$2 limit 1",
      [session.sessionId, session.user.id],
    );
    const row = r.rows[0];
    return {
      ...summarizeOwner278(
        owner,
        session,
        row
          ? {
              sessionId: row.session_id,
              ownerId: row.owner_user_id,
            }
          : null,
      ),
      owner,
    };
  } catch {
    return { status: "HOLD_ORIGINAL_OWNER_MFA_READBACK", owner };
  }
}

export async function restoreReadback278() {
  const admission = await originalAdmission278();
  const empty = summarizeRestore278([]);
  if (!admission.adopted)
    return { ...empty, admission, status: admission.status, records: [] };
  try {
    const q = await originalPool270().query(
      "select e.id,e.reviewed_at,s.id is not null as witnessed " +
        "from icamp_private.external_restore_review277 e " +
        "left join icamp_private.restore_service_readback278 s " +
        "on s.external_review_id=e.id order by e.reviewed_at desc limit 40",
    );
    const review = summarizeRestore278(
      q.rows.map((x) => ({ independent: x.witnessed })),
    );
    return {
      ...review,
      admission,
      records: q.rows.map((x) => ({
        externalReviewId: x.id,
        witnessed: x.witnessed,
      })),
    };
  } catch {
    return {
      ...empty,
      admission,
      status: "HOLD_ORIGINAL_RESTORE_SERVICE_READBACK",
      records: [],
    };
  }
}

export async function acceptanceSummary278(session) {
  const [admission, owner, peers, restore] = await Promise.all([
    originalAdmission278(),
    ownerReadback278(session),
    fieldReadback278(),
    restoreReadback278(),
  ]);
  const closure = classifyClosure278({
    host: admission.host,
    migrationAdopted: admission.adopted,
    owner,
    peers,
    restore,
  });
  return { admission, owner, peers, restore, closure };
}
