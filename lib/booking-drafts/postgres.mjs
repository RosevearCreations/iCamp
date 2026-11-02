import pg from "pg";

import { quoteSnapshot } from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Booking draft storage is unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeBookingDraftPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function withOwner(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function mapDraft(row, meta) {
  const day = (value) =>
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  return {
    id: row.id,
    campgroundId: row.campground_id,
    campgroundSlug: meta.campground_slug,
    campgroundName: meta.campground_name,
    accommodationId: row.accommodation_id,
    accommodationName: meta.accommodation_name,
    accommodationCode: meta.accommodation_code,
    arrivalDate: day(row.arrival_date),
    departureDate: day(row.departure_date),
    selections: row.selections,
    savedQuote: row.saved_quote,
    consentedAt: new Date(row.consented_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    rowVersion: Number(row.row_version),
  };
}

async function hydrate(rows) {
  if (rows.length === 0) return [];
  // Ownership was already established by an icamp_app RLS transaction. These
  // lookups only supplement a known owner row with public accommodation labels.
  const ids = [...new Set(rows.map((row) => row.accommodation_id))];
  const result = await getPool().query(
    `select a.id, a.code as accommodation_code,
       a.display_name as accommodation_name,
       c.slug as campground_slug, c.name as campground_name
     from public.accommodations a
     join public.campgrounds c on c.id=a.campground_id
     where a.id = any($1::uuid[])`,
    [ids],
  );
  const labels = new Map(result.rows.map((row) => [row.id, row]));
  return rows
    .filter((row) => labels.has(row.accommodation_id))
    .map((row) => mapDraft(row, labels.get(row.accommodation_id)));
}

async function clearOwnExpired(client, userId) {
  await client.query(
    `delete from public.guest_booking_drafts
     where user_account_id=$1 and expires_at <= statement_timestamp()`,
    [userId],
  );
}

export async function saveOwnBookingDraft({ userId, input, detail }) {
  const client = await getPool().connect();
  try {
    // Validate the live tenant/accommodation binding through a privileged,
    // read-only lookup. Guest RLS intentionally does not allow accommodation
    // management table reads; only the saved draft itself uses the guest role.
    const scope = await client.query(
      `select c.organization_id, c.id as campground_id
       from public.campgrounds c
       join public.accommodations a on a.campground_id=c.id
       where c.slug=$1 and a.id=$2 and c.lifecycle_state='active'
         and a.lifecycle_state='active'
         and a.accommodation_kind in ('campsite','rental_cottage')
       limit 1`,
      [input.campgroundSlug, input.accommodationId],
    );
    if (
      scope.rowCount !== 1 ||
      detail?.accommodation?.id !== input.accommodationId ||
      detail?.campground?.id !== scope.rows[0].campground_id
    ) {
      throw new Error("This accommodation is not available for draft saving.");
    }
    const { organization_id: organizationId, campground_id: campgroundId } =
      scope.rows[0];
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    await clearOwnExpired(client, userId);
    const payload = [
      organizationId,
      campgroundId,
      input.accommodationId,
      userId,
      input.arrivalDate,
      input.departureDate,
      JSON.stringify(input.selections),
      JSON.stringify(quoteSnapshot(detail)),
    ];
    const saved = await client.query(
      `insert into public.guest_booking_drafts (
         organization_id,campground_id,accommodation_id,user_account_id,
         arrival_date,departure_date,selections,saved_quote
       ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
       on conflict on constraint guest_booking_drafts_unique_selection
       do update set
         selections=excluded.selections,
         saved_quote=excluded.saved_quote,
         consented_at=statement_timestamp(),
         expires_at=statement_timestamp()+interval '7 days'
       where guest_booking_drafts.selections is distinct from excluded.selections
          or guest_booking_drafts.saved_quote is distinct from excluded.saved_quote
       returning id`,
      payload,
    );
    const existing = saved.rows[0]
      ? saved.rows[0]
      : (
          await client.query(
            `select id from public.guest_booking_drafts
             where user_account_id=$1 and campground_id=$2 and accommodation_id=$3
               and arrival_date=$4 and departure_date=$5`,
            [
              userId,
              campgroundId,
              input.accommodationId,
              input.arrivalDate,
              input.departureDate,
            ],
          )
        ).rows[0];
    if (!existing) throw new Error("Could not save booking draft.");
    await client.query("commit");
    return existing.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listOwnBookingDrafts({ userId }) {
  const rows = await withOwner(userId, async (client) => {
    await clearOwnExpired(client, userId);
    const result = await client.query(
      `select * from public.guest_booking_drafts
       where user_account_id=$1 and expires_at > statement_timestamp()
       order by updated_at desc, id desc limit 30`,
      [userId],
    );
    return result.rows;
  });
  return hydrate(rows);
}

export async function getOwnBookingDraft({ userId, draftId }) {
  const rows = await withOwner(userId, async (client) => {
    await clearOwnExpired(client, userId);
    const result = await client.query(
      `select * from public.guest_booking_drafts
       where id=$1 and user_account_id=$2
         and expires_at > statement_timestamp()`,
      [draftId, userId],
    );
    return result.rows;
  });
  return (await hydrate(rows))[0] ?? null;
}

export async function deleteOwnBookingDraft({ userId, draftId }) {
  return withOwner(userId, async (client) => {
    const result = await client.query(
      `delete from public.guest_booking_drafts
       where id=$1 and user_account_id=$2 returning id`,
      [draftId, userId],
    );
    return result.rowCount === 1;
  });
}
