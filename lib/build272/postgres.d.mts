export function originalAdmission272():Promise<{status:string;adopted:boolean;hostPinned:boolean}>;
export function inspectFieldAcceptance272():Promise<{
 status:string;admission:{status:string;adopted:boolean;hostPinned:boolean};
 owner:{status:string;witnessedSessions:number};
 booking:{status:string;reviewed:number};
 comms:{status:string;reviewed:number};
 restore:{status:string;reviewed:number};liveExternalRestorationVerified:boolean
}>;
export function recordOwnerLogin272(input:{reviewerId:string;sessionId:string;evidenceDigest:string}):Promise<{stored:boolean;accountChanged:boolean;credentialsChanged:boolean}>;
export function recordProviderBooking272(input:{reviewerId:string;campgroundId:string;recoveryId:string;traceId:string;processorWitnessId:string;siteWitnessId:string;deliveryWitnessId:string;guestWitnessId:string;evidenceDigest:string}):Promise<{stored:boolean;charged:boolean;booked:boolean;guestMessaged:boolean}>;
export function recordCommsReview272(input:{reviewerId:string;outboxId:string;attemptId:string;deliveredReceiptId:string;sourcePairId:string;masterKind:string;externalAckDigest:string}):Promise<{stored:boolean;recipientAcknowledged:boolean;caseClosed:boolean}>;
export function recordRestoreDryRun272(input:{reviewerId:string;backupDigest:string;evidenceDigest:string}):Promise<{stored:boolean;productionDataRestored:boolean;externalHostRestored:boolean}>;
export function tenantProviderStatus272(input:{userId:string;campgroundId:string}):Promise<{status:string;reviewed:number}>;
