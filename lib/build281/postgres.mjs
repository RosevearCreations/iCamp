import { originalPool270 } from "../build270/postgres.mjs";
import { originalAdmission280 } from "../build280/postgres.mjs";
import { sourceCorrelations279 } from "../build279/postgres.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { UUID276 } from "../build276/core.mjs";
import {
  validateProviderKey280,
  verifyProviderClosure280,
  scopeDigest280,
} from "../build280/core.mjs";
import {
  validateCustodyReview281,
  validateMfaContinuity281,
  validateFinalAck281,
  validateMonitorSample281,
  verifyExternalProviderAck281,
  classifyLiveMonitor281,
} from "./core.mjs";

export async function originalAdmission281() {
  const prior = await originalAdmission280();
  const result = { adopted: false, host: prior.host, status: prior.status };
  if (!prior.adopted || !prior.host.pinned) return result;
  try {
    const q = await originalPool270().query(
      "select to_regclass('icamp_private.provider_custody_review281') is not null as custody," +
        "to_regclass('icamp_private.owner_mfa_continuity281') is not null as owner," +
        "to_regclass('icamp_private.external_restore_final_ack281') is not null as signed_ack," +
        "to_regclass('icamp_private.original_restore_monitor_sample281') is not null as monitor," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0254') as predecessor," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0255') as migration",
    );
    result.adopted = Object.values(q.rows[0] ?? {}).every((x) => x === true);
    result.status = result.adopted
      ? "ORIGINAL_0255_SCHEMA_PRESENT_EXTERNAL_PROOFS_REQUIRED"
      : "HOLD_ORIGINAL_MIGRATION_0255";
  } catch {
    result.status = "HOLD_ORIGINAL_MIGRATION_0255_READBACK";
  }
  return result;
}
async function requireReviewer281(id) {
  if (
    !UUID276.test(id) ||
    !(await originalAdmission281()).adopted ||
    (await getPlatformOverview(id, "aal2")) === null
  )
    throw Error("ORIGINAL_AAL2_SEPARATE_REVIEWER_REQUIRED");
}
async function withActor281(actorId, fn) {
  const client = await originalPool270().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [actorId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
const providerContextSql281 =
  "select c.id as original_closure_id,c.signed_body as closure_body," +
  "c.signature_b64url as closure_signature,c.body_sha256 as closure_digest," +
  "c.recorded_at as closure_recorded_at,c.provider_id as closure_provider_id," +
  "c.provider_event_id as closure_event_id,c.nonce as closure_nonce," +
  "p.provider_id,p.key_id,p.public_key_pem,p.key_fingerprint_sha256," +
  "p.independent_source_evidence_sha256,i.original_backup_manifest_sha256," +
  "i.tenant_isolation_sha256,i.reservation_integrity_sha256," +
  "i.payment_ledger_sha256,i.service_health_sha256," +
  "a.provider_id as original_provider_id,a.source_host_sha256,a.isolated_host_sha256 " +
  "from icamp_private.external_provider_signed_closure280 c " +
  "join icamp_private.external_provider_key_review280 k on k.id=c.key_review_id " +
  "join icamp_private.external_provider_key_proposal280 p on p.id=k.proposal_id " +
  "join icamp_private.isolated_restore_evidence279 i on i.id=c.isolated_evidence_id " +
  "join icamp_private.restore_service_readback278 s on s.id=i.service_readback_id " +
  "join icamp_private.external_restore_review277 e on e.id=s.external_review_id " +
  "join icamp_private.restore_closure_review276 cr on cr.id=e.closure_review_id " +
  "join icamp_private.restore_provider_attestation273 a on a.id=cr.provider_attestation_id " +
  "where c.id=$1 and c.provider_id=a.provider_id " +
  "and e.source_host_sha256=a.source_host_sha256 " +
  "and e.isolated_host_sha256=a.isolated_host_sha256 ";
async function verifiedOriginalContext281(closureId) {
  const q = await originalPool270().query(providerContextSql281, [closureId]);
  if (q.rowCount !== 1)
    throw Error("ORIGINAL_EXTERNAL_PROVIDER_CONTEXT_MISSING");
  const r = q.rows[0];
  const providerKey = validateProviderKey280({
    providerId: r.provider_id,
    keyId: r.key_id,
    publicKeyPem: r.public_key_pem,
    fingerprint: r.key_fingerprint_sha256,
    evidenceDigest: r.independent_source_evidence_sha256,
  });
  const original = {
    providerId: r.original_provider_id,
    sourceHostSha256: r.source_host_sha256,
    isolatedHostSha256: r.isolated_host_sha256,
    backupManifestSha256: r.original_backup_manifest_sha256,
    scopeDigestSha256: scopeDigest280(r),
  };
  const signed = verifyProviderClosure280({
    body: r.closure_body,
    signature: r.closure_signature,
    providerKey,
    original,
    now: new Date(r.closure_recorded_at).getTime(),
  });
  if (
    signed.digest !== r.closure_digest ||
    signed.providerId !== r.closure_provider_id
  )
    throw Error("TAMPERED_ORIGINAL_EXTERNAL_PROVIDER_CLOSURE");
  return { record: r, providerKey, signed };
}
export async function recordCustodyAudit281({
  reviewerId,
  providerClosureId,
  evidenceDigest,
}) {
  const v = validateCustodyReview281({ providerClosureId, evidenceDigest });
  await requireReviewer281(reviewerId);
  await verifiedOriginalContext281(v.providerClosureId);
  return withActor281(reviewerId, async (client) => {
    const q = await client.query(
      "insert into icamp_private.provider_custody_review281 " +
        "(provider_closure_id,reviewed_by,original_custody_evidence_sha256) " +
        "values($1,$2,$3) on conflict do nothing returning id",
      [v.providerClosureId, reviewerId, v.evidenceDigest],
    );
    if (q.rowCount !== 1)
      throw Error("ORIGINAL_CUSTODY_INDEPENDENT_REVIEW_REJECTED");
    return {
      status: "EXTERNAL_PROVIDER_ORIGINAL_SIGNING_KEY_CUSTODY_REVIEW_RECORDED",
    };
  });
}
export async function recordOwnerContinuity281({
  reviewerId,
  originalWitnessId,
  sessionId,
  evidenceDigest,
}) {
  const v = validateMfaContinuity281({
    originalWitnessId,
    sessionId,
    evidenceDigest,
  });
  await requireReviewer281(reviewerId);
  return withActor281(reviewerId, async (client) => {
    const q = await client.query(
      "insert into icamp_private.owner_mfa_continuity281 " +
        "(original_witness_id,session_id,reviewer_user_id,continuity_evidence_sha256) " +
        "values($1,$2,$3,$4) on conflict do nothing returning id",
      [v.originalWitnessId, v.sessionId, reviewerId, v.evidenceDigest],
    );
    if (q.rowCount !== 1)
      throw Error("LIVE_ORIGINAL_ROSEVEAR_MFA_CONTINUITY_REJECTED");
    return {
      status:
        "ORIGINAL_ROSEVEAR_MFA_CONTINUITY_REVIEW_RECORDED_SESSION_STILL_REQUIRED",
    };
  });
}
const externalContextSql281 =
  "select cert.id as certificate_id,cert.provider_closure_id," +
  "pc.id as custody_review_id,pc.reviewed_at as custody_reviewed_at," +
  "oc.id as owner_continuity_id,oc.witnessed_at as mfa_witnessed_at," +
  "oc.session_id,s.user_id as original_owner_id,s.reauthenticated_at," +
  "s.revoked_at,s.expires_at,s.assurance_level " +
  "from icamp_private.isolated_restore_certificate280 cert " +
  "join icamp_private.provider_custody_review281 pc " +
  "on pc.provider_closure_id=cert.provider_closure_id " +
  "join icamp_private.owner_mfa_continuity281 oc on oc.original_witness_id=cert.owner_witness_id " +
  "join icamp_private.auth_sessions s on s.id=oc.session_id " +
  "where cert.id=$1 and pc.id=$2 and oc.id=$3";
async function verifiedExternalAck281(row, now = Date.now()) {
  const originalClosure = await verifiedOriginalContext281(
    row.provider_closure_id,
  );
  const r = originalClosure.record;
  const original = {
    providerId: r.original_provider_id,
    originalClosureId: row.provider_closure_id,
    certificateId: row.certificate_id,
    originalClosureDigest: r.closure_digest,
    sourceHostSha256: r.source_host_sha256,
    isolatedHostSha256: r.isolated_host_sha256,
  };
  const receipt = verifyExternalProviderAck281({
    body: row.signed_body,
    signature: row.signature_b64url,
    providerKey: originalClosure.providerKey,
    original,
    now,
  });
  if (
    receipt.digest !== row.body_sha256 ||
    receipt.providerEventId === r.closure_event_id ||
    receipt.nonce === r.closure_nonce ||
    receipt.providerId !== row.provider_id
  )
    throw Error("PROVIDER_ACK_REPLAY_OR_DIGEST_MISMATCH");
  return receipt;
}
async function liveOwnerContinuity281(row, now = Date.now()) {
  const session = await originalPool270().query(
    "select s.id,s.user_id,s.assurance_level,s.revoked_at,s.expires_at," +
      "s.reauthenticated_at,a.username_normalized,a.account_state " +
      "from icamp_private.auth_sessions s " +
      "join icamp_private.user_accounts a on a.id=s.user_id where s.id=$1",
    [row.session_id],
  );
  if (session.rowCount !== 1) return false;
  const s = session.rows[0];
  const t = Date.parse(s.reauthenticated_at ?? "");
  return (
    s.id === row.session_id &&
    s.user_id === row.original_owner_id &&
    s.username_normalized === "rosevear" &&
    s.account_state === "active" &&
    s.assurance_level === "aal2" &&
    s.revoked_at === null &&
    Date.parse(s.expires_at) > now &&
    Number.isFinite(t) &&
    t <= now + 30000 &&
    now - t <= 900000 &&
    now - Date.parse(row.mfa_witnessed_at) <= 900000
  );
}
export async function recordExternalFinalAck281({ reviewerId, ...raw }) {
  const v = validateFinalAck281(raw);
  await requireReviewer281(reviewerId);
  const q = await originalPool270().query(externalContextSql281, [
    v.certificateId,
    v.custodyReviewId,
    v.ownerContinuityId,
  ]);
  if (q.rowCount !== 1 || !(await liveOwnerContinuity281(q.rows[0])))
    throw Error("ORIGINAL_EXTERNAL_PROVIDER_MFA_CUSTODY_CHAIN_MISSING");
  const row = q.rows[0],
    provider = await verifiedOriginalContext281(row.provider_closure_id);
  const original = {
    providerId: provider.record.original_provider_id,
    originalClosureId: row.provider_closure_id,
    certificateId: row.certificate_id,
    originalClosureDigest: provider.record.closure_digest,
    sourceHostSha256: provider.record.source_host_sha256,
    isolatedHostSha256: provider.record.isolated_host_sha256,
  };
  const receipt = verifyExternalProviderAck281({
    body: v.body,
    signature: v.signature,
    providerKey: provider.providerKey,
    original,
  });
  if (
    receipt.providerEventId === provider.record.closure_event_id ||
    receipt.nonce === provider.record.closure_nonce
  )
    throw Error("EXTERNAL_ACK_MUST_HAVE_FRESH_DISTINCT_SIGNING_EVENT");
  const peers = await sourceCorrelations279();
  if (peers.verifiedCount !== 7)
    throw Error("SEVEN_REAL_FRESH_SOURCES_REQUIRED");
  return withActor281(reviewerId, async (client) => {
    const saved = await client.query(
      "insert into icamp_private.external_restore_final_ack281 " +
        "(certificate_id,custody_review_id,owner_continuity_id,provider_id," +
        "provider_event_id,nonce,signed_body,signature_b64url,body_sha256," +
        "independently_reviewed_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) " +
        "on conflict do nothing returning id",
      [
        v.certificateId,
        v.custodyReviewId,
        v.ownerContinuityId,
        receipt.providerId,
        receipt.providerEventId,
        receipt.nonce,
        v.body,
        v.signature,
        receipt.digest,
        reviewerId,
      ],
    );
    if (saved.rowCount !== 1)
      throw Error("EXTERNAL_PROVIDER_FINAL_ACK_REPLAY_OR_REVIEW_DENIED");
    return {
      status: "REAL_EXTERNAL_PROVIDER_ED25519_ACK_VERIFIED_MONITORING_REQUIRED",
    };
  });
}
const ackReadSql281 =
  "select x.id,x.certificate_id,x.custody_review_id,x.owner_continuity_id," +
  "x.signed_body,x.signature_b64url,x.body_sha256,x.provider_id,x.recorded_at," +
  "c.provider_closure_id,oc.session_id,s.user_id as original_owner_id," +
  "oc.witnessed_at as mfa_witnessed_at " +
  "from icamp_private.external_restore_final_ack281 x " +
  "join icamp_private.isolated_restore_certificate280 c on c.id=x.certificate_id " +
  "join icamp_private.owner_mfa_continuity281 oc on oc.id=x.owner_continuity_id " +
  "join icamp_private.auth_sessions s on s.id=oc.session_id ";
async function latestVerifiedAck281() {
  const q = await originalPool270().query(
    ackReadSql281 +
      "where x.recorded_at>=statement_timestamp()-interval '5 minutes' " +
      "order by x.recorded_at desc limit 12",
  );
  for (const row of q.rows) {
    try {
      const receipt = await verifiedExternalAck281(row);
      if (await liveOwnerContinuity281(row))
        return {
          id: row.id,
          providerId: receipt.providerId,
          certificateId: row.certificate_id,
          recordedAt: row.recorded_at,
          originalAckVerified: true,
        };
    } catch {}
  }
  return null;
}
export async function recordMonitorSample281({
  reviewerId,
  ackId,
  evidenceDigest,
}) {
  const v = validateMonitorSample281({ ackId, evidenceDigest });
  await requireReviewer281(reviewerId);
  const [ack, peers] = await Promise.all([
    latestVerifiedAck281(),
    sourceCorrelations279(),
  ]);
  if (!ack || ack.id !== v.ackId || peers.verifiedCount !== 7)
    throw Error("REAL_PROVIDER_ACK_MFA_OR_SEVEN_SOURCES_EXPIRED");
  return withActor281(reviewerId, async (client) => {
    const q = await client.query(
      "insert into icamp_private.original_restore_monitor_sample281 " +
        "(external_ack_id,sampler_user_id,original_review_evidence_sha256) " +
        "values($1,$2,$3) returning id",
      [v.ackId, reviewerId, v.evidenceDigest],
    );
    if (q.rowCount !== 1) throw Error("LIVE_ORIGINAL_MONITOR_SAMPLE_REJECTED");
    return {
      status: "SIGNED_EXTERNAL_PROVIDER_AND_ROSEVEAR_MONITOR_SNAPSHOT_STORED",
    };
  });
}
export async function acceptanceSummary281() {
  const admission = await originalAdmission281();
  const empty = {
    admission,
    status: admission.status,
    custodyCandidates: [],
    mfaWitnessCandidates: [],
    custodyReviews: [],
    mfaContinuity: [],
    ackCandidates: [],
    signedAck: null,
    samples: [],
    sourceCount: 0,
    monitoring: classifyLiveMonitor281({
      admission,
      providerCustody: false,
      ownerContinuity: false,
      providerAck: false,
      sourceCount: 0,
      certificatePresent: false,
      sampledAt: null,
    }),
  };
  if (!admission.adopted) return empty;
  try {
    const [closures, custody, owners, continuity, certs, samples, peers, ack] =
      await Promise.all([
        originalPool270().query(
          "select id from icamp_private.external_provider_signed_closure280 " +
            "where recorded_at>=statement_timestamp()-interval '7 days' order by recorded_at desc limit 25",
        ),
        originalPool270().query(
          "select id,provider_closure_id,reviewed_at from icamp_private.provider_custody_review281 " +
            "order by reviewed_at desc limit 25",
        ),
        originalPool270().query(
          "select w.id,w.witnessed_at,s.id as session_id " +
            "from icamp_private.owner_recovery_witness280 w " +
            "join icamp_private.owner_recovery_access_audit279 a on a.id=w.owner_audit_id " +
            "join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id " +
            "join icamp_private.auth_sessions s on s.id=m.session_id " +
            "where s.assurance_level='aal2' and s.revoked_at is null " +
            "and s.expires_at>statement_timestamp() " +
            "and s.reauthenticated_at>statement_timestamp()-interval '15 minutes' " +
            "order by w.witnessed_at desc limit 25",
        ),
        originalPool270().query(
          "select id,original_witness_id,session_id,witnessed_at " +
            "from icamp_private.owner_mfa_continuity281 " +
            "where witnessed_at>=statement_timestamp()-interval '15 minutes' " +
            "order by witnessed_at desc limit 25",
        ),
        originalPool270().query(
          "select id,provider_closure_id,owner_witness_id " +
            "from icamp_private.isolated_restore_certificate280 " +
            "order by created_at desc limit 25",
        ),
        originalPool270().query(
          "select id,external_ack_id,observed_at from " +
            "icamp_private.original_restore_monitor_sample281 " +
            "order by observed_at desc limit 20",
        ),
        sourceCorrelations279(),
        latestVerifiedAck281(),
      ]);
    const eligibleClosures = [];
    for (const x of closures.rows) {
      try {
        const verified = await verifiedOriginalContext281(x.id);
        eligibleClosures.push({
          id: x.id,
          providerId: verified.signed.providerId,
        });
      } catch {}
    }
    const verifiedCustody = custody.rows.filter((x) =>
      eligibleClosures.some((k) => k.id === x.provider_closure_id),
    );
    const liveContinuity = [];
    for (const x of continuity.rows) {
      const owner = owners.rows.find(
        (o) => o.id === x.original_witness_id && o.session_id === x.session_id,
      );
      if (owner) liveContinuity.push({ id: x.id, sessionId: x.session_id });
    }
    const freshSample = samples.rows.find((x) => x.external_ack_id === ack?.id);
    const monitoring = classifyLiveMonitor281({
      admission,
      providerCustody: verifiedCustody.length > 0,
      ownerContinuity: liveContinuity.length > 0,
      providerAck: Boolean(ack),
      sourceCount: peers.verifiedCount,
      certificatePresent: certs.rowCount > 0,
      sampledAt: freshSample?.observed_at ?? null,
    });
    return {
      admission,
      status: monitoring.status,
      custodyCandidates: eligibleClosures,
      custodyReviews: verifiedCustody.map((x) => ({
        id: x.id,
        closureId: x.provider_closure_id,
      })),
      mfaWitnessCandidates: owners.rows.map((x) => ({
        id: x.id,
        sessionId: x.session_id,
      })),
      mfaContinuity: liveContinuity,
      ackCandidates: certs.rows.map((x) => ({
        id: x.id,
        closureId: x.provider_closure_id,
        ownerWitnessId: x.owner_witness_id,
      })),
      signedAck: ack,
      sourceCount: peers.verifiedCount,
      samples: samples.rows.map((x) => ({
        id: x.id,
        ackId: x.external_ack_id,
        observedAt: x.observed_at,
      })),
      monitoring,
    };
  } catch {
    return { ...empty, status: "HOLD_ORIGINAL_PROVIDER_MFA_MONITOR_READBACK" };
  }
}

export async function historicalRestoreAck282(ackId) {
  if (!UUID276.test(ackId) || !(await originalAdmission281()).adopted)
    throw Error("ORIGINAL_RESTORE_HISTORY_UNAVAILABLE");
  const q = await originalPool270().query(ackReadSql281 + "where x.id=$1", [
    ackId,
  ]);
  if (q.rowCount !== 1) throw Error("ORIGINAL_RESTORE_ACK_MISSING");
  const row = q.rows[0];
  const receipt = await verifiedExternalAck281(
    row,
    new Date(row.recorded_at).getTime(),
  );
  const context = await verifiedOriginalContext281(row.provider_closure_id);
  return {
    id: row.id,
    digest: receipt.digest,
    providerKey: context.providerKey,
  };
}
