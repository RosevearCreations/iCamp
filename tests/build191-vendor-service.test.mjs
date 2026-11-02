import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  assessVendorContract,
  assessVendorRecurring,
  assessVendorRequest,
  normalizeVendorContract,
  normalizeVendorEvent,
  normalizeVendorProfile,
  normalizeVendorRecurring,
  normalizeVendorRequest,
  vendorDate,
} from "../lib/vendors/core.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const id = (n) => `00000191-0000-4000-8000-${String(n).padStart(12, "0")}`;
const vendor = {
  id: id(1),
  displayName: "Septic & Drainage Service",
  serviceCategory: "septic",
  contactName: "Review Contact",
  contactEmail: "test@example.invalid",
  contactPhone: "555-010-1981",
  privateNote:
    "Qualified source reviewed internally without supplier transmission.",
};
const contract = {
  id: id(2),
  vendorId: id(1),
  supersedesContractId: null,
  contractReference: "vendor-contract-191",
  title: "On-site septic maintenance",
  validFrom: "2027-01-01",
  expiresOn: "2027-12-31",
  responseTargetHours: 24,
  completionTargetDays: 7,
  documentMediaId: null,
  privateNote:
    "Review the source contract without assuming it is legally signed.",
};
const request = {
  id: id(3),
  vendorId: id(1),
  contractId: id(2),
  recurringPlanId: null,
  workOrderId: null,
  title: "Inspect septic service",
  requestDescription:
    "Scheduled review for the septic line after owner approval.",
  responseTargetHours: 24,
  completionTargetDays: 7,
};
test("Build191 validates restricted vendor details and source references", () => {
  assert.deepEqual(normalizeVendorProfile(vendor), vendor);
  assert.throws(
    () => normalizeVendorProfile({ ...vendor, serviceCategory: "billing" }),
    /category is invalid/,
  );
  assert.throws(
    () => normalizeVendorProfile({ ...vendor, contactEmail: "unverified" }),
    /email is invalid/,
  );
  assert.deepEqual(normalizeVendorContract(contract), contract);
  assert.throws(
    () => normalizeVendorContract({ ...contract, expiresOn: "2026-01-01" }),
    /expiry must follow/,
  );
  assert.equal(vendorDate("2027-02-28", "Contract"), "2027-02-28");
  assert.throws(() => vendorDate("2027-02-30", "Contract"), /valid date/);
});
test("Build191 recurring plans and request targets are bounded and opt-in", () => {
  assert.deepEqual(
    normalizeVendorRecurring({
      id: id(4),
      vendorId: id(1),
      contractId: id(2),
      supersedesPlanId: null,
      serviceLabel: "Quarterly septic review",
      cadenceDays: 90,
      nextDueOn: "2027-03-01",
      privateNote: "Internal reminder only; no dispatch.",
    }),
    {
      id: id(4),
      vendorId: id(1),
      contractId: id(2),
      supersedesPlanId: null,
      serviceLabel: "Quarterly septic review",
      cadenceDays: 90,
      nextDueOn: "2027-03-01",
      privateNote: "Internal reminder only; no dispatch.",
    },
  );
  assert.throws(
    () =>
      normalizeVendorRecurring({
        id: id(4),
        vendorId: id(1),
        serviceLabel: "Septic review",
        cadenceDays: 0,
        nextDueOn: "2027-03-01",
        privateNote: "Internal reminder only; no dispatch.",
      }),
    /Cadence days/,
  );
  assert.deepEqual(normalizeVendorRequest(request), request);
  assert.throws(
    () => normalizeVendorRequest({ ...request, responseTargetHours: 169 }),
    /Response hours/,
  );
});
test("Build191 source and independent invoice review evidence is explicit", () => {
  const invoice = normalizeVendorEvent({
    id: id(5),
    requestId: id(3),
    kind: "invoice_intake",
    sourceReference: "external-invoice-191",
    note: "Invoice received for finance reconciliation only.",
  });
  assert.equal(invoice.reviewsEventId, null);
  assert.throws(
    () => normalizeVendorEvent({ ...invoice, sourceReference: null }),
    /External source or invoice reference/,
  );
  const receipt = normalizeVendorEvent({
    id: id(6),
    requestId: id(3),
    kind: "invoice_reviewed",
    reviewsEventId: id(5),
    note: "I independently checked the incoming invoice source.",
  });
  assert.equal(receipt.reviewsEventId, id(5));
  assert.throws(
    () => normalizeVendorEvent({ ...receipt, reviewsEventId: null }),
    /Invoice intake ID/,
  );
});
test("Build191 workboard flags SLA overdue, contract expiry and recurring due dates from actual timestamps", () => {
  const now = new Date("2027-04-08T12:00:00Z");
  const pending = {
    ...request,
    responseDueAt: "2027-04-07T12:00:00Z",
    completionDueAt: "2027-04-09T12:00:00Z",
  };
  const flags = assessVendorRequest(pending, [], now);
  assert.deepEqual(flags.flags, ["response_overdue"]);
  assert.equal(flags.status, "awaiting_response");
  const events = [
    {
      id: id(5),
      requestId: id(3),
      kind: "invoice_intake",
      recordedAt: "2027-04-07T11:00:00Z",
    },
    {
      id: id(6),
      requestId: id(3),
      kind: "invoice_reviewed",
      reviewsEventId: id(5),
      recordedAt: "2027-04-08T11:00:00Z",
    },
    {
      id: id(7),
      requestId: id(3),
      kind: "response",
      recordedAt: "2027-04-08T11:30:00Z",
    },
  ];
  const ready = assessVendorRequest(pending, events, now);
  assert.equal(ready.pendingInvoices, 0);
  assert.equal(ready.hasResponse, true);
  const withMissingReview = assessVendorRequest(
    pending,
    events.slice(0, 1),
    now,
  );
  assert.ok(withMissingReview.flags.includes("invoice_intake_unreviewed"));
  assert.equal(
    assessVendorContract(
      { ...contract, expiresOn: "2027-04-20" },
      [contract],
      now,
    ).flag,
    "expires_soon",
  );
  assert.equal(
    assessVendorContract(
      { ...contract, expiresOn: "2027-03-20" },
      [contract],
      now,
    ).flag,
    "expired",
  );
  assert.equal(
    assessVendorRecurring({ id: id(4), nextDueOn: "2027-04-01" }, [], now).flag,
    "due_overdue",
  );
});
test("Build191 SQL constrains scope, immutable confidential sources, review actors and held operations", () => {
  const migration = read(
    "../database/migrations/0203_build191_vendor_service_evidence.sql",
  );
  const verifier = read(
    "../database/verify/0203_build191_vendor_service_evidence.sql",
  );
  const indexes = read(
    "../database/migrations/0204_build191_vendor_fk_indexes.sql",
  );
  const service = read("../lib/vendors/postgres.mjs");
  const page = read(
    "../app/workspaces/management/campgrounds/vendors/page.tsx",
  );
  const lifecycle = read("../scripts/verify-build191-vendor-service.mjs");
  assert.match(migration, /force row level security/);
  assert.match(migration, /vendor\.invoice\.review/);
  assert.match(migration, /guard_vendor_media_retention/);
  assert.match(migration, /review_of_event_id|reviews_event_id/);
  assert.match(
    migration,
    /new\.response_target_hours:=contract_row\.response_target_hours/,
  );
  assert.match(migration, /contract.*source|confidential PDF/i);
  assert.doesNotMatch(migration, /grant[^;]*update[^;]*vendor_service/i);
  assert.match(verifier, /relforcerowsecurity/);
  assert.match(indexes, /organization_id,campground_id,supersedes_contract_id/);
  assert.match(indexes, /organization_id,campground_id,supersedes_plan_id/);
  assert.match(service, /set local role icamp_app/);
  assert.match(service, /appendAuditEvent/);
  assert.match(page, /Billing and\s+Omnichannel remain HELD/);
  assert.match(
    page,
    /Nothing was sent to a supplier|nothing contacts a vendor|no outgoing purchase orders/i,
  );
  assert.match(lifecycle, /Cross-campground leakage/);
  assert.match(lifecycle, /rollback/);
});
