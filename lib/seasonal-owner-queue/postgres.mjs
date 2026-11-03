import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for seasonal owner queue.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  }
  return pool;
}
export async function closeOwnerQueuePoolForTests() { if (pool) { await pool.end(); pool=undefined; } }
const uuid = x => { x=String(x??""); if(!/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(x)) throw new Error("Invalid UUID."); return x; };
const note = (x,min,max) => { x=String(x??"").trim(); if(x.length<min||x.length>max)throw new Error("Evidence note or reference has an invalid length."); return x; };
const day = x => x==null?null:String(x instanceof Date?x.toISOString():x).slice(0,10);
const date = x => {const s=day(x);if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s) throw new Error("Invalid date.");return s;};
export async function getOwnerQueuePermissions(actor,camp) {
  const [read,record,review]=await Promise.all(["seasonal.owner.read","seasonal.owner.record","seasonal.owner.review"].map(k=>hasCampgroundPermission(actor,camp,k)));
  return {read,record,review};
}
async function withActor(actor,run) {
  const client=await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)",[actor]);
    const result=await run(client);
    await client.query("commit");
    return result;
  } catch(e) { await client.query("rollback").catch(()=>undefined); throw e; }
  finally { client.release(); }
}
async function permitted(actor,camp,key) {
  if(!(await hasCampgroundPermission(actor,camp,key)))throw new Error("Not authorized for this campground seasonal queue.");
}
export async function getOwnerQueue(actor,camp) {
  const permissions=await getOwnerQueuePermissions(actor,camp);
  if(!Object.values(permissions).some(Boolean))throw new Error("Not authorized for seasonal owner queue.");
  return withActor(actor,async client=>{
    const property=await client.query("select id,name,timezone from public.campgrounds where id=$1",[camp]);
    if(!property.rows.length)throw new Error("Campground unavailable.");
    const assignments=await client.query(
      "select a.id,a.reference,a.assignment_kind,a.occupancy_state,a.winterization_required,a.ends_on,a.row_version,"+
      " ac.code site_code,ac.display_name site_name,"+
      " (select count(*)::int from public.maintenance_work_orders w where w.campground_id=a.campground_id and w.accommodation_id=a.accommodation_id and w.status not in ('completed','cancelled')) unresolved_work_orders,"+
      " (select r.decision from public.winterization_reviews r join public.winterization_runs w on w.id=r.run_id and w.campground_id=r.campground_id where w.assignment_id=a.id and w.winter_year=extract(year from statement_timestamp())::int order by r.reviewed_at desc,r.id desc limit 1) winter_decision,"+
      " (select e.id from public.seasonal_assignment_events e where e.assignment_id=a.id and e.event_kind='winter_closed' order by e.created_at desc,e.id desc limit 1) last_close_id,"+
      " (select d.decision from public.spring_reopening_decisions d join public.spring_reopening_inspections i on i.id=d.inspection_id and i.campground_id=d.campground_id where i.assignment_id=a.id and i.winter_close_event_id=(select e.id from public.seasonal_assignment_events e where e.assignment_id=a.id and e.event_kind='winter_closed' order by e.created_at desc,e.id desc limit 1) order by d.decided_at desc,d.id desc limit 1) spring_decision,"+
      " (select r.preference from icamp_private.seasonal_renewal_intents r where r.assignment_id=a.id order by term_version desc limit 1) renewal_preference,"+
      " (select r.term_version from icamp_private.seasonal_renewal_intents r where r.assignment_id=a.id order by term_version desc limit 1) renewal_version,"+
      " (select r.proposed_term_ends_on from icamp_private.seasonal_renewal_intents r where r.assignment_id=a.id order by term_version desc limit 1) proposed_term_ends_on,"+
      " (select r.base_assignment_version from icamp_private.seasonal_renewal_intents r where r.assignment_id=a.id order by term_version desc limit 1) base_assignment_version"+
      " from public.seasonal_assignments a join public.accommodations ac on ac.id=a.accommodation_id and ac.campground_id=a.campground_id"+
      " where a.campground_id=$1 and a.assignment_state='active' order by a.ends_on,a.reference limit 250",[camp]);
    const tasks=await client.query("select id,assignment_id,task_kind,due_on,description,source_reference,created_by_user_id,created_at from icamp_private.seasonal_owner_tasks where campground_id=$1 order by due_on asc,created_at desc limit 250",[camp]);
    const events=await client.query("select id,task_id,event_kind,reason,actor_user_id,recorded_at from icamp_private.seasonal_owner_task_events where campground_id=$1 order by recorded_at desc limit 500",[camp]);
    const taskRows=tasks.rows.map(t=>({...t,due_on:day(t.due_on),events:events.rows.filter(e=>e.task_id===t.id)}));
    const today=new Date().toISOString().slice(0,10);
    const rows=assignments.rows.map(a=>{
      const blockers=[];
      if(a.winterization_required && a.winter_decision!=="approved")blockers.push("No approved current-year winterization sign-off");
      if(a.occupancy_state==="winter_closed" && (!a.last_close_id||a.spring_decision!=="approved"))blockers.push("Latest winter closure lacks approved spring inspection");
      if(Number(a.unresolved_work_orders)>0)blockers.push(String(a.unresolved_work_orders)+" unresolved site work order(s)");
      if(a.base_assignment_version!=null && Number(a.base_assignment_version)!==Number(a.row_version))blockers.push("Recorded interest is stale against assignment terms");
      if(a.renewal_preference!=="interested")blockers.push("No current renewal interest recorded");
      if(day(a.ends_on)<today)blockers.push("Assignment has expired");
      return {
        id:a.id,reference:a.reference,assignmentKind:a.assignment_kind,siteCode:a.site_code,siteName:a.site_name,
        occupancyState:a.occupancy_state,endsOn:day(a.ends_on),rowVersion:Number(a.row_version),
        renewalPreference:a.renewal_preference??null,renewalVersion:a.renewal_version??null,proposedTermEndsOn:day(a.proposed_term_ends_on),
        winterDecision:a.winter_decision??null,springDecision:a.spring_decision??null,unresolvedWorkOrders:Number(a.unresolved_work_orders),
        blockers,readyForOwnerReview:blockers.length===0,tasks:taskRows.filter(t=>t.assignment_id===a.id)
      };
    });
    return {campground:property.rows[0],permissions,asOf:new Date().toISOString(),rows,tasks:taskRows};
  });
}
export async function recordRenewalIntent({actorUserId,campgroundId,input}) {
  await permitted(actorUserId,campgroundId,"seasonal.owner.record");
  const id=uuid(input.id),assignmentId=uuid(input.assignmentId),preference=String(input.preference);
  if(!["interested","declined","needs_discussion"].includes(preference))throw new Error("Invalid interest.");
  const proposed=preference==="interested"?date(input.proposedTermEndsOn):null;
  const reason=note(input.note,12,1200),reference=note(input.sourceReference,8,180);
  return withActor(actorUserId,async client=>{
    const a=await client.query("select organization_id,row_version,ends_on from public.seasonal_assignments where id=$1 and campground_id=$2 for update",[assignmentId,campgroundId]);
    if(!a.rows.length)throw new Error("Assignment unavailable.");
    const v=await client.query("select coalesce(max(term_version),0)+1 version from icamp_private.seasonal_renewal_intents where assignment_id=$1",[assignmentId]);
    await client.query("insert into icamp_private.seasonal_renewal_intents(id,organization_id,campground_id,assignment_id,term_version,base_assignment_version,current_term_ends_on,proposed_term_ends_on,preference,source_reference,note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [id,a.rows[0].organization_id,campgroundId,assignmentId,v.rows[0].version,a.rows[0].row_version,day(a.rows[0].ends_on),proposed,preference,reference,reason,actorUserId]);
    return {id};
  });
}
export async function createOwnerTask({actorUserId,campgroundId,input}) {
  await permitted(actorUserId,campgroundId,"seasonal.owner.record");
  const kind=String(input.taskKind);
  if(!["renewal","winterization","spring_reopening","deficiency","owner_followup"].includes(kind))throw new Error("Invalid task kind.");
  const id=uuid(input.id),assignmentId=uuid(input.assignmentId),due=date(input.dueOn);
  const description=note(input.description,12,1200),reference=note(input.sourceReference,8,180);
  return withActor(actorUserId,async client=>{
    const a=await client.query("select organization_id from public.seasonal_assignments where id=$1 and campground_id=$2",[assignmentId,campgroundId]);
    if(!a.rows.length)throw new Error("Assignment unavailable.");
    await client.query("insert into icamp_private.seasonal_owner_tasks(id,organization_id,campground_id,assignment_id,task_kind,due_on,description,source_reference,created_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [id,a.rows[0].organization_id,campgroundId,assignmentId,kind,due,description,reference,actorUserId]);
    return {id};
  });
}
export async function recordOwnerTaskEvent({actorUserId,campgroundId,input}) {
  const kind=String(input.eventKind);
  if(!["followup_note","owner_acknowledged","reopened"].includes(kind))throw new Error("Invalid follow-up event.");
  await permitted(actorUserId,campgroundId,kind==="owner_acknowledged"?"seasonal.owner.review":"seasonal.owner.record");
  const id=uuid(input.id),taskId=uuid(input.taskId),reason=note(input.reason,12,1200);
  return withActor(actorUserId,async client=>{
    const t=await client.query("select organization_id from icamp_private.seasonal_owner_tasks where id=$1 and campground_id=$2",[taskId,campgroundId]);
    if(!t.rows.length)throw new Error("Task unavailable.");
    await client.query("insert into icamp_private.seasonal_owner_task_events(id,organization_id,campground_id,task_id,event_kind,reason,actor_user_id) values($1,$2,$3,$4,$5,$6,$7)",
    [id,t.rows[0].organization_id,campgroundId,taskId,kind,reason,actorUserId]);
    return {id};
  });
}
