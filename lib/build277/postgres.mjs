import { randomBytes } from "node:crypto";
import { originalPool270 } from "../build270/postgres.mjs";
import { originalAdmission276, actualOwnerReadback276 } from "../build276/postgres.mjs";
import { validateRegistryRow276 } from "../build276/core.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { verifySigned275 } from "../build275/diagnostics.mjs";
import { UUID276, SHA276 } from "../build276/core.mjs";
import {
  originalHostPin277, validateOwnerPin277, verifyFieldResponse277,
  classifyFieldReadback277, classifyExternalRestore277, closure277,
} from "./core.mjs";

export async function originalAdmission277() {
  const host=originalHostPin277(
    process.env.DATABASE_URL,process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST);
  const status={host,adopted:false,status:"HOLD_ORIGINAL_HOST_0251"};
  if (!host.pinned) return {...status,status:host.status};
  const previous=await originalAdmission276();
  if(!previous.adopted) return {...status,status:previous.status};
  try {
    const r=await originalPool270().query(
      "select to_regclass('icamp_private.owner_peer_pin277') is not null as pin,"+
      "to_regclass('icamp_private.peer_challenge277') is not null as challenge,"+
      "to_regclass('icamp_private.peer_challenge_response277') is not null as response,"+
      "to_regclass('icamp_private.external_restore_review277') is not null as restore,"+
      "exists(select 1 from icamp_meta.schema_migrations where version='0250') as predecessor,"+
      "exists(select 1 from icamp_meta.schema_migrations where version='0251') as migration");
    status.adopted=Object.values(r.rows[0]??{}).every(x=>x===true);
    status.status=status.adopted?"ORIGINAL_0251_READY_FIELD_EVIDENCE_REQUIRED":
      "HOLD_ORIGINAL_MIGRATION_0251";
  } catch {status.status="HOLD_ORIGINAL_0251_READBACK";}
  return status;
}

async function requireOperator277(actorId) {
  if(!UUID276.test(actorId)||!(await originalAdmission277()).adopted ||
    (await getPlatformOverview(actorId,"aal2"))===null)
    throw Error("ORIGINAL_AAL2_INDEPENDENT_OPERATOR_REQUIRED");
}

async function transaction277(actorId,work) {
  const client=await originalPool270().connect();
  try {
    await client.query("begin");
    if (actorId) await client.query(
      "select set_config('icamp.user_id',$1,true)",[actorId]);
    const output=await work(client);
    await client.query("commit");
    return output;
  } catch(e) {
    await client.query("rollback").catch(()=>{});
    throw e;
  } finally {client.release();}
}

export async function adoptOwnerPeer277({
  proposalId,evidenceDigest,session,
}) {
  const accepted=validateOwnerPin277({
    proposalId,evidenceDigest,ownerSessionId:session.sessionId,
    ownerUserId:session.user.id,ownerUsername:session.user.username,
    assuranceLevel:session.assuranceLevel,
  });
  await requireOperator277(accepted.ownerUserId);
  return transaction277(accepted.ownerUserId,async client=>{
    const r=await client.query(
      "insert into icamp_private.owner_peer_pin277 "+
      "(proposal_id,owner_user_id,owner_session_id,external_proof_sha256) "+
      "values($1,$2,$3,$4) on conflict do nothing returning id",
      [accepted.proposalId,accepted.ownerUserId,accepted.ownerSessionId,
       accepted.evidenceDigest]);
    if(r.rowCount!==1)throw Error("ORIGINAL_OWNER_PIN_WITNESS_OR_DUPLICATE_MISSING");
    return {stored:true,status:"ORIGINAL_OWNER_PIN_ADOPTED_LIVE_CHALLENGE_REQUIRED"};
  });
}

