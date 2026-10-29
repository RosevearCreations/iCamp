// Build 153 operator tool. Runs ONLY on a separate, approved, isolated test database.
// Supply credentials via a private operator environment, never GitHub or chat.
import pg from "pg";

import { hashPassword, validatePassword } from "../lib/auth/crypto.mjs";

const args = process.argv.slice(2);
if (!args.includes("--apply") || args.length !== 1) {
  process.stdout.write(
    "DRY RUN: No database accessed. To activate on a separately approved test " +
      "Supabase project supply --apply and the guarded private environment.\n",
  );
  process.exit(0);
}

const env = process.env;
const approvedRef = env.ICAMP_TEST_SUPABASE_REF ?? "";
const url = env.DATABASE_URL ?? "";
if (
  env.ICAMP_APP_ENV !== "testing" ||
  env.ICAMP_ALLOW_TEST_ACCOUNT_ACTIVATION !== "true" ||
  !/^[a-z0-9]{20}$/u.test(approvedRef) ||
  approvedRef === "cxgszmpbeswdikzofvjv" ||
  !url.includes(approvedRef)
) {
  throw new Error(
    "Refusing activation: an explicitly approved, different test database is required.",
  );
}

const credentials = [
  ["samplecamper", env.ICAMP_TEST_GUEST_PASSWORD],
  ["camprosevear", env.ICAMP_TEST_MANAGER_PASSWORD],
  ["rosevear", env.ICAMP_TEST_PLATFORM_PASSWORD],
];
if (
  credentials.some(
    ([, password]) =>
      !password || password.length < 16 || !validatePassword(password).ok,
  ) ||
  new Set(credentials.map(([, password]) => password)).size !== 3 ||
  !env.ICAMP_MFA_ENCRYPTION_KEY
) {
  throw new Error(
    "Supply three distinct fresh passwords (at least 16 characters) and an MFA encryption key through the private test secret store.",
  );
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("begin");
  const scope = await client.query(
    `select c.id, c.organization_id, c.lifecycle_state, o.name as organization_name
     from public.campgrounds c
     join public.organizations o on o.id = c.organization_id
     where c.slug = 'camp-rosevear-sample'
       and o.slug = 'camp-rosevear-synthetic'
       and c.name = 'Camp Rosevear'
       and o.name = 'Camp Rosevear — SYNTHETIC TEST ONLY'
     for update of c, o`,
  );
  if (scope.rowCount !== 1) {
    throw new Error("The approved synthetic Camp Rosevear fixture is absent.");
  }

  const otherCampgrounds = await client.query(
    "select count(*)::integer as total from public.campgrounds where id <> $1",
    [scope.rows[0].id],
  );
  if (otherCampgrounds.rows[0].total !== 0) {
    throw new Error("Test database must contain no other campground tenants.");
  }
  for (const [username, password] of credentials) {
    const kind = username === "samplecamper" ? "guest" : "staff";
    const row = await client.query(
      `select id, account_type, account_state, email_normalized
       from icamp_private.user_accounts
       where username_normalized = $1 for update`,
      [username],
    );
    if (
      row.rowCount !== 1 ||
      row.rows[0].account_type !== kind ||
      row.rows[0].account_state !== "disabled" ||
      !row.rows[0].email_normalized.endsWith(".invalid")
    ) {
      throw new Error(
        "A requested user is not an isolated disabled test identity.",
      );
    }
    const passwordHash = await hashPassword(password);
    await client.query(
      `insert into icamp_private.password_credentials (user_id, password_hash)
       values ($1, $2)
       on conflict (user_id) do update set
         password_hash = excluded.password_hash, changed_at = statement_timestamp()`,
      [row.rows[0].id, passwordHash],
    );
    await client.query(
      `update icamp_private.user_accounts set account_state = 'active',
         mfa_required = $2 where id = $1`,
      [row.rows[0].id, username === "rosevear"],
    );
  }

  const manager = await client.query(
    `select a.id, r.role_code from icamp_private.campground_assignments a
     join icamp_private.user_accounts u on u.id = a.user_id
     join icamp_private.campground_assignment_roles ar on ar.assignment_id = a.id
     join icamp_private.roles r on r.id = ar.role_id
     where u.username_normalized = 'camprosevear'
       and a.campground_id = $1`,
    [scope.rows[0].id],
  );
  if (
    manager.rowCount !== 1 ||
    manager.rows[0].role_code !== "campground_manager"
  ) {
    throw new Error("Manager role must be uniquely scoped to Camp Rosevear.");
  }
  await client.query(
    `update icamp_private.campground_assignments
     set assignment_state = 'active' where id = $1`,
    [manager.rows[0].id],
  );
  await client.query(
    `update public.organizations
     set lifecycle_state = 'active' where id = $1`,
    [scope.rows[0].organization_id],
  );
  await client.query(
    `update public.campgrounds
     set lifecycle_state = 'active' where id = $1`,
    [scope.rows[0].id],
  );

  // The platform operator is allowed to enroll MFA but NOT granted global admin.
  const grant = await client.query(
    `select g.grant_state from icamp_private.platform_operator_grants g
     join icamp_private.user_accounts u on u.id = g.user_id
     where u.username_normalized = 'rosevear'`,
  );
  if (grant.rowCount !== 1 || grant.rows[0].grant_state !== "pending") {
    throw new Error("Platform role must remain pending independent review.");
  }
  await client.query("commit");
  process.stdout.write(
    "Activated three isolated TEST accounts with freshly supplied credentials. " +
      "Platform grant remains PENDING. No integration gateway called.\n",
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
