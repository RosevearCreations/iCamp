export interface OwnerPermissions { read:boolean; record:boolean; review:boolean }
export interface OwnerTaskEvent { id:string; task_id:string; event_kind:string; reason:string; actor_user_id:string; recorded_at:string }
export interface OwnerTask { id:string; assignment_id:string; task_kind:string; due_on:string; description:string; source_reference:string; created_by_user_id:string; created_at:string; events:OwnerTaskEvent[] }
export interface OwnerQueueRow {
 id:string; reference:string; assignmentKind:string; siteCode:string; siteName:string; occupancyState:string;
 endsOn:string; rowVersion:number; renewalPreference:string|null; renewalVersion:number|null; proposedTermEndsOn:string|null;
 winterDecision:string|null; springDecision:string|null; unresolvedWorkOrders:number;
 blockers:string[];readyForOwnerReview:boolean;tasks:OwnerTask[];
}
export interface OwnerQueue {
 campground:{id:string;name:string;timezone:string};permissions:OwnerPermissions;
 asOf:string; rows:OwnerQueueRow[]; tasks:OwnerTask[];
}
export function closeOwnerQueuePoolForTests():Promise<void>;
export function getOwnerQueuePermissions(actor:string,camp:string):Promise<OwnerPermissions>;
export function getOwnerQueue(actor:string,camp:string):Promise<OwnerQueue>;
export function recordRenewalIntent(args:{actorUserId:string;campgroundId:string;input:{id:string;assignmentId:string;preference:string;proposedTermEndsOn?:string;note:string;sourceReference:string}}):Promise<{id:string}>;
export function createOwnerTask(args:{actorUserId:string;campgroundId:string;input:{id:string;assignmentId:string;taskKind:string;dueOn:string;description:string;sourceReference:string}}):Promise<{id:string}>;
export function recordOwnerTaskEvent(args:{actorUserId:string;campgroundId:string;input:{id:string;taskId:string;eventKind:string;reason:string}}):Promise<{id:string}>;
