export function originalAdmission279():Promise<{
 adopted:boolean;host:{configured:boolean;pinned:boolean;status:string};status:string;
}>;
export function recordProviderCorrelation279(input:{
 reviewerId:string;fieldReviewId:string;providerReceiptId:string;evidenceDigest:string;
}):Promise<{stored:boolean;status:string}>;
export function recordOwnerRecoveryAudit279(input:{
 auditorId:string;mfaReadbackId:string;evidenceDigest:string;
}):Promise<{stored:boolean;status:string}>;
export function recordIsolatedRestoreFinalization279(input:{
 reviewerId:string;serviceReadbackId:string;backupDigest:string;tenantDigest:string;
 reservationDigest:string;paymentDigest:string;healthDigest:string;comparisonDigest:string;
}):Promise<{stored:boolean;status:string;productionRestored:boolean}>;
export function sourceCorrelations279():Promise<{
 admission:{adopted:boolean;host:{configured:boolean;pinned:boolean;status:string};status:string};
 verifiedCount:number;status:string;
 sources:{source:string;status:string;fieldReviewId:string|null;
 signedReceiptId:string|null;correlated:boolean}[];
 fieldCandidates:{id:string;source:string}[];
 providerCandidates:{id:string;source:string;keyId:string;commitSha:string}[];
}>;
export function recoveryAccessAudit279(session:{
 sessionId:string;assuranceLevel:string;user:{id:string;username?:string|null};
}):Promise<{status:string;owner:{status:string};
 mfaCandidates:{id:string;audited:boolean;originalRosevear:boolean}[]}>;
export function isolatedFinalization279():Promise<{
 status:string;finalizedCount:number;productionRestored:boolean;providerCertified:boolean;
 serviceCandidates:{id:string;finalized:boolean}[];
}>;
export function acceptanceSummary279(session:{
 sessionId:string;assuranceLevel:string;user:{id:string;username?:string|null};
}):Promise<{
 admission:{adopted:boolean;host:{configured:boolean;pinned:boolean;status:string};status:string};
 peers:{verifiedCount:number;status:string;
 sources:{source:string;status:string;fieldReviewId:string|null;
 signedReceiptId:string|null;correlated:boolean}[];
 fieldCandidates:{id:string;source:string}[];
 providerCandidates:{id:string;source:string;keyId:string;commitSha:string}[]};
 owner:{status:string;owner:{status:string};
 mfaCandidates:{id:string;audited:boolean;originalRosevear:boolean}[]};
 restore:{status:string;finalizedCount:number;
 serviceCandidates:{id:string;finalized:boolean}[]};
 closure:{status:string;productionRestored:boolean;providerCertified:boolean};
}>;