export async function ownerAdoptedPins277() {
  if(!(await originalAdmission277()).adopted) return {};
  const r=await originalPool270().query(
    "select distinct on (p.source_id) p.source_id,p.key_id,p.commit_sha,p.public_key_pem,"+
    "p.key_fingerprint_sha256,p.evidence_sha256 "+
    "from icamp_private.owner_peer_pin277 o "+
    "join icamp_private.peer_signer_proposal276 p on p.id=o.proposal_id "+
    "join icamp_private.peer_signer_review276 v on v.proposal_id=p.id "+
    "order by p.source_id,o.adopted_at desc,o.id desc");
  const pins={};
  for(const row of r.rows){
    const normalized=validateRegistryRow276(row);
    if(normalized)pins[normalized.sourceId]={
      keyId:normalized.keyId,commitSha:normalized.commitSha,
      publicKeyPem:normalized.publicKeyPem};
  }
  return pins;
}

export async function issueFieldChallenge277(body,signature) {
  if(!(await originalAdmission277()).adopted)
    throw Error("ORIGINAL_HOST_OR_0251_HOLD");
  const pins=await ownerAdoptedPins277();
  const signed=verifySigned275({body,signature,pins});
  const challengeId=randomBytes(24).toString("base64url");
  const r=await originalPool270().query(
    "insert into icamp_private.peer_challenge277 "+
    "(source_id,key_id,commit_sha,challenge_id,request_nonce,request_sha256) "+
    "values($1,$2,$3,$4,$5,$6) on conflict do nothing "+
    "returning challenge_id,expires_at",
    [signed.source,signed.keyId,signed.commitSha,challengeId,
     signed.nonce,signed.digest]);
  if(r.rowCount!==1)throw Error("DUPLICATE_ORIGINAL_SIGNED_CHALLENGE_REQUEST");
  return {challengeId:r.rows[0].challenge_id,
    expiresAt:new Date(r.rows[0].expires_at).toISOString(),
    source:signed.source,status:"FRESH_SERVER_CHALLENGE_SIGNED_RESPONSE_REQUIRED"};
}

export async function recordFieldResponse277(body,signature) {
  if(!(await originalAdmission277()).adopted)
    throw Error("ORIGINAL_HOST_OR_0251_HOLD");
  const pins=await ownerAdoptedPins277();
  // Full cryptographic identity and freshness verified before lookup.
  const check=verifySigned275({body,signature,pins});
  const r=await originalPool270().query(
    "select id,source_id,key_id,commit_sha,challenge_id,request_nonce,"+
    "issued_at,expires_at from icamp_private.peer_challenge277 "+
    "where challenge_id=$1",[check.challengeId]);
  if(r.rowCount!==1)throw Error("SERVER_CHALLENGE_NOT_ISSUED");
  const candidate=r.rows[0];
  const receipt=verifyFieldResponse277({
    body,signature,pins,
    issued:{challengeId:candidate.challenge_id,source:candidate.source_id,
      keyId:candidate.key_id,commitSha:candidate.commit_sha,
      requestNonce:candidate.request_nonce,
      issuedAt:Date.parse(candidate.issued_at),expiresAt:Date.parse(candidate.expires_at)},
  });
  const insert=await originalPool270().query(
    "insert into icamp_private.peer_challenge_response277 "+
    "(challenge_id,source_id,nonce,signed_body,signature_b64url,body_sha256,observed_at) "+
    "values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning id",
    [candidate.id,receipt.source,receipt.nonce,receipt.body,
      receipt.signature,receipt.digest,receipt.observedAt]);
  if(insert.rowCount!==1)throw Error("ORIGINAL_FIELD_RESPONSE_REPLAY_OR_EXPIRED");
  return {accepted:true,status:"SERVER_ISSUED_FIELD_SIGNATURE_STORED_EXTERNAL_REVIEW_PENDING"};
}

