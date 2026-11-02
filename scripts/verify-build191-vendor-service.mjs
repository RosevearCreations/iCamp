import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL required for Build191 lifecycle verification.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const ids = () => randomUUID();
const later = (days) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
async function one(sql, args = []) {
  const r = await client.query(sql, args);
  assert.equal(r.rowCount, 1);
  return r.rows[0];
}
async function denied(sql, args, pattern) {
  await client.query("savepoint build191_denial");
  let rejected = false;
  try {
    await client.query(sql, args);
  } catch (err) {
    rejected = true;
    assert.match(String(err.message), pattern);
  } finally {
    await client.query("rollback to savepoint build191_denial");
    await client.query("release savepoint build191_denial");
  }
  assert.ok(rejected, "Expected Build191 operation to be denied");
}
async function actor(user) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [user]);
}
try {
  await client.query("begin");
  const orgA = await one(
    "insert into public.organizations(name,slug) values('Build191 A','build191-a') returning id",
  );
  const orgB = await one(
    "insert into public.organizations(name,slug) values('Build191 B','build191-b') returning id",
  );
  const campA = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build191 Camp A','build191-a') returning id",
    [orgA.id],
  );
  const campB = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build191 Camp B','build191-b') returning id",
    [orgB.id],
  );
  const managerA = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build191-manager-a@test.invalid','staff') returning id",
  );
  const financeA = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build191-finance-a@test.invalid','staff') returning id",
  );
  const managerB = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build191-manager-b@test.invalid','staff') returning id",
  );
  for (const [user, org, camp, role] of [
    [managerA.id, orgA.id, campA.id, "campground_manager"],
    [financeA.id, orgA.id, campA.id, "finance"],
    [managerB.id, orgB.id, campB.id, "campground_manager"],
  ]) {
    const assignment = await one(
      "insert into icamp_private.campground_assignments(user_id,organization_id,campground_id) values($1,$2,$3) returning id",
      [user, org, camp],
    );
    await client.query(
      "insert into icamp_private.campground_assignment_roles(assignment_id,role_id) select $1,id from icamp_private.roles where role_code=$2 and role_kind='template'",
      [assignment.id, role],
    );
  }
  const mediaInternal = ids(),
    mediaConfidential = ids();
  for (const [mid, classification] of [
    [mediaInternal, "internal"],
    [mediaConfidential, "confidential"],
  ]) {
    await one(
      `insert into icamp_private.media_assets
   (id,organization_id,campground_id,classification,media_kind,storage_provider,bucket_key,object_key,original_filename,content_type,byte_size,validation_state,lifecycle_state)
   values($1,$2,$3,$4,'document','supabase','build191-test',$5,'synthetic-evidence.pdf','application/pdf',1024,'validated','active') returning id`,
      [
        mid,
        orgA.id,
        campA.id,
        classification,
        "vendor-evidence/" + mid + ".pdf",
      ],
    );
  }
  await actor(managerA.id);
  const vendorA = ids(),
    vendorOther = ids(),
    contract1 = ids(),
    contract2 = ids(),
    plan = ids(),
    requestId = ids(),
    invoice = ids();
  await one(
    `insert into icamp_private.vendor_profiles
  (id,organization_id,campground_id,display_name,service_category,private_note,created_by_user_id)
  values($1,$2,$3,'Build191 Septic Service','septic','Source checked by internal manager for synthetic review.',$4) returning id`,
    [vendorA, orgA.id, campA.id, managerA.id],
  );
  await one(
    `insert into icamp_private.vendor_profiles
  (id,organization_id,campground_id,display_name,service_category,private_note,created_by_user_id)
  values($1,$2,$3,'Build191 Waste Service','waste','Second supplier used for cross-vendor linkage tests.',$4) returning id`,
    [vendorOther, orgA.id, campA.id, managerA.id],
  );
  await denied(
    `insert into icamp_private.vendor_contracts
  (organization_id,campground_id,vendor_id,contract_reference,title,valid_from,expires_on,response_target_hours,completion_target_days,document_media_id,private_note,created_by_user_id)
  values($1,$2,$3,'build191-contract-internal','Unprotected contract PDF',$4,$5,12,4,$6,'Invalid internal document classification must fail.',$7)`,
    [
      orgA.id,
      campA.id,
      vendorA,
      later(-1),
      later(60),
      mediaInternal,
      managerA.id,
    ],
    /validated confidential PDF/i,
  );
  await one(
    `insert into icamp_private.vendor_contracts
  (id,organization_id,campground_id,vendor_id,contract_reference,title,valid_from,expires_on,response_target_hours,completion_target_days,document_media_id,private_note,created_by_user_id)
  values($1,$2,$3,$4,'build191-contract-v1','Synthetic septic maintenance agreement',$5,$6,24,7,$7,'Original source-backed vendor terms and response deadlines.',$8) returning id`,
    [
      contract1,
      orgA.id,
      campA.id,
      vendorA,
      later(-1),
      later(60),
      mediaConfidential,
      managerA.id,
    ],
  );
  await client.query("reset role");
  await denied(
    "update icamp_private.media_assets set classification='public' where id=$1",
    [mediaConfidential],
    /Linked vendor confidential source/i,
  );
  await actor(managerA.id);
  await one(
    `insert into icamp_private.vendor_contracts
  (id,organization_id,campground_id,vendor_id,supersedes_contract_id,contract_reference,title,valid_from,expires_on,response_target_hours,completion_target_days,private_note,created_by_user_id)
  values($1,$2,$3,$4,$5,'build191-contract-v2','Renewed septic maintenance agreement',$6,$7,12,4,'Renewal changed response to twelve hours with recorded review.',$8) returning id`,
    [
      contract2,
      orgA.id,
      campA.id,
      vendorA,
      contract1,
      later(-1),
      later(120),
      managerA.id,
    ],
  );
  await denied(
    `insert into icamp_private.vendor_recurring_plans
   (organization_id,campground_id,vendor_id,contract_id,service_label,cadence_days,next_due_on,private_note,created_by_user_id)
   values($1,$2,$3,$4,'Quarterly other-vendor visit',90,$5,'Contract mismatch should be rejected by database.',$6)`,
    [orgA.id, campA.id, vendorOther, contract2, later(30), managerA.id],
    /belongs to another vendor/i,
  );
  await one(
    `insert into icamp_private.vendor_recurring_plans
  (id,organization_id,campground_id,vendor_id,contract_id,service_label,cadence_days,next_due_on,private_note,created_by_user_id)
  values($1,$2,$3,$4,$5,'Quarterly septic inspection',90,$6,'Internal due-date reminder with no automated dispatch.',$7) returning id`,
    [plan, orgA.id, campA.id, vendorA, contract2, later(30), managerA.id],
  );
  await denied(
    `insert into icamp_private.vendor_service_requests
  (organization_id,campground_id,vendor_id,contract_id,title,request_description,response_target_hours,completion_target_days,response_due_at,completion_due_at,created_by_user_id)
  values($1,$2,$3,$4,'Expired superseded source contract','Only the current contract may set new service targets.',1,1,statement_timestamp(),statement_timestamp(),$5)`,
    [orgA.id, campA.id, vendorA, contract1, managerA.id],
    /current contract for this vendor/i,
  );
  const req = await one(
    `insert into icamp_private.vendor_service_requests
  (id,organization_id,campground_id,vendor_id,contract_id,recurring_plan_id,title,request_description,response_target_hours,completion_target_days,response_due_at,completion_due_at,created_by_user_id)
  values($1,$2,$3,$4,$5,$6,'Synthetic septic service intake','Staff manager logged internal work and owner-set SLA only.',1,1,statement_timestamp(),statement_timestamp(),$7)
  returning id,requested_at,response_due_at,completion_due_at,response_target_hours,completion_target_days`,
    [requestId, orgA.id, campA.id, vendorA, contract2, plan, managerA.id],
  );
  assert.equal(req.response_target_hours, 12);
  assert.equal(req.completion_target_days, 4);
  assert.equal(
    (new Date(req.response_due_at) - new Date(req.requested_at)) / 3_600_000,
    12,
  );
  assert.equal(
    (new Date(req.completion_due_at) - new Date(req.requested_at)) / 86_400_000,
    4,
  );
  await denied(
    `insert into icamp_private.vendor_service_events
  (organization_id,campground_id,request_id,kind,note,actor_user_id)
  values($1,$2,$3,'response','Missing actual source reference is not sufficient.',$4)`,
    [orgA.id, campA.id, requestId, managerA.id],
    /source_reference|check constraint/i,
  );
  await one(
    `insert into icamp_private.vendor_service_events
  (id,organization_id,campground_id,request_id,kind,source_reference,note,actor_user_id)
  values($1,$2,$3,$4,'invoice_intake','invoice-build191-synthetic','Invoice intake only, not payable approval or payment.',$5) returning id`,
    [invoice, orgA.id, campA.id, requestId, managerA.id],
  );
  await denied(
    `insert into icamp_private.vendor_service_events
  (organization_id,campground_id,request_id,kind,reviews_event_id,note,actor_user_id)
  values($1,$2,$3,'invoice_reviewed',$4,'Cannot review own invoice intake or claim independent action.',$5)`,
    [orgA.id, campA.id, requestId, invoice, managerA.id],
    /independent source intake/i,
  );
  await actor(financeA.id);
  await denied(
    `insert into icamp_private.vendor_profiles
  (organization_id,campground_id,display_name,service_category,private_note,created_by_user_id)
  values($1,$2,'Finance cannot register vendors','repairs','Finance is read-only for vendor profile registration.',$3)`,
    [orgA.id, campA.id, financeA.id],
    /row-level security|authorized campground manager/i,
  );
  const review = await one(
    `insert into icamp_private.vendor_service_events
  (organization_id,campground_id,request_id,kind,reviews_event_id,note,actor_user_id)
  values($1,$2,$3,'invoice_reviewed',$4,'Independent finance intake review; no payable created.',$5) returning id`,
    [orgA.id, campA.id, requestId, invoice, financeA.id],
  );
  assert.ok(review.id);
  await denied(
    `insert into icamp_private.vendor_service_events
  (organization_id,campground_id,request_id,kind,reviews_event_id,note,actor_user_id)
  values($1,$2,$3,'invoice_reviewed',$4,'Duplicate finance intake acknowledgement must fail.',$5)`,
    [orgA.id, campA.id, requestId, invoice, financeA.id],
    /duplicate key/i,
  );
  await denied(
    "update icamp_private.vendor_service_events set note='changed' where id=$1",
    [review.id],
    /permission denied|immutable/i,
  );
  await actor(managerB.id);
  for (const t of [
    "vendor_profiles",
    "vendor_contracts",
    "vendor_recurring_plans",
    "vendor_service_requests",
    "vendor_service_events",
  ]) {
    assert.equal(
      (
        await client.query(
          `select count(*)::integer as n from icamp_private.${t} where campground_id=$1`,
          [campA.id],
        )
      ).rows[0].n,
      0,
      "Cross-campground leakage via " + t,
    );
  }
  await denied(
    `insert into icamp_private.vendor_service_events
  (organization_id,campground_id,request_id,kind,note,actor_user_id)
  values($1,$2,$3,'followup','Foreign campground evidence must not be accepted.',$4)`,
    [orgA.id, campA.id, requestId, managerB.id],
    /row-level security|authorized vendor manager/i,
  );
  await client.query("rollback");
  process.stdout.write(
    "Build191 PostgreSQL: scoped vendor contracts, SLA derivation, confidential PDF, recurring/vendor mismatch, independent invoice review, append-only RLS and no external actions PASS (rolled back).\n",
  );
} catch (err) {
  await client.query("rollback").catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
