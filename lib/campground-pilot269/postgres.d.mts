export function originalPilotReady269():Promise<boolean>;
export function acceptTraffic269(body:string,signature:string|null):Promise<{accepted:boolean}>;
export function acceptSlaDelivery269(body:string,signature:string|null):
 Promise<{accepted:boolean;duplicate:boolean}>;
export function listTenantTraffic269():Promise<{
 status:string;tenants:Array<{
  campgroundId:string;name:string;campgroundState:string;enrollmentState:string;
  freshness:string;lastReceivedAt:string|null;samples:number;guestSearch:string;
  guestCheckout:string;errors:string;probes:number;
 }>;}>;
export function listPilotCustody269():Promise<{
 status:string;signedDeliveryReceipts:number|null;pilotBookingWitnesses:number|null;
 restoreStatus:string;
}>;
export function recordBookingWitness269(input:{userId:string;campgroundId:string;recoveryId:string;
 stage:string;evidenceDigestSha256:string;}):Promise<{stored:boolean;independentlyAccepted:boolean}>;
export function recordRestoreWitness269(input:{actorUserId:string;kind:string;
 backupDigestSha256:string;evidenceDigestSha256:string;}):
 Promise<{stored:boolean;originalRestoreIndependentlyProven:boolean}>;
