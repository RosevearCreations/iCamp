import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL required for Build192 lifecycle verification.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const id = () => randomUUID();
async function one(sql, args = []) {
  const r = await client.query(sql, args);
  assert.equal(r.rowCount, 1, `Expected one row: ${sql.slice(0, 80)}`);
  return r.rows[0];
}
async function denied(sql, args, pattern) {
  await client.query("savepoint build192_expected_denial");
  let rejected = false;
  try {
    await client.query(sql, args);
  } catch (e) {
    rejected = true;
    assert.match(String(e.message), pattern);
  } finally {
    await client.query("rollback to savepoint build192_expected_denial");
    await client.query("release savepoint build192_expected_denial");
  }
  assert.ok(rejected, "Expected Build192 safety denial");
}
async function actor(user) {
  await client.query("reset role");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [user]);
}
const post = `select * from icamp_private.post_store_stock_operation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;
const base = (
  camp,
  event,
  product,
  loc,
  kind,
  qty,
  ver,
  source = "synthetic-docket-192",
  note = "Documented synthetic inventory source",
  dest = null,
  destVer = null,
  session = null,
  amount = null,
) => [
  camp,
  event,
  product,
  loc,
  kind,
  qty,
  ver,
  source,
  note,
  dest,
  destVer,
  session,
  amount,
];
try {
  await client.query("begin");
  const suffix = id().slice(0, 8);
  const orgA = await one(
    "insert into public.organizations(name,slug) values($1,$2) returning id",
    ["Build192 Test A", "build192-a-" + suffix],
  );
  const orgB = await one(
    "insert into public.organizations(name,slug) values($1,$2) returning id",
    ["Build192 Test B", "build192-b-" + suffix],
  );
  const campA = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,$2,$3) returning id",
    [orgA.id, "Build192 Test Camp A", "build192-camp-a-" + suffix],
  );
  const campB = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,$2,$3) returning id",
    [orgB.id, "Build192 Test Camp B", "build192-camp-b-" + suffix],
  );
  const manager = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values($1,'staff') returning id",
    [`build192-manager-${suffix}@test.invalid`],
  );
  const reviewer = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values($1,'staff') returning id",
    [`build192-reviewer-${suffix}@test.invalid`],
  );
  const outsider = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values($1,'staff') returning id",
    [`build192-outsider-${suffix}@test.invalid`],
  );
  for (const [user, org, camp, role] of [
    [manager.id, orgA.id, campA.id, "campground_manager"],
    [reviewer.id, orgA.id, campA.id, "finance"],
    [outsider.id, orgB.id, campB.id, "campground_manager"],
  ]) {
    const a = await one(
      "insert into icamp_private.campground_assignments(user_id,organization_id,campground_id) values($1,$2,$3) returning id",
      [user, org, camp],
    );
    await client.query(
      "insert into icamp_private.campground_assignment_roles(assignment_id,role_id) select $1,id from icamp_private.roles where role_code=$2 and role_kind='template'",
      [a.id, role],
    );
  }
  const product = await one(
    `insert into icamp_private.store_catalog_products(organization_id,campground_id,sku,name,description,category,created_by_user_id)
      values($1,$2,'BUILD192-TEST','Build192 synthetic supply','Synthetic goods for isolated transactional PostgreSQL tests.','essentials',$3) returning id`,
    [orgA.id, campA.id, manager.id],
  );
  const floor = id(),
    backroom = id(),
    otherLoc = id();
  await actor(manager.id);
  for (const [loc, camp, org, code] of [
    [floor, campA.id, orgA.id, "sales_floor"],
    [backroom, campA.id, orgA.id, "backroom"],
    [otherLoc, campB.id, orgB.id, "sales_floor"],
  ]) {
    if (camp !== campA.id) {
      await actor(outsider.id);
    }
    await one(
      `insert into icamp_private.store_stock_locations(id,organization_id,campground_id,location_code,display_name,created_by_user_id)
       values($1,$2,$3,$4,$5,$6) returning id`,
      [
        loc,
        org,
        camp,
        code,
        code + " verified",
        camp === campA.id ? manager.id : outsider.id,
      ],
    );
  }
  await actor(manager.id);
  const opening = id();
  assert.equal(
    (
      await one(
        post,
        base(campA.id, opening, product.id, floor, "opening_count", 8, 0),
      )
    ).created,
    true,
  );
  await denied(
    post,
    base(campA.id, id(), product.id, floor, "opening_count", 8, 1),
    /opening|version/i,
  );
  await one(post, base(campA.id, id(), product.id, floor, "receipt", 2, 1));
  await denied(
    post,
    base(campA.id, id(), product.id, floor, "damage", 11, 2),
    /negative|Insufficient/i,
  );
  await denied(
    post,
    base(campA.id, id(), product.id, floor, "receipt", 1, 1),
    /version changed/i,
  );
  const session = id();
  await one(
    `insert into icamp_private.store_pos_sessions(id,organization_id,campground_id,register_code,opening_cash_cents,opened_by_user_id)
    values($1,$2,$3,'front_desk',1000,$4) returning id`,
    [session, orgA.id, campA.id, manager.id],
  );
  await denied(
    post,
    base(campA.id, id(), product.id, floor, "pos_sale", 1, 2),
    /register/i,
  );
  const sale = id();
  assert.equal(
    (
      await one(
        post,
        base(
          campA.id,
          sale,
          product.id,
          floor,
          "pos_sale",
          3,
          2,
          "pos-manual-192",
          "Manual unsettled sale stock evidence",
          null,
          null,
          session,
          1299,
        ),
      )
    ).created,
    true,
  );
  assert.equal(
    (
      await one(
        post,
        base(
          campA.id,
          sale,
          product.id,
          floor,
          "pos_sale",
          3,
          2,
          "pos-manual-192",
          "Manual unsettled sale stock evidence",
          null,
          null,
          session,
          1299,
        ),
      )
    ).created,
    false,
  );
  await denied(
    post,
    base(
      campA.id,
      sale,
      product.id,
      floor,
      "pos_sale",
      5,
      2,
      "pos-manual-192",
      "Manual unsettled sale stock evidence",
      null,
      null,
      session,
      1299,
    ),
    /idempotency/i,
  );
  await denied(
    post,
    base(
      campA.id,
      id(),
      product.id,
      floor,
      "pos_sale",
      8,
      3,
      "pos-manual-192",
      "Manual unsettled sale stock evidence",
      null,
      null,
      session,
      1299,
    ),
    /negative|Insufficient/i,
  );
  const transfer = id();
  await one(
    post,
    base(
      campA.id,
      transfer,
      product.id,
      floor,
      "transfer",
      2,
      3,
      "transfer-docket-192",
      "Moved two units to back room",
      backroom,
      0,
    ),
  );
  assert.equal(
    (
      await one(
        "select quantity_on_hand from icamp_private.store_stock_balances where product_id=$1 and location_id=$2",
        [product.id, floor],
      )
    ).quantity_on_hand,
    5,
  );
  assert.equal(
    (
      await one(
        "select quantity_on_hand from icamp_private.store_stock_balances where product_id=$1 and location_id=$2",
        [product.id, backroom],
      )
    ).quantity_on_hand,
    2,
  );
  assert.equal(
    (
      await one(
        "select count(*)::int total from icamp_private.store_stock_events where transfer_group_id=$1",
        [transfer],
      )
    ).total,
    2,
  );
  await denied(
    post,
    base(
      campA.id,
      id(),
      product.id,
      floor,
      "transfer",
      1,
      4,
      "transfer-docket-192",
      "Cross-camp transfers must be denied",
      otherLoc,
      0,
    ),
    /destination|authorized/i,
  );
  await denied(
    "update icamp_private.store_stock_events set reason_note='Changed source evidence' where id=$1",
    [sale],
    /permission denied|immutable|row-level security/i,
  );
  const count = id();
  const observed = await one(
    `insert into icamp_private.store_stock_counts(id,organization_id,campground_id,product_id,location_id,expected_quantity,expected_version,observed_quantity,source_reference,reason_note,counted_by_user_id)
    values($1,$2,$3,$4,$5,0,1,4,'count-sheet-192','Independent physical floor count',$6) returning *`,
    [count, orgA.id, campA.id, product.id, floor, manager.id],
  );
  assert.equal(observed.expected_quantity, 5);
  assert.equal(Number(observed.expected_version), 4);
  const reviewSql =
    "select * from icamp_private.review_store_stock_count($1,$2,$3,$4,$5,$6)";
  await denied(
    reviewSql,
    [
      campA.id,
      count,
      id(),
      "accept",
      "I independently examined the count",
      id(),
    ],
    /independent/i,
  );
  await actor(reviewer.id);
  const review = await one(reviewSql, [
    campA.id,
    count,
    id(),
    "accept",
    "Independent source and quantity checked",
    id(),
  ]);
  assert.ok(review.adjustment_id);
  assert.equal(
    (
      await one(
        "select quantity_on_hand from icamp_private.store_stock_balances where product_id=$1 and location_id=$2",
        [product.id, floor],
      )
    ).quantity_on_hand,
    4,
  );
  await denied(
    reviewSql,
    [campA.id, count, id(), "reject", "Duplicate review not permitted", id()],
    /already.*reviewed/i,
  );
  await actor(manager.id);
  const stale = id();
  await one(
    `insert into icamp_private.store_stock_counts(id,organization_id,campground_id,product_id,location_id,expected_quantity,expected_version,observed_quantity,source_reference,reason_note,counted_by_user_id)
    values($1,$2,$3,$4,$5,0,1,3,'count-sheet-193','Another physical counted source',$6) returning id`,
    [stale, orgA.id, campA.id, product.id, floor, manager.id],
  );
  await one(post, base(campA.id, id(), product.id, floor, "receipt", 1, 5));
  await actor(reviewer.id);
  await denied(
    reviewSql,
    [campA.id, stale, id(), "accept", "Stale count must require recount", id()],
    /stale|fresh/i,
  );
  await denied(
    "insert into icamp_private.store_pos_session_reviews(id,organization_id,campground_id,session_id,disposition,reason_note,reviewed_by_user_id) values($1,$2,$3,$4,'accepted','Cannot review unclosed session',$5)",
    [id(), orgA.id, campA.id, session, reviewer.id],
    /closed|different/i,
  );
  await actor(manager.id);
  const closed = await one(
    "select * from icamp_private.close_store_pos_session($1,$2,$3,$4,$5)",
    [campA.id, session, 1, 2000, "Manual close and witness till count"],
  );
  assert.equal(Number(closed.expected_cents), 2299);
  assert.equal(Number(closed.variance_cents), -299);
  await denied(
    "select * from icamp_private.close_store_pos_session($1,$2,$3,$4,$5)",
    [campA.id, session, 1, 2000, "Duplicate closing should be denied"],
    /changed|already closed/i,
  );
  await denied(
    "insert into icamp_private.store_pos_session_reviews(id,organization_id,campground_id,session_id,disposition,reason_note,reviewed_by_user_id) values($1,$2,$3,$4,'exception_open','Self-review forbidden by guard',$5)",
    [id(), orgA.id, campA.id, session, manager.id],
    /different.*reviewer/i,
  );
  await actor(reviewer.id);
  await denied(
    "insert into icamp_private.store_pos_session_reviews(id,organization_id,campground_id,session_id,disposition,reason_note,reviewed_by_user_id) values($1,$2,$3,$4,'accepted','Cannot accept cash difference',$5)",
    [id(), orgA.id, campA.id, session, reviewer.id],
    /variance|exception/i,
  );
  await one(
    "insert into icamp_private.store_pos_session_reviews(id,organization_id,campground_id,session_id,disposition,reason_note,reviewed_by_user_id) values($1,$2,$3,$4,'exception_open','Unresolved manual variance escalated',$5) returning id",
    [id(), orgA.id, campA.id, session, reviewer.id],
  );
  await actor(outsider.id);
  assert.equal(
    (
      await client.query(
        "select id from icamp_private.store_stock_events where campground_id=$1",
        [campA.id],
      )
    ).rowCount,
    0,
  );
  await denied(
    post,
    base(campA.id, id(), product.id, floor, "receipt", 1, 6),
    /permission/i,
  );
  await client.query("rollback");
  console.log(
    "Build192 PostgreSQL stock / transfer / POS / independent review / RLS lifecycle verified (rollback-only).",
  );
} catch (e) {
  await client.query("rollback").catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
