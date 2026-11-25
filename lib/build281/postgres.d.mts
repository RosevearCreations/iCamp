export function originalAdmission281():Promise<{
 adopted:boolean;host:{configured:boolean;pinned:boolean;status:string};status:string;
}>;
export function recordCustodyAudit281(input:{reviewerId:string;providerClosureId:string;
 evidenceDigest:string}):Promise<{status:string}>;
export function recordOwnerContinuity281(input:{reviewerId:string;originalWitnessId:string;
 sessionId:string;evidenceDigest:string}):Promise<{status:string}>;
export function recordExternalFinalAck281(input:{reviewerId:string;certificateId:string;
 custodyReviewId:string;ownerContinuityId:string;body:string;signature:string}):Promise<{status:string}>;
export function recordMonitorSample281(input:{reviewerId:string;ackId:string;
 evidenceDigest:string}):Promise<{status:string}>;
export function acceptanceSummary281():Promise<{
 admission:{adopted:boolean;host:{configured:boolean;pinned:boolean;status:string};status:string};
 status:string;custodyCandidates:{id:string;providerId:string}[];
 custodyReviews:{id:string;closureId:string}[];
 mfaWitnessCandidates:{id:string;sessionId:string}[];
 mfaContinuity:{id:string;sessionId:string}[];
 ackCandidates:{id:string;closureId:string;ownerWitnessId:string}[];
 signedAck:{id:string;providerId:string;certificateId:string;recordedAt:string|Date;
 originalAckVerified:boolean}|null;
 sourceCount:number;samples:{id:string;ackId:string;observedAt:string|Date}[];
 monitoring:{status:string;signedProviderCurrent:boolean;ownerMfaCurrent:boolean;
 sourcesCurrent:boolean;certificateEvidencePresent:boolean;
 independentReviewLive:boolean;externalProviderFinalAcknowledgmentVerified:boolean;
 productionRestored:boolean};
}>;
