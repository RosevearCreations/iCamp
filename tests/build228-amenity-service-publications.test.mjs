import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeAmenityServiceReview,
  publicAmenityService,
} from "../lib/wayfinding/service-review.mjs";
import { buildGuestServiceDirectory } from "../lib/guest-services/directory.mjs";

const file = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const point = {
  id: "point-1",
  kind: "washroom",
  code: "WR-1",
  name: "Main washrooms",
  description: "Next to the recreation hall",
  accessibilityNote: "",
  landmarkHint: "Blue sign",
  x: 0.5,
  y: 0.4,
};
const directory = (wayfinding) =>
  buildGuestServiceDirectory({
    wayfinding,
    campgroundSlug: "camp-rosevear",
    arrivalDate: "2026-07-01",
    departureDate: "2026-07-04",
  });

test("Build 228 requires explicit owner review and meaningful information to publish", () => {
  assert.throws(
    () =>
      normalizeAmenityServiceReview({
        publish: true,
        operatingStatus: "reported_open",
      }),
    /Confirm/,
  );
  assert.throws(
    () => normalizeAmenityServiceReview({ publish: true, confirmed: true }),
    /Add reviewed/,
  );
  assert.throws(
    () => normalizeAmenityServiceReview({ operatingStatus: "always_open" }),
    /valid/,
  );
  assert.throws(
    () => normalizeAmenityServiceReview({ hoursSummary: "a".repeat(451) }),
    /450/,
  );
  assert.throws(
    () => normalizeAmenityServiceReview({ accessibilityDetails: "a\u0000b" }),
    /readable/,
  );
  assert.deepEqual(
    normalizeAmenityServiceReview({
      publish: true,
      confirmed: true,
      operatingStatus: "reported_closed",
      hoursSummary: "  Closed for maintenance  ",
    }),
    {
      publish: true,
      operatingStatus: "reported_closed",
      hoursSummary: "Closed for maintenance",
      accessibilityDetails: "",
    },
  );
});

test("Build 228 preserves unpublished and malformed source details as absent", () => {
  assert.equal(
    publicAmenityService({ serviceOperatingStatus: "reported_open" }),
    null,
  );
  assert.equal(
    publicAmenityService({
      serviceReviewedAt: "nonsense",
      serviceOperatingStatus: "reported_open",
    }),
    null,
  );
  assert.equal(
    publicAmenityService({
      serviceReviewedAt: "2026-07-01",
      serviceOperatingStatus: "not_an_allowed_status",
    }),
    null,
  );
  assert.match(directory([point]).items[0].availabilityLabel, /not verified/);
  assert.equal(directory([point]).items[0].hoursSummary, null);
});

test("Build 228 labels published service facts as campground-reported and dated", () => {
  const service = publicAmenityService({
    serviceReviewedAt: "2026-07-01T12:00:00.000Z",
    serviceOperatingStatus: "reported_closed",
    serviceHoursSummary: "Weekends 10–4",
    serviceAccessibilityDetails: "Ramp at east door",
  });
  const item = directory([{ ...point, service }]).items[0];
  assert.equal(item.hoursSummary, "Weekends 10–4");
  assert.equal(item.accessibilityDetails, "Ramp at east door");
  assert.equal(item.serviceReviewedAt, "2026-07-01");
  assert.match(item.availabilityLabel, /reported temporarily closed/);
  assert.match(item.availabilityLabel, /not live operating status/);
  assert.match(item.availabilityLabel, /reviewed 2026-07-01/);
});

test("Build 228 uses a separate publication boundary and additive database migration", () => {
  const migration = file(
    "database/migrations/0216_build228_verified_amenity_service_publication.sql",
  );
  assert.match(
    migration,
    /service_is_published boolean not null default false/i,
  );
  assert.match(migration, /service_reviewed_by_user_id/i);
  assert.match(migration, /not service_is_published or \(/i);
  assert.match(migration, /not new\.is_published/i);
  assert.match(migration, /map_image_version_id is distinct from/i);
  const reader = file("lib/public-booking-map/postgres.mjs");
  assert.match(
    reader,
    /w\.service_is_published and w\.service_reviewed_at is not null/,
  );
  assert.match(
    reader,
    /to_regclass\('icamp_private\.campground_wayfinding_publications'\)/,
  );
  assert.match(reader, /null::text as "serviceOperatingStatus"/);
});

test("Build 228 server mutations enforce tenant, publish permission and revision checks", () => {
  const backend = file("lib/wayfinding/postgres.mjs");
  const action = file(
    "app/workspaces/management/campgrounds/maps/wayfinding/services/actions.ts",
  );
  assert.match(
    backend,
    /await ensureReviewPermissions\(actorUserId, campgroundId\)/,
  );
  assert.match(backend, /w\.map_object_id=\$1 and w\.campground_id=\$2/);
  assert.match(backend, /for update of w/);
  assert.match(backend, /row\.row_version\) !== expectedRowVersion/);
  assert.match(backend, /review\.publish && !sourceEligible/);
  assert.match(backend, /appendAuditEvent\(client/);
  assert.match(action, /requireCampgroundPermission/);
  assert.match(action, /revalidatePath\("\/guest\/services"\)/);
});

test("Build 228 owner editor requires explicit review and does not expose draft details to guests", () => {
  const owner = file(
    "app/workspaces/management/campgrounds/maps/wayfinding/services/page.tsx",
  );
  const guest = file("app/guest/services/page.tsx");
  assert.match(owner, /requireAnyCampgroundPermission/);
  assert.match(owner, /getCampgroundAuthorization/);
  assert.match(owner, /name="confirmed"/);
  assert.match(owner, /value="draft"/);
  assert.match(owner, /value="publish"/);
  assert.match(owner, /!directory\.migrationReady/);
  assert.match(guest, /Campground-published hours/);
  assert.match(guest, /not certified/);
});
