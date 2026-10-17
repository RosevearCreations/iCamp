import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertVisitorContactRequirement,
  effectiveVisitorStatus,
  normalizeVisitorPolicyInput,
  normalizeVisitorRegistrationInput,
} from "../lib/visitor-registration/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0070_visitor_registration_site_specific_limits.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0070_visitor_registration_site_specific_limits.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/visitor-registration/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/visitors/page.tsx",
  import.meta.url,
);
const helpUrl = new URL("../lib/help/topics.ts", import.meta.url);
const parityUrl = new URL("../lib/parity/core.mjs", import.meta.url);
const vehiclePageUrl = new URL(
  "../app/workspaces/management/campgrounds/vehicles/page.tsx",
  import.meta.url,
);

test("Build 055 normalizes visitor policy and visit validity", () => {
  const policy = normalizeVisitorPolicyInput({
    dayVisitChargeId: "day-charge",
    weekVisitChargeId: "",
    identityVerificationMode: "staff_visual",
    contactRequirement: "both",
    visitorRule: "Visitors must stay with the registered host.",
  });

  assert.equal(policy.dayVisitChargeId, "day-charge");
  assert.equal(policy.weekVisitChargeId, null);
  assert.equal(policy.identityVerificationMode, "staff_visual");
  assert.equal(policy.contactRequirement, "both");

  const visit = normalizeVisitorRegistrationInput({
    reservationId: "reservation-1",
    visitorName: "Jamie Visitor",
    contactPhone: "519-555-0123",
    contactEmail: "jamie@example.com",
    identityVerified: "on",
    visitKind: "day",
    validFromLocal: "2027-07-01T08:00",
    validUntilLocal: "2027-07-01T20:00",
  });

  assert.equal(visit.identityVerified, true);
  assert.equal(visit.visitKind, "day");

  assert.throws(
    () =>
      normalizeVisitorRegistrationInput({
        ...visit,
        visitKind: "day",
        validFromLocal: "2027-07-01T08:00",
        validUntilLocal: "2027-07-02T09:00",
      }),
    /cannot exceed 24 hours/iu,
  );

  assert.throws(
    () =>
      normalizeVisitorRegistrationInput({
        ...visit,
        visitKind: "week",
        validFromLocal: "2027-07-01T08:00",
        validUntilLocal: "2027-07-08T09:00",
      }),
    /cannot exceed 7 days/iu,
  );
});

test("Build 055 enforces configured contact requirements", () => {
  assert.doesNotThrow(() =>
    assertVisitorContactRequirement("either", {
      contactPhone: "519-555-0100",
      contactEmail: null,
    }),
  );

  assert.throws(
    () =>
      assertVisitorContactRequirement("both", {
        contactPhone: "519-555-0100",
        contactEmail: null,
      }),
    /phone and email are both required/iu,
  );

  assert.throws(
    () =>
      assertVisitorContactRequirement("phone", {
        contactPhone: null,
        contactEmail: "visitor@example.com",
      }),
    /phone is required/iu,
  );
});

test("Build 055 computes effective visitor registration status", () => {
  assert.equal(
    effectiveVisitorStatus({
      registrationStatus: "active",
      validFrom: "2027-07-01T14:00:00Z",
      validUntil: "2027-07-01T22:00:00Z",
      now: "2027-07-01T13:00:00Z",
    }),
    "scheduled",
  );
  assert.equal(
    effectiveVisitorStatus({
      registrationStatus: "active",
      validFrom: "2027-07-01T14:00:00Z",
      validUntil: "2027-07-01T22:00:00Z",
      now: "2027-07-01T23:00:00Z",
    }),
    "expired",
  );
  assert.equal(
    effectiveVisitorStatus({
      registrationStatus: "pending_payment",
      validFrom: "2027-07-01T14:00:00Z",
      validUntil: "2027-07-01T22:00:00Z",
      now: "2027-07-01T16:00:00Z",
    }),
    "pending_payment",
  );
});

test("Build 055 schema resolves site limits and preserves payment/privacy boundaries", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.campground_visitor_policies/u);
  assert.match(sql, /create table public\.visitor_registrations/u);
  assert.match(sql, /create table public\.visitor_registration_events/u);
  assert.match(sql, /create table public\.visitor_registration_payments/u);
  assert.match(
    sql,
    /create table icamp_private\.visitor_registration_payment_provider_events/u,
  );
  assert.match(sql, /resolve_visitor_limit/u);
  assert.match(sql, /scope_weight/u);
  assert.match(sql, /icamp-visitor-capacity/u);
  assert.match(
    sql,
    /would exceed the effective site-specific visitor limit/u,
  );
  assert.match(sql, /booking_charge_catalog/u);
  assert.match(sql, /visitor\.register/u);
  assert.match(sql, /payment state is trusted-server managed/u);
  assert.match(sql, /Government ID numbers\/images are not stored/u);
  assert.match(sql, /Build 056\+/u);
  assert.match(sql, /Build 060/u);
  assert.match(sql, /force row level security/u);
});

test("Build 055 verification protects visitor evidence and direct roles", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(
    sql,
    /visitor registration payments must remain trusted-server write only/u,
  );
  assert.match(sql, /visitor registration events must remain append-only/u);
  assert.match(sql, /visitor registration provider events must remain private/u);
  assert.match(sql, /site-specific visitor limit resolver is missing/u);
  assert.match(sql, /visitor overlap\/capacity lookup index is missing/u);
  assert.match(sql, /visitor registrar must be able to resolve Build 033/u);
  assert.match(sql, /visitor registrar must be able to read canonical Build 040/u);
  assert.match(sql, /security template must receive visitor\.register/u);
  assert.match(sql, /campground manager template must receive visitor\.register/u);
  assert.match(
    sql,
    /anon direct visitor-registration access must remain denied/u,
  );
  assert.match(
    sql,
    /authenticated direct visitor-registration access must remain denied/u,
  );
});

test("Build 055 service serializes capacity, uses canonical fees and activates after capture", async () => {
  const source = await readFile(serviceUrl, "utf8");

  assert.match(source, /visitor\.register/u);
  assert.match(source, /payment\.capture/u);
  assert.match(source, /booking_charge_catalog/u);
  assert.match(source, /resolve_visitor_limit/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /visitor-registration:/u);
  assert.match(source, /pending_payment/u);
  assert.match(source, /payment_captured/u);
  assert.match(source, /provider\.createPayment/u);
  assert.match(source, /provider\.capturePayment/u);
  assert.match(
    source,
    /visitor_registration_payment_provider_events/u,
  );
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /governmentIdNumberStored: false/u);
  assert.match(source, /credentialBoundary: "Build 056\/062\/063"/u);
  assert.match(source, /accessRuleBoundary: "Build 060"/u);
});

test("Build 055 exposes visitor desk, help, parity and cross-navigation", async () => {
  const [page, help, parity, vehiclePage] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(helpUrl, "utf8"),
    readFile(parityUrl, "utf8"),
    readFile(vehiclePageUrl, "utf8"),
  ]);

  assert.match(page, /Visitor Registration & Site-Specific Limits/u);
  assert.match(page, /helpTopic="visitor\.registration"/u);
  assert.match(page, /Build 033/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /Build 056/u);
  assert.match(page, /Build 062/u);
  assert.match(page, /Build 063/u);
  assert.match(page, /Build 060/u);
  assert.match(help, /"visitor\.registration"/u);
  assert.match(parity, /id: "visitor\.register"/u);
  assert.match(
    parity,
    /secureLinkPurpose: "visitor-registration-payment"/u,
  );
  assert.match(vehiclePage, /Open Visitor Registration & Limits/u);
});
