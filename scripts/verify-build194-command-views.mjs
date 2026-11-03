import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL required for Build194 lifecycle verification.");
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
const id=()=>randomUUID();
async function one(sql,args=[]){const r=await client.query(sql,args);assert.equal(r.rowCount,1,"Expected one row: "+sql.slice(0,72));return r.rows[0];}
async function denied(sql,args,pattern){
  await client.query("savepoint build194_deny");
  let failed=false;
  try{await client.query(sql,args);}catch(e){failed=true;assert.match(String(e.message),pattern);}
  finally{await client.query("rollback to savepoint build194_deny");await client.query("release savepoint build194_deny");}
  assert.equal(failed,true,"Build194 operation must be denied");
}
async function actor(user){await client.query("reset role");await client.query("set local role icamp_app");await client.query("select set_config('icamp.user_id',$1,true)",[user]);}
const insertSql="insert into icamp_private.management_command_views "+
  "(id,organization_id,campground_id,user_id,label,perspective,category,search_term,density,favorite_hrefs,kpi_order,is_default) "+
  "values($1,$2,$3,$4,$5,'management','Bookings','','comfortable',$6,$7,$8) returning id,row_version";
const kpis=["sites","arrivals","work_orders","financial"];
const favorite=["/workspaces/management/campgrounds/reservations"];
try{
  await client.query("begin");
  const suffix=id().slice(0,8);
  const orgA=await one("insert into public.organizations(name,slug) values($1,$2) returning id",["Build194 Tenant A","build194-a-"+suffix]);
  const orgB=await one("insert into public.organizations(name,slug) values($1,$2) returning id",["Build194 Tenant B","build194-b-"+suffix]);
  const campA=await one("insert into public.campgrounds(organization_id,name,slug) values($1,$2,$3) returning id",[orgA.id,"Build194 Camp A","build194-camp-a-"+suffix]);
  const campB=await one("insert into public.campgrounds(organization_id,name,slug) values($1,$2,$3) returning id",[orgB.id,"Build194 Camp B","build194-camp-b-"+suffix]);
  const staff=[];
  for(const label of ["manager","colleague","maintenance","outsider"]){
    staff.push(await one("insert into icamp_private.user_accounts(email_normalized,account_type) values($1,'staff') returning id",["build194-"+label+"-"+suffix+"@test.invalid"]));
  }
  for(const [user,org,camp,role] of [
    [staff[0].id,orgA.id,campA.id,"campground_manager"],
    [staff[1].id,orgA.id,campA.id,"campground_manager"],
    [staff[2].id,orgA.id,campA.id,"maintenance"],
    [staff[3].id,orgB.id,campB.id,"campground_manager"]
  ]){
    const a=await one("insert into icamp_private.campground_assignments(user_id,organization_id,campground_id) values($1,$2,$3) returning id",[user,org,camp]);
    await client.query("insert into icamp_private.campground_assignment_roles(assignment_id,role_id) select $1,id from icamp_private.roles where role_code=$2 and role_kind='template'",[a.id,role]);
  }
  const [manager,colleague,maintenance,outsider]=staff.map(s=>s.id);
  const first=id();
  await actor(manager);
  const initial=await one(insertSql,[first,orgA.id,campA.id,manager,"Morning review",favorite,kpis,true]);
  assert.equal(Number(initial.row_version),1);
  let rows=await client.query("select id from icamp_private.management_command_views where campground_id=$1",[campA.id]);
  assert.equal(rows.rowCount,1);
  await actor(colleague);
  rows=await client.query("select id from icamp_private.management_command_views where campground_id=$1",[campA.id]);
  assert.equal(rows.rowCount,0,"A second authorized staff user cannot see another staff member's preferences");
  await denied(insertSql,[id(),orgA.id,campA.id,manager,"Spoofed staff",favorite,kpis,false],/actor|Unauthorized|policy|row-level security/i);
  await actor(maintenance);
  rows=await client.query("select id from icamp_private.management_command_views where campground_id=$1",[campA.id]);
  assert.equal(rows.rowCount,0,"Staff without reports.read must not view saved Command layout");
  await denied(insertSql,[id(),orgA.id,campA.id,maintenance,"Unauthorized staff",favorite,kpis,false],/Unauthorized|policy|row-level security/i);
  await actor(outsider);
  rows=await client.query("select id from icamp_private.management_command_views where campground_id=$1",[campA.id]);
  assert.equal(rows.rowCount,0,"Cross-campground reads must be invisible");
  await denied(insertSql,[id(),orgA.id,campA.id,outsider,"Cross property",favorite,kpis,false],/scope|Unauthorized|policy|row-level security/i);
  await actor(manager);
  await denied(insertSql,[id(),orgA.id,campA.id,manager,"Forbidden link",["https://evil.example/"],kpis,false],/pinned|Invalid|keys/i);
  await denied(insertSql,[id(),orgA.id,campA.id,manager,"Duplicate cards",favorite,["sites","sites","work_orders","financial"],false],/Duplicate|check constraint/i);
  await denied(insertSql,[id(),orgA.id,campA.id,manager,"Second default",favorite,kpis,true],/duplicate key|unique constraint/i);
  const changed=await one("update icamp_private.management_command_views set label='Morning operations' where id=$1 and row_version=1 returning row_version",[first]);
  assert.equal(Number(changed.row_version),2,"Database must increment version on updates");
  const stale=await client.query("update icamp_private.management_command_views set label='Stale update' where id=$1 and row_version=1",[first]);
  assert.equal(stale.rowCount,0,"Optimistic stale update must fail closed");
  await denied("update icamp_private.management_command_views set campground_id=$2 where id=$1",[first,campB.id],/immutable|policy|scope/i);
  for(let i=2;i<=8;i++) await one(insertSql,[id(),orgA.id,campA.id,manager,"Saved view "+i,favorite,kpis,false]);
  await denied(insertSql,[id(),orgA.id,campA.id,manager,"Ninth view",favorite,kpis,false],/Maximum eight|layout|check constraint/i);
  await one("delete from icamp_private.management_command_views where id=$1 returning id",[first]);
  const cnt=await one("select count(*)::int as n from icamp_private.management_command_views where user_id=$1 and campground_id=$2",[manager,campA.id]);
  assert.equal(cnt.n,7);
  console.log("Build194 PostgreSQL 17: user, campground and permission isolation, anti-spoofing, duplicate/default/limit guards, optimistic versions and deletion PASS");
}finally{
  await client.query("rollback").catch(()=>undefined);
  await client.end();
}
