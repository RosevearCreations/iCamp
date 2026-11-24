import {
  originalPool270,
  inspectOwnerEnrollment270,
} from "../build270/postgres.mjs";
import { originalAdmission273 } from "../build273/postgres.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { verifySigned275 } from "../build275/diagnostics.mjs";
import {
  UUID276,
  SHA276,
  validateSigner276,
  validateRegistryRow276,
  classifyOwner276,
  verifyReadback276,
  classifyRestore276,
} from "./core.mjs";

export async function originalAdmission276() {
  const previous = await originalAdmission273();
  const status = {
    adopted: false,
    hostPinned: previous.hostPinned === true,
    status: "HOLD_ORIGINAL_0250_OR_PIN",
  };
  if (!previous.adopted || !status.hostPinned) return status;
  try {
    const result = await originalPool270().query(
      "select to_regclass('icamp_private.peer_signer_proposal276') is not null as proposals," +
        "to_regclass('icamp_private.peer_signer_review276') is not null as reviews," +
        "to_regclass('icamp_private.restore_closure_review276') is not null as restores," +
        "to_regclass('icamp_private.signed_source_handshake275') is not null as receipts," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0249') as predecessor," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0250') as migration",
    );
    status.adopted = Object.values(result.rows[0] ?? {}).every(
      (x) => x === true,
    );
    status.status = status.adopted
      ? "ORIGINAL_0250_SCHEMA_READY_EXTERNAL_WITNESS_HOLD"
      : "HOLD_MIGRATION_0250";
  } catch {
    status.status = "HOLD_ORIGINAL_0250_QUERY";
  }
  return status;
}

