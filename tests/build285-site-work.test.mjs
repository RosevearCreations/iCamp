import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeSiteWork285 } from "../lib/build285/site-work.mjs";

const sites = [
  {
    id: "12",
    code: "12",
    displayName: "Synthetic Site 12",
    statusState: "occupied",
  },
  {
    id: "18",
    code: "18",
    displayName: "Synthetic Site 18",
    statusState: "available",
  },
];
const repair = { accommodationId: "12", caseState: "open" };
const delivery = { accommodationId: "12", jobState: "queued" };

test("Site 12 independent work indicators survive completing either job", () => {
  const [both] = summarizeSiteWork285(sites, [repair], [delivery]);
  assert.equal(both.assistance, 1);
  assert.equal(both.fulfillment, 1);
  const [fixed, other] = summarizeSiteWork285(
    sites,
    [{ ...repair, caseState: "closed" }],
    [delivery],
  );
  assert.equal(fixed.assistance, 0);
  assert.equal(fixed.fulfillment, 1);
  assert.equal(fixed.operatingState, "occupied");
  assert.equal(other.fulfillment, 0);
  const [delivered] = summarizeSiteWork285(
    sites,
    [repair],
    [{ ...delivery, jobState: "completed" }],
  );
  assert.equal(delivered.assistance, 1);
  assert.equal(delivered.fulfillment, 0);
});

test("Unverified sources remain unknown and work stays on its recorded site", () => {
  const [first, second] = summarizeSiteWork285(sites, null, [
    { ...delivery, accommodationId: "18" },
  ]);
  assert.equal(first.assistance, null);
  assert.equal(first.fulfillment, 0);
  assert.equal(second.fulfillment, 1);
});

test("Monitor uses staff permissions and existing tenant-scoped queues", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/site-work/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /requireStaff\(path\)/u);
  assert.match(page, /getCampgroundAuthorization/u);
  assert.match(page, /permissions.includes\("reservation.modify"\)/u);
  assert.match(page, /listAssistanceQueue\(session.user.id, campground\)/u);
  assert.match(page, /!fulfillment.value.truncated/u);
  assert.match(page, /publication.value.campground.id === campground/u);
});

test("Missing job location must not be reported as no work", () => {
  const [site] = summarizeSiteWork285(
    sites,
    [repair],
    [{ ...delivery, accommodationId: null }],
  );
  assert.equal(site.fulfillment, null);
  assert.equal(site.assistance, 1);
});

test("Monitor refresh is a read-only reconnect and visibility fallback", () => {
  const refresh = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/site-work/site-work-refresh.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(refresh, /router\.refresh\(\)/u);
  assert.match(refresh, /addEventListener\("online", refresh\)/u);
  assert.match(refresh, /removeEventListener\("online", refresh\)/u);
  assert.match(refresh, /30_000/u);
});
