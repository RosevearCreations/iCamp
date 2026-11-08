import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sysopReturnPath } from "../lib/platform/shell.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Build 232 MFA return accepts only the protected Sysop routes", () => {
  for (const path of ["/sysop", "/platform"]) {
    assert.equal(sysopReturnPath(path), path);
  }
  for (const path of [
    "//evil.example/sysop",
    "/\\evil.example",
    "https://evil.example/sysop",
    "/sysop/../api/auth/login",
    "/sysop?next=https://evil.example",
    "/campground",
    "/workspaces/management",
    "",
    null,
    undefined,
    ["/sysop"],
  ]) {
    assert.equal(sysopReturnPath(path), "/auth/account");
  }
});

test("Build 232 trusted operator bindings are separately reviewed and never seeded", () => {
  const sql = read(
    "database/migrations/0219_build232_sysop_master_owner_bindings.sql",
  );
  assert.match(sql, /owner_slot in \('ree', 'jack'\)/u);
  assert.match(sql, /owner_slot text not null unique/u);
  assert.match(sql, /binding_state text not null default 'pending'/u);
  assert.match(sql, /verified_by <> user_id/u);
  assert.match(sql, /verification_reference/u);
  assert.match(sql, /enable row level security/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /revoke all .* from public/u);
  assert.doesNotMatch(
    sql,
    /insert into icamp_private\.platform_master_owner_bindings/u,
  );
});

test("Build 232 read-only Sysop requires owner binding, active reviewed grant, and MFA", () => {
  const platform = read("lib/platform/postgres.mjs");
  const guard = read("lib/platform/access.ts");
  assert.match(
    platform,
    /to_regclass\('icamp_private\.platform_master_owner_bindings'\)/u,
  );
  assert.match(platform, /platform_master_owner_bindings o/u);
  assert.match(platform, /o\.binding_state = 'verified'/u);
  assert.match(platform, /g\.grant_state = 'active'/u);
  assert.match(platform, /a\.account_type = 'staff'/u);
  assert.match(platform, /f\.factor_state = 'verified'/u);
  assert.match(platform, /assuranceLevel !== "aal2"/u);
  assert.match(guard, /requireStaff\(returnPath\)/u);
  assert.match(guard, /getPlatformOverview/u);
  assert.match(guard, /auth\/not-authorized/u);
  assert.match(guard, /auth\/mfa\?next=/u);
  assert.doesNotMatch(platform, /select \* from .*reservations/u);
});

test("Build 232 navigation maintains two independent authorization paths", () => {
  const sysop = read("app/sysop/page.tsx");
  const shell = read("components/sysop-shell.tsx");
  const platform = read("app/platform/page.tsx");
  const campground = read("app/campground/page.tsx");
  assert.match(sysop, /requireSysop\("\/sysop"\)/u);
  assert.match(platform, /getPlatformOverview/u);
  assert.match(platform, /SysopShell/u);
  assert.match(shell, /data-shell="sysop"/u);
  assert.match(shell, /Aggregate statistics/u);
  assert.doesNotMatch(shell, /href="\/workspaces\/management\/campgrounds/u);
  assert.match(campground, /requireStaff\("\/campground"\)/u);
  assert.match(campground, /listAssignedCampgrounds\(session\.user\.id\)/u);
  assert.match(
    campground,
    /getCampgroundAuthorization\(\s*session\.user\.id,\s*selected\.campgroundId/u,
  );
  assert.match(
    campground,
    /assigned\.some\(\(item\) => item\.campgroundId === requested\)/u,
  );
  assert.doesNotMatch(
    campground,
    /getPlatformOverview|platform_operator_grants/u,
  );
  assert.match(read("components/app-shell.tsx"), /href="\/campground"/u);
});

test("Build 232 MFA verification returns to a validated Sysop path", () => {
  const page = read("app/auth/mfa/page.tsx");
  const panel = read("app/auth/mfa/mfa-panel.tsx");
  assert.match(page, /sysopReturnPath\(\(await searchParams\)\.next\)/u);
  assert.match(page, /MfaPanel returnPath=\{next\}/u);
  assert.match(panel, /router\.push\(returnPath\)/u);
});
