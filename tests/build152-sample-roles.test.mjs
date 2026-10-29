import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const base = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, base), "utf8");

test("Build 152 usernames remain private, distinct, and normalized", () => {
  const migration = read(
    "database/migrations/0182_sample_accounts_platform_operator.sql",
  );
  assert.match(migration, /username_normalized text/u);
  assert.match(
    migration,
    /unique index user_accounts_username_normalized_unique/u,
  );
  assert.match(migration, /grant_state text not null default 'pending'/u);
  assert.match(migration, /reviewed_by <> user_id/u);
  assert.match(migration, /force row level security/u);
  assert.doesNotMatch(migration, /Sample12345|Manage12345|Admin12345/u);
});

test("Platform access requires active reviewed grant and verified MFA", () => {
  const code = read("lib/platform/postgres.mjs");
  assert.match(code, /assuranceLevel !== "aal2"/u);
  assert.match(code, /g.grant_state = 'active'/u);
  assert.match(code, /a.mfa_required = true/u);
  assert.match(code, /f.factor_state = 'verified'/u);
});

test("Login accepts account username without stripping existing email support", () => {
  const auth = read("lib/auth/postgres.mjs");
  const login = read("app/auth/login/page.tsx");
  assert.match(auth, /a.username_normalized = \$2/u);
  assert.match(login, /Username or email/u);
});
