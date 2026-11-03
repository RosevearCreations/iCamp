import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCommandLayout } from "../lib/command-centre/layout-postgres.mjs";

const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const allowed = [
  {
    href: "/workspaces/management/campgrounds/reservations",
    title: "Reservations",
  },
  { href: "/workspaces/maintenance/work-orders", title: "Maintenance" },
];
const valid = {
  label: "Morning shift overview",
  perspective: "management",
  category: "Bookings",
  searchTerm: "reservations",
  density: "compact",
  favoriteHrefs: [allowed[0].href],
  kpiOrder: ["arrivals", "sites", "work_orders", "financial"],
  isDefault: true,
};
test("Build194 saves bounded authorized preferences rather than source metrics", () => {
  const parsed = normalizeCommandLayout(valid, allowed);
  assert.equal(parsed.label, "Morning shift overview");
  assert.deepEqual(parsed.favoriteHrefs, [allowed[0].href]);
  assert.equal(parsed.density, "compact");
  assert.equal(parsed.isDefault, true);
  assert.ok(!Object.hasOwn(parsed, "bookingTotals"));
  assert.ok(!Object.hasOwn(parsed, "guestNames"));
});
test("Build194 never trusts injected module URLs, duplicate metric keys or oversized filters", () => {
  assert.throws(
    () =>
      normalizeCommandLayout(
        { ...valid, favoriteHrefs: ["/workspaces/security/dashboard"] },
        allowed,
      ),
    /accessible campground modules/,
  );
  assert.throws(
    () =>
      normalizeCommandLayout(
        { ...valid, favoriteHrefs: [allowed[0].href, allowed[0].href] },
        allowed,
      ),
    /Favorites/,
  );
  assert.throws(
    () =>
      normalizeCommandLayout(
        { ...valid, kpiOrder: ["sites", "sites", "financial", "work_orders"] },
        allowed,
      ),
    /metric card order/,
  );
  assert.throws(
    () =>
      normalizeCommandLayout({ ...valid, searchTerm: "x".repeat(65) }, allowed),
    /Search text/,
  );
  assert.throws(
    () =>
      normalizeCommandLayout({ ...valid, perspective: "owner-root" }, allowed),
    /Invalid Command filter/,
  );
  assert.throws(
    () => normalizeCommandLayout({ ...valid, label: "x" }, allowed),
    /3–48/,
  );
});
test("Build194 has database tenancy, default/view caps and optimistic revision guards", () => {
  const sql = source(
    "database/migrations/0208_build194_management_command_views.sql",
  );
  assert.match(sql, /force row level security/i);
  assert.match(sql, /management_command_views_one_default/);
  assert.match(sql, /Maximum eight saved layouts/);
  assert.match(sql, /user_id=nullif\(current_setting\('icamp.user_id'/);
  assert.match(sql, /row_version:=old.row_version\+1/);
  assert.match(sql, /management_command_views_guard_insert_update/);
  assert.doesNotMatch(sql, /public\.(reservations|payments)\s+set/i);
});
test("Build194 source metrics remain from the canonical authorized command services", () => {
  const page = source("app/workspaces/management/command/page.tsx");
  const ui = source("components/management-module-finder.tsx");
  const actions = source("app/workspaces/management/command/actions.ts");
  assert.match(page, /buildManagementSnapshot/);
  assert.match(page, /mayReadReservations/);
  assert.match(page, /mayReadMaintenance/);
  assert.match(page, /Source restricted or currently unavailable/);
  assert.match(page, /savedViewResult.failed/);
  assert.match(ui, /Favorite: /);
  assert.match(ui, /No authorized workspaces match/);
  assert.match(actions, /getCampgroundAuthorization/);
  assert.match(actions, /modulesForPermissions\(authorization.permissions\)/);
});
