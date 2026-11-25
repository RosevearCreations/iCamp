export const EXTERNAL_FINAL_ACK_KIND281:string;
export function validateCustodyReview281(input:{providerClosureId:string;evidenceDigest:string}):{
 providerClosureId:string;evidenceDigest:string;};
export function validateMfaContinuity281(input:{originalWitnessId:string;sessionId:string;
 evidenceDigest:string}):{originalWitnessId:string;sessionId:string;evidenceDigest:string;};
export function validateFinalAck281(input:{certificateId:string;custodyReviewId:string;
 ownerContinuityId:string;body:string;signature:string}):{
 certificateId:string;custodyReviewId:string;ownerContinuityId:string;
 body:string;signature:string;};
export function validateMonitorSample281(input:{ackId:string;evidenceDigest:string}):{
 ackId:string;evidenceDigest:string;};
export function verifyExternalProviderAck281(input:{
 body:string;signature:string;
 providerKey:{providerId:string;keyId:string;publicKeyPem:string;
 fingerprint:string;evidenceDigest:string};
 original:{providerId:string;originalClosureId:string;certificateId:string;
 originalClosureDigest:string;sourceHostSha256:string;isolatedHostSha256:string};
 now?:number;
}):{kind:string;providerId:string;keyId:string;providerEventId:string;nonce:string;
 observedAt:string;originalClosureId:string;certificateId:string;
 originalClosureDigest:string;sourceHostSha256:string;isolatedHostSha256:string;digest:string};
export function classifyLiveMonitor281(input:{
 admission:{adopted:boolean;host:{pinned:boolean}};providerCustody:boolean;
 ownerContinuity:boolean;providerAck:boolean;sourceCount:number;
 certificatePresent:boolean;sampledAt:string|null;now?:number;
}):{status:string;signedProviderCurrent:boolean;ownerMfaCurrent:boolean;
 sourcesCurrent:boolean;certificateEvidencePresent:boolean;
 independentReviewLive:boolean;externalProviderFinalAcknowledgmentVerified:boolean;
 productionRestored:boolean;};
