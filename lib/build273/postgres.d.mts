export function originalAdmission273():Promise<{status:string;adopted:boolean;hostPinned:boolean}>;
export function sourceSummary273():Promise<{status:string;hostPinned:boolean;adopted:boolean;enrolled:number;consumerAck:number;incidentClosed:number;providerRestore:number;commsSignerConfigured:boolean;bookingSignerConfigured:boolean;restoreSignerConfigured:boolean}>;
export function recordSourceEnrollment273(input:{reviewerId:string;sourcePairId:string;evidenceDigest:string}):Promise<{recorded:boolean;sourceCredentialsChanged:boolean}>;
export function acceptOriginalConsumer273(body:string,signature:string|null):Promise<{accepted:boolean;status:string}>;
export function recordSignedIncidentClosure273(input:{reviewerId:string;outboxId:string;consumerAckId:string;evidenceDigest:string}):Promise<{recorded:boolean;tenantCaseStateChanged:boolean}>;
export function acceptRestoreProvider273(body:string,signature:string|null):Promise<{accepted:boolean;status:string}>;
