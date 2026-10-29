import pg from "pg";

const { Pool } = pg;
let pool;

function db() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for profile operations.");
    }
    pool = new Pool({ connectionString, max: 3 });
  }
  return pool;
}

export async function getOwnAccountProfile(userId) {
  const result = await db().query(
    `select display_name, preferred_contact
     from icamp_private.account_profiles where user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? { display_name: "", preferred_contact: "none" };
}

export async function saveOwnAccountProfile({
  userId,
  displayName,
  preferredContact,
}) {
  const name = String(displayName).trim();
  if (name.length > 100 || /[\u0000-\u001f]/u.test(name)) {
    throw new Error(
      "Profile display name must be at most 100 printable characters.",
    );
  }
  if (!["none", "email", "phone"].includes(preferredContact)) {
    throw new Error("Invalid contact preference.");
  }
  await db().query(
    `insert into icamp_private.account_profiles
       (user_id, display_name, preferred_contact)
     values ($1, $2, $3)
     on conflict (user_id) do update
       set display_name = excluded.display_name,
           preferred_contact = excluded.preferred_contact,
           updated_at = statement_timestamp()`,
    [userId, name, preferredContact],
  );
}
