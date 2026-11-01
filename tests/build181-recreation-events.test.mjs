import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  guestStayEligibleForEvent,
  normalizeRecreationEvent,
  normalizeRecreationRequest,
  recreationCapacityLabel,
} from "../lib/recreation-events/core.mjs";

const event = {
  title: "Evening stargazing",
  description: "Guided tour of the night sky",
  locationName: "North activity field",
  category: "nature",
  eventDate: "2027-07-18",
  startTime: "20:00",
  endTime: "21:30",
  capacityPlaces: 12,
  requiresRegistration: true,
  acceptingRequests: true,
  isPublished: true,
  accessibilityNote: "Ask the office about field access",
  ageGuidance: "All ages",
  status: "scheduled",
};
const published = {
  ...event,
  id: "event-1",
  campgroundId: "property-1",
  requestedPlaces: 4,
};
const stay = {
  id: "stay-1",
  campgroundId: "property-1",
  arrivalDate: "2027-07-17",
  departureDate: "2027-07-21",
  status: "confirmed",
};
const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("Build181 normalized local event creates bounded published request intake", () => {
  assert.deepEqual(normalizeRecreationEvent(event), event);
  assert.throws(
    () => normalizeRecreationEvent({ ...event, eventDate: "2027-02-30" }),
    /date/i,
  );
  assert.throws(
    () => normalizeRecreationEvent({ ...event, endTime: "19:30" }),
    /after/i,
  );
  assert.throws(
    () => normalizeRecreationEvent({ ...event, title: "A" }),
    /Title/i,
  );
  assert.throws(
    () => normalizeRecreationEvent({ ...event, description: "x\u0000y" }),
    /Description/i,
  );
});

test("Build181 request intake requires real published source capacity", () => {
  for (const change of [
    { capacityPlaces: "" },
    { capacityPlaces: 0 },
    { capacityPlaces: 501 },
    { isPublished: false },
    { requiresRegistration: false },
    { status: "cancelled" },
  ]) {
    assert.throws(
      () => normalizeRecreationEvent({ ...event, ...change }),
      /capacity|Requests may open/i,
    );
  }
  assert.equal(
    normalizeRecreationEvent({
      ...event,
      acceptingRequests: false,
      capacityPlaces: "",
    }).capacityPlaces,
    null,
  );
});

test("Build181 guest request values and idempotency IDs are validated", () => {
  const payload = {
    partySize: 3,
    guestNote: " Near the office ",
    clientRequestId: "27cece3f-cc8e-43e1-a084-b63d9cf27cc2",
  };
  assert.equal(
    normalizeRecreationRequest(payload).guestNote,
    "Near the office",
  );
  assert.throws(
    () => normalizeRecreationRequest({ ...payload, partySize: 21 }),
    /party size/i,
  );
  assert.throws(
    () => normalizeRecreationRequest({ ...payload, partySize: 0 }),
    /party size/i,
  );
  assert.throws(
    () =>
      normalizeRecreationRequest({ ...payload, clientRequestId: "not-a-uuid" }),
    /UUID/,
  );
  assert.throws(
    () =>
      normalizeRecreationRequest({ ...payload, guestNote: "x".repeat(401) }),
    /Guest note/,
  );
});

test("Build181 capacity wording never claims ticketing or admission", () => {
  assert.match(
    recreationCapacityLabel(published),
    /8 of 12 request places remain.*not confirmed admission/,
  );
  assert.match(
    recreationCapacityLabel({ ...published, requestedPlaces: 12 }),
    /reached/,
  );
  assert.match(
    recreationCapacityLabel({ ...published, status: "cancelled" }),
    /Cancelled/,
  );
  assert.match(
    recreationCapacityLabel({ ...published, acceptingRequests: false }),
    /closed/,
  );
});

test("Build181 eligibility is stay date, property, state and capacity scoped", () => {
  assert.equal(guestStayEligibleForEvent(stay, published), true);
  for (const change of [
    { campgroundId: "property-2" },
    { status: "pending" },
    { arrivalDate: "2027-07-19" },
    { departureDate: "2027-07-18" },
  ]) {
    assert.equal(
      guestStayEligibleForEvent({ ...stay, ...change }, published),
      false,
    );
  }
  assert.equal(
    guestStayEligibleForEvent(stay, { ...published, requestedPlaces: 12 }),
    false,
  );
});

test("Build181 migration enforces private RLS, real reservation FK and atomic request slots", () => {
  const source = read(
    "../database/migrations/0191_build181_recreation_events_registration.sql",
  );
  assert.match(source, /force row level security/g);
  assert.match(
    source,
    /recreation_request_reservation_fk foreign key \(organization_id,campground_id,reservation_id\)/,
  );
  assert.match(source, /r\.guest_user_id=new\.guest_user_id/);
  assert.match(source, /for update;/i);
  assert.match(source, /sum\(party_size\)/);
  assert.match(source, /recreation_request_once_per_stay unique/);
  assert.match(source, /recreation_requests_no_direct_access/);
  assert.doesNotMatch(source, /create policy.*for select to anon/);
});

test("Build181 server actions authorize event managers and guest-owned registration", () => {
  const manager = read(
    "../app/workspaces/management/campgrounds/events/actions.ts",
  );
  const guest = read("../app/guest/events/actions.ts");
  const backend = read("../lib/recreation-events/postgres.mjs");
  assert.match(manager, /requireCampgroundPermission\([\s\S]*?"event\.manage"/);
  assert.match(guest, /requireSignedIn\(path\)/);
  assert.match(guest, /session\.user\.accountType !== "guest"/);
  assert.match(backend, /for update of e/);
  assert.match(backend, /guest_user_id=\$2/);
  assert.match(backend, /appendAuditEvent/);
  assert.doesNotMatch(backend, /fetch\(|stripe|sendEmail|sendSms|issueTicket/i);
});

test("Build181 public and guest screens distinguish pending requests from admission", () => {
  const publicPage = read("../app/events/page.tsx");
  const guestPage = read("../app/guest/events/page.tsx");
  const managerPage = read(
    "../app/workspaces/management/campgrounds/events/page.tsx",
  );
  assert.match(publicPage, /No published events match/);
  assert.match(publicPage, /campground-local|local to each property/i);
  assert.match(guestPage, /not admission, payment or a booking change/);
  assert.match(guestPage, /Withdraw request/);
  assert.match(managerPage, /Mark reviewed \(not admitted\)/);
});