export async function fieldReadback277() {
  const admission=await originalAdmission277();
  const empty=classifyFieldReadback277([],{});
  if(!admission.adopted) return {...empty,status:admission.status,admission,adopted:[]};
  try {
    const [pins,rows,adopted]=await Promise.all([
      ownerAdoptedPins277(),
      originalPool270().query(
        "select distinct on (c.source_id) c.source_id,c.key_id,c.commit_sha,"+
        "c.challenge_id,c.request_nonce,c.issued_at,c.expires_at,"+
        "r.accepted_at,r.signed_body,r.signature_b64url,r.body_sha256 "+
        "from icamp_private.peer_challenge277 c "+
        "join icamp_private.peer_challenge_response277 r on r.challenge_id=c.id "+
        "where r.accepted_at>=statement_timestamp()-interval '5 minutes' "+
        "and r.accepted_at<=statement_timestamp()+interval '30 seconds' "+
        "order by c.source_id,r.accepted_at desc"),
      originalPool270().query(
        "select p.source_id,p.key_id,p.commit_sha,p.key_fingerprint_sha256 "+
        "from icamp_private.owner_peer_pin277 o "+
        "join icamp_private.peer_signer_proposal276 p on p.id=o.proposal_id "+
        "order by o.adopted_at desc"),
    ]);
    return {...classifyFieldReadback277(rows.rows,pins),
      admission,adopted:adopted.rows.map(p=>({
        sourceId:p.source_id,keyId:p.key_id,commitSha:p.commit_sha,
        fingerprint:p.key_fingerprint_sha256}))};
  } catch {return {...empty,status:"HOLD_ORIGINAL_FIELD_READBACK",admission,adopted:[]};}
}

export async function recordExternalRestore277({
  reviewerId,closureReviewId,evidenceDigest,sourceHostDigest,isolatedHostDigest,
}) {
  if(![evidenceDigest,sourceHostDigest,isolatedHostDigest].every(v=>SHA276.test(v)) ||
      !UUID276.test(closureReviewId) ||sourceHostDigest===isolatedHostDigest)
    throw Error("INVALID_ORIGINAL_EXTERNAL_RESTORE_EVIDENCE");
  await requireOperator277(reviewerId);
  return transaction277(reviewerId,async client=>{
    const r=await client.query(
      "insert into icamp_private.external_restore_review277 "+
      "(closure_review_id,reviewer_user_id,external_evidence_sha256,"+
      "source_host_sha256,isolated_host_sha256) "+
      "values($1,$2,$3,$4,$5) on conflict do nothing returning id",
      [closureReviewId,reviewerId,evidenceDigest,sourceHostDigest,isolatedHostDigest]);
    if(r.rowCount!==1)throw Error("INDEPENDENT_ORIGINAL_EXTERNAL_RESTORE_REJECTED");
    return {stored:true,status:"ORIGINAL_EXTERNAL_RESTORE_WITNESS_RECORDED_FIELD_REVIEW_REQUIRED",
      productionRestored:false};
  });
}

export async function externalRestoreReadback277() {
  const admission=await originalAdmission277();
  if(!admission.adopted)return {admission,reviewed:0,status:admission.status,
    actualRestoreExecuted:false,records:[]};
  try {
    const r=await originalPool270().query(
      "select c.id as closure_id,p.provider_id,p.recorded_at,c.reviewed_at,"+
      "e.id is not null as external_verified "+
      "from icamp_private.restore_closure_review276 c "+
      "join icamp_private.restore_provider_attestation273 p "+
      "on p.id=c.provider_attestation_id "+
      "left join icamp_private.external_restore_review277 e on e.closure_review_id=c.id "+
      "order by c.reviewed_at desc limit 40");
    const matched=r.rows.filter(x=>x.external_verified===true);
    const classified=classifyExternalRestore277(
      r.rows.some(x=>Boolean(x.recorded_at)),
      r.rows.some(x=>Boolean(x.reviewed_at)),
      matched.length>0);
    return {...classified,admission,reviewed:matched.length,
      records:r.rows.map(x=>({closureId:x.closure_id,providerId:x.provider_id,
        reviewed:x.external_verified}))};
  } catch {return {admission,reviewed:0,status:"HOLD_ORIGINAL_EXTERNAL_RESTORE_READBACK",
    actualRestoreExecuted:false,records:[]};}
}

export async function acceptanceSummary277(session) {
  const [admission,owner,peer,restore]=await Promise.all([
    originalAdmission277(),actualOwnerReadback276(session),
    fieldReadback277(),externalRestoreReadback277()]);
  const closure=closure277({host:admission.host,owner,peer,restore});
  return {admission,owner,peer,restore,closure};
}