async function requireOriginalOperator276(userId) {
  if (
    !UUID276.test(userId) ||
    !(await originalAdmission276()).adopted ||
    (await getPlatformOverview(userId, "aal2")) === null
  )
    throw Error("ORIGINAL_INDEPENDENT_OPERATOR_NOT_VERIFIED");
}
async function transaction276(userId, work) {
  const client = await originalPool270().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function proposePeerSigner276({ actorId, ...raw }) {
  const candidate = validateSigner276(raw);
  await requireOriginalOperator276(actorId);
  return transaction276(actorId, async (client) => {
    const r = await client.query(
      "insert into icamp_private.peer_signer_proposal276 " +
        "(source_id,key_id,commit_sha,public_key_pem,key_fingerprint_sha256,evidence_sha256,proposed_by) " +
        "values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning id",
      [
        candidate.sourceId,
        candidate.keyId,
        candidate.commitSha,
        candidate.publicKeyPem,
        candidate.keyFingerprint,
        candidate.evidenceDigest,
        actorId,
      ],
    );
    if (r.rowCount !== 1) throw Error("SIGNER_PROPOSAL_DUPLICATE_OR_DENIED");
    return {
      stored: true,
      status: "PROPOSED_SECOND_INDEPENDENT_REVIEW_REQUIRED",
    };
  });
}

export async function approvePeerSigner276({
  reviewerId,
  proposalId,
  reviewDigest,
}) {
  if (!UUID276.test(proposalId) || !SHA276.test(reviewDigest))
    throw Error("INVALID_SIGNER_REVIEW");
  await requireOriginalOperator276(reviewerId);
  return transaction276(reviewerId, async (client) => {
    const candidate = await client.query(
      "select source_id,key_id,commit_sha,public_key_pem,key_fingerprint_sha256,evidence_sha256 " +
        "from icamp_private.peer_signer_proposal276 where id=$1",
      [proposalId],
    );
    if (candidate.rowCount !== 1 || !validateRegistryRow276(candidate.rows[0]))
      throw Error("INVALID_PEER_SIGNER_CANDIDATE");
    const result = await client.query(
      "insert into icamp_private.peer_signer_review276 " +
        "(proposal_id,reviewed_by,review_evidence_sha256) " +
        "values($1,$2,$3) on conflict do nothing returning id",
      [proposalId, reviewerId, reviewDigest],
    );
    if (result.rowCount !== 1)
      throw Error("INDEPENDENT_REVIEW_DUPLICATE_OR_DENIED");
    return {
      stored: true,
      status: "INDEPENDENT_PIN_REVIEW_RECORDED_SOURCE_CHALLENGE_REQUIRED",
    };
  });
}

export async function approvedPeerPins276() {
  if (!(await originalAdmission276()).adopted) return {};
  const rows = await originalPool270().query(
    "select distinct on (p.source_id) p.source_id,p.key_id,p.commit_sha,p.public_key_pem," +
      "p.key_fingerprint_sha256,p.evidence_sha256 " +
      "from icamp_private.peer_signer_proposal276 p " +
      "join icamp_private.peer_signer_review276 r on r.proposal_id=p.id " +
      "order by p.source_id,r.reviewed_at desc,p.id desc",
  );
  const pins = {};
  for (const row of rows.rows) {
    const validated = validateRegistryRow276(row);
    if (validated)
      pins[validated.sourceId] = {
        keyId: validated.keyId,
        commitSha: validated.commitSha,
        publicKeyPem: validated.publicKeyPem,
      };
  }
  return pins;
}

export async function originalPeerOverview276() {
  const admission = await originalAdmission276();
  if (!admission.adopted)
    return { admission, status: admission.status, proposals: [] };
  try {
    const r = await originalPool270().query(
      "select p.id,p.source_id,p.key_id,p.commit_sha,p.key_fingerprint_sha256," +
        "p.proposed_at,r.reviewed_at from icamp_private.peer_signer_proposal276 p " +
        "left join icamp_private.peer_signer_review276 r on r.proposal_id=p.id " +
        "order by p.proposed_at desc limit 42",
    );
    return {
      admission,
      status: "PROPOSALS_REQUIRE_INDEPENDENT_REVIEW_AND_LIVE_CHALLENGE",
      proposals: r.rows.map((x) => ({
        id: x.id,
        sourceId: x.source_id,
        keyId: x.key_id,
        commitSha: x.commit_sha,
        fingerprint: x.key_fingerprint_sha256,
        reviewed: Boolean(x.reviewed_at),
      })),
    };
  } catch {
    return {
      admission,
      status: "HOLD_ORIGINAL_SIGNER_OVERVIEW",
      proposals: [],
    };
  }
}

export async function actualOwnerReadback276(session) {
  const owner = await inspectOwnerEnrollment270();
  let witnesses = 0;
  if ((await originalAdmission276()).adopted) {
    try {
      const q = await originalPool270().query(
        "select count(*)::integer as n from icamp_private.owner_login_witness272 w " +
          "join icamp_private.auth_sessions s on s.id=w.session_id " +
          "join icamp_private.user_accounts a on a.id=w.subject_user_id " +
          "where a.username_normalized='rosevear' and s.user_id=a.id " +
          "and s.assurance_level='aal2' and s.revoked_at is null " +
          "and s.expires_at>statement_timestamp()",
      );
      witnesses = q.rows[0]?.n ?? 0;
    } catch {
      witnesses = 0;
    }
  }
  return classifyOwner276(
    owner,
    {
      originalRosevear: session.user.username?.toLowerCase() === "rosevear",
      aal2: session.assuranceLevel === "aal2",
    },
    witnesses,
  );
}

export async function signedPeerReadback276() {
  const admission = await originalAdmission276();
  const empty = verifyReadback276([], {}, Date.now());
  if (!admission.adopted)
    return { ...empty, admission, status: admission.status };
  try {
    const pins = await approvedPeerPins276();
    const r = await originalPool270().query(
      "select distinct on (source_id) source_id,key_id,commit_sha," +
        "signed_body,signature_b64url,body_sha256,observed_at " +
        "from icamp_private.signed_source_handshake275 " +
        "where observed_at>=statement_timestamp()-interval '5 minutes' " +
        "and observed_at<=statement_timestamp()+interval '30 seconds' " +
        "order by source_id,observed_at desc",
    );
    return { ...verifyReadback276(r.rows, pins), admission };
  } catch {
    return { ...empty, admission, status: "HOLD_SIGNED_PEER_ORIGIN_READBACK" };
  }
}

export async function acceptIndependentHandshake276(body, signature) {
  const admission = await originalAdmission276();
  if (!admission.adopted) throw Error("ORIGINAL_HOST_0250_UNVERIFIED");
  const pins = await approvedPeerPins276();
  const receipt = verifySigned275({ body, signature, pins });
  const r = await originalPool270().query(
    "insert into icamp_private.signed_source_handshake275 " +
      "(source_id,key_id,commit_sha,challenge_id,nonce,observed_at," +
      "signed_body,signature_b64url,body_sha256) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing returning id",
    [
      receipt.source,
      receipt.keyId,
      receipt.commitSha,
      receipt.challengeId,
      receipt.nonce,
      receipt.observedAt,
      receipt.body,
      receipt.signature,
      receipt.digest,
    ],
  );
  if (r.rowCount !== 1) throw Error("ORIGINAL_RECEIPT_REPLAY_OR_DENIED");
  return {
    accepted: true,
    status: "SIGNATURE_VERIFIED_ORIGINAL_RECEIPT_REVIEW_REQUIRED",
  };
}

export async function originalRestoreReadback276() {
  const admission = await originalAdmission276();
  if (!admission.adopted)
    return { admission, status: admission.status, records: [], reviewed: 0 };
  try {
    const r = await originalPool270().query(
      "select a.id,a.provider_id,a.recorded_at,r.reviewed_at " +
        "from icamp_private.restore_provider_attestation273 a " +
        "left join icamp_private.restore_closure_review276 r " +
        "on r.provider_attestation_id=a.id order by a.recorded_at desc limit 40",
    );
    return {
      ...classifyRestore276(r.rows),
      admission,
      records: r.rows.map((row) => ({
        id: row.id,
        providerId: row.provider_id,
        reviewed: Boolean(row.reviewed_at),
      })),
    };
  } catch {
    return {
      admission,
      status: "HOLD_ORIGINAL_RESTORE_READBACK",
      records: [],
      reviewed: 0,
    };
  }
}

export async function recordIndependentRestoreReview276({
  reviewerId,
  attestationId,
  evidenceDigest,
}) {
  if (!UUID276.test(attestationId) || !SHA276.test(evidenceDigest))
    throw Error("INVALID_ORIGINAL_RESTORE_REVIEW");
  await requireOriginalOperator276(reviewerId);
  return transaction276(reviewerId, async (client) => {
    const r = await client.query(
      "insert into icamp_private.restore_closure_review276 " +
        "(provider_attestation_id,reviewed_by,independent_evidence_sha256) " +
        "values($1,$2,$3) on conflict do nothing returning id",
      [attestationId, reviewerId, evidenceDigest],
    );
    if (r.rowCount !== 1) throw Error("ORIGINAL_RESTORE_SECOND_REVIEW_DENIED");
    return {
      stored: true,
      status: "INDEPENDENT_RESTORE_REVIEW_RECORDED_EXTERNAL_ACCEPTANCE_PENDING",
    };
  });
}
