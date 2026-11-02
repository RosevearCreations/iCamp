import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = readFileSync(
  new URL("../database/fixtures/camp_rosevear_build085.sql", import.meta.url),
  "utf8",
);
const verification = readFileSync(
  new URL(
    "../database/fixtures/verify_camp_rosevear_build085.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Camp Rosevear remains an inactive, guarded, manual Build 085 fixture", () => {
  assert.match(fixture, /Camp Rosevear.*SYNTHETIC/u);
  assert.match(
    fixture,
    /if exists\(select 1 from public\.campgrounds where id <> camp\)/u,
  );
  assert.match(
    fixture,
    /if exists\(select 1 from icamp_private\.user_accounts where id not in/u,
  );
  assert.match(
    fixture,
    /'Camp Rosevear','camp-rosevear-sample','America\/Toronto','inactive'/u,
  );
  assert.match(fixture, /operating_state<>'unavailable'/u);
  assert.doesNotMatch(fixture, /insert into public\.reservations/u);
  assert.doesNotMatch(
    fixture,
    /insert into icamp_private\.(password_credentials|auth_sessions)/u,
  );
  assert.doesNotMatch(
    fixture,
    /insert into public\.(payments|payment_transactions)/u,
  );
});

test("Camp Rosevear verifies an open closure and synthetic staff without credentials", () => {
  assert.match(fixture, /'closure','water_quality'/u);
  assert.match(fixture, /'reopen_request'/u);
  assert.doesNotMatch(fixture, /'reopen',/u);
  assert.match(verification, /kind='closure'/u);
  assert.match(verification, /kind='reopen'/u);
  assert.match(verification, /account_state='disabled'/u);
  assert.match(verification, /icamp_private\.password_credentials/u);
  assert.match(verification, /icamp_private\.auth_sessions/u);
  assert.match(verification, /public\.reservations/u);
});
