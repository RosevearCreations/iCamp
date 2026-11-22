export function originalAdmission271():Promise<{status:string;adopted:boolean;base:unknown}>;
export function acceptOriginalProof271(body:string,signature:string|null):Promise<{
 accepted:boolean;status:string}>;
export function originalSources271():Promise<{status:string;campground:string;
 proofs:Array<{kind:string;status:string;paired:boolean;sourceConfigured:boolean;sampleFresh:boolean}>}>;
export function originalOwnerCeremony271():Promise<{status:string;owner:{
 status:string;accountActive:boolean;credentialPresent:boolean;recoveryEmailVerified:boolean;
 platformGrantActive:boolean;mfaVerified:boolean;independentOwnerBinding:boolean};
 stages:Array<{kind:string;witnessed:boolean}>}>;
export function recordOwnerCeremony271(input:{actorUserId:string;stage:string;
 evidenceDigest:string}):Promise<{stored:boolean;privilegesModified:boolean}>;
export function certifyBooking271(input:{reviewerId:string;campgroundId:string;
 recoveryId:string;evidenceDigest:string}):Promise<{
 certified:boolean;booked:boolean;refunded:boolean}>;
export function bookingCertifications271(input:{userId:string;campgroundId:string}):Promise<{
 status:string;cases:Array<{recoveryId:string;certifiedAt:string|null}>}>;
export function recordRestoreReplay271(input:{actorUserId:string;backupDigest:string;
 snapshot:string;kind:string;fingerprint:string}):Promise<{
 stored:boolean;actualHostRestoreVerified:boolean}>;
export function originalReplayStatus271():Promise<{
 status:string;receipts:number|null;actualHostRestoreVerified?:boolean}>;
