import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pg from "pg";

// A real two-session PostgreSQL collision, never a mocked in-memory lock.
// Seeded isolated GitHub CI DB only. Do not run against a production database.
if (
  process.env.CI !== "true" ||
  process.env.ICAMP_APP_ENV !== "test" ||
  process.env.ICAMP_BUILD258_CONCURRENCY_ACK !== "ISOLATED_DB_ONLY" ||
  !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/icamp_ci$/u.test(
    process.env.DATABASE_URL ?? "",
  )
)
  throw new Error("Build258 concurrency test requires isolated CI database.");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
const arrival = "2030-07-10";
const departure = "2030-07-12";
const prefix = "build258-ci-" + randomUUID().replaceAll("-", "");
let fixture = null;
try {
  // The Build 016 demo seeds campground hierarchy, NOT accommodations.
  // Create one disposable canonical map-object/site/subtype fixture here.
  const section = await pool.query(
    [
      "select s.organization_id,s.campground_id,s.id as section_id",
      "from public.campground_sections s",
      "join public.campgrounds c on c.id=s.campground_id",
      "where s.lifecycle_state='active' and c.lifecycle_state='active'",
      "order by s.id limit 1",
    ].join(" "),
  );
  assert.equal(section.rowCount, 1, "Isolated demo section required.");
  const f = section.rows[0];
  const a = {
    organization_id: f.organization_id,
    campground_id: f.campground_id,
    id: randomUUID(),
    mapId: randomUUID(),
    sectionId: f.section_id,
  };
  fixture = a;
  const setup = await pool.connect();
  try {
    await setup.query("begin");
    await setup.query(
      [
        "insert into icamp_private.campground_map_objects",
        "(id,organization_id,campground_id,section_id,object_kind,",
        "object_code,display_name)",
        "values ($1,$2,$3,$4,'site',$5,'Build258 isolated test map site')",
      ].join(" "),
      [
        a.mapId,
        a.organization_id,
        a.campground_id,
        a.sectionId,
        "ci258" + a.id.slice(0, 8),
      ],
    );
    await setup.query(
      [
        "insert into public.accommodations",
        "(id,organization_id,campground_id,section_id,map_object_id,",
        "accommodation_kind,code,display_name)",
        "values($1,$2,$3,$4,$5,'campsite',$6,'Build258 isolated test site')",
      ].join(" "),
      [
        a.id,
        a.organization_id,
        a.campground_id,
        a.sectionId,
        a.mapId,
        "ci258" + a.id.slice(0, 8),
      ],
    );
    await setup.query(
      "insert into public.campsites (accommodation_id,organization_id,campground_id) values($1,$2,$3)",
      [a.id, a.organization_id, a.campground_id],
    );
    await setup.query("commit");
  } catch (error) {
    await setup.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    setup.release();
  }
  const source = await pool.query(
    [
      "select accommodation_id from",
      "icamp_private.live_accommodation_availability($1,$2::date,$3::date)",
      "where accommodation_id=$4",
      "and not reservation_blocked and not hold_blocked",
      "and not restriction_blocked and not turnover_blocked",
      "and not seasonal_blocked",
    ].join(" "),
    [a.campground_id, arrival, departure, a.id],
  );
  assert.equal(
    source.rowCount,
    1,
    "Synthetic canonical site must be available.",
  );
  async function attempt(index) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const row = await client.query(
        [
          "insert into public.reservation_holds",
          "(organization_id,campground_id,accommodation_id,",
          "arrival_date,departure_date,expires_at,hold_key)",
          "values($1,$2,$3,$4,$5,statement_timestamp()+interval '12 minutes',$6)",
          "returning id",
        ].join(" "),
        [
          a.organization_id,
          a.campground_id,
          a.id,
          arrival,
          departure,
          prefix + "-" + index,
        ],
      );
      await client.query("commit");
      return { success: true, id: row.rows[0].id };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      if (
        !/conflicts with an active temporary hold/u.test(String(error.message))
      )
        throw error;
      return { success: false, code: "CANONICAL_CONFLICT_DENIED" };
    } finally {
      client.release();
    }
  }
  const results = await Promise.all([attempt(1), attempt(2)]);
  assert.equal(results.filter((item) => item.success).length, 1);
  assert.equal(results.filter((item) => !item.success).length, 1);
  const persisted = await pool.query(
    [
      "select count(*)::int as count",
      "from public.reservation_holds",
      "where campground_id=$1 and accommodation_id=$2",
      "and arrival_date=$3 and departure_date=$4",
      "and hold_state='active' and expires_at>statement_timestamp()",
      "and hold_key like $5",
    ].join(" "),
    [a.campground_id, a.id, arrival, departure, prefix + "%"],
  );
  assert.equal(persisted.rows[0].count, 1);
  console.log(
    "Build258 REAL PostgreSQL concurrency PASS: two simultaneous overlapping holds, exactly one winner and one denied, no oversold site.",
  );
} finally {
  // Dispose ONLY of the synthetic site & holds in the isolated CI database.
  const cleanup = await pool.connect();
  try {
    await cleanup.query("begin");
    await cleanup.query(
      "delete from public.reservation_holds where hold_key like $1",
      [prefix + "%"],
    );
    if (fixture) {
      await cleanup.query(
        "delete from public.campsites where accommodation_id=$1",
        [fixture.id],
      );
      await cleanup.query("delete from public.accommodations where id=$1", [
        fixture.id,
      ]);
      await cleanup.query(
        "delete from icamp_private.campground_map_objects where id=$1",
        [fixture.mapId],
      );
    }
    await cleanup.query("commit");
  } catch {
    await cleanup.query("rollback").catch(() => undefined);
  } finally {
    cleanup.release();
  }
  await pool.end();
}
