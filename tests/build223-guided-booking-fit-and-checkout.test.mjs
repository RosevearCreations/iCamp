import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { accommodationFitHighlights } from "../lib/public-accommodation-detail/fit-summary.mjs";

test("Build 223 campsite fit highlights use only published source facts", () => {
  const facts = accommodationFitHighlights({
    kind: "campsite",
    facts: [
      { label: "Site type", value: "RV" },
      { label: "Maximum RV length", value: "9.5 m" },
      { label: "Accessible site", value: "No" },
    ],
    rules: [{ label: "Pets", value: "Allowed · up to 2 pets" }],
  });
  assert.deepEqual(
    facts.map((fact) => fact.label),
    [
      "Site type",
      "Maximum RV length",
      "Electrical",
      "Water",
      "Accessible site",
      "Pets",
    ],
  );
  assert.equal(
    facts.find((fact) => fact.label === "Maximum RV length")?.value,
    "9.5 m",
  );
  assert.equal(
    facts.find((fact) => fact.label === "Accessible site")?.value,
    "No",
  );
  assert.equal(
    facts.find((fact) => fact.label === "Electrical")?.stated,
    false,
  );
  assert.match(
    facts.find((fact) => fact.label === "Electrical")?.value ?? "",
    /Not published/,
  );
});

test("Build 223 cottage features never invent accessibility or occupancy", () => {
  const facts = accommodationFitHighlights({
    kind: "rental_cottage",
    facts: [
      { label: "Maximum sleeping occupancy", value: "6" },
      { label: "Step-free access", value: "Not supplied" },
      { label: "Accessible washroom", value: "No" },
    ],
    rules: [],
  });
  assert.equal(
    facts.find((fact) => fact.label === "Maximum sleeping occupancy")?.value,
    "6",
  );
  assert.equal(
    facts.find((fact) => fact.label === "Step-free access")?.stated,
    false,
  );
  assert.equal(
    facts.find((fact) => fact.label === "Accessible washroom")?.value,
    "No",
  );
  assert.equal(facts.find((fact) => fact.label === "Pets")?.stated, false);
  assert.throws(
    () => accommodationFitHighlights({ kind: "private_unit" }),
    /Unsupported/,
  );
});

test("Build 223 preserves a semantic accessible booking journey across all four stages", async () => {
  const component = await readFile("components/booking-journey.tsx", "utf8");
  const map = await readFile("app/booking/map/page.tsx", "utf8");
  const detail = await readFile(
    "app/booking/accommodations/[accommodationId]/page.tsx",
    "utf8",
  );
  const checkout = await readFile(
    "app/booking/accommodations/[accommodationId]/checkout/page.tsx",
    "utf8",
  );
  const pending = await readFile(
    "app/booking/reservations/[reservationId]/pending/page.tsx",
    "utf8",
  );

  assert.match(component, /aria-label="Booking progress"/);
  assert.match(component, /aria-current=\{index === activeIndex \? "step"/);
  assert.match(component, /index < activeIndex/);
  assert.match(map, /current="discover"/);
  assert.match(detail, /current="review"/);
  assert.match(checkout, /current="checkout"/);
  assert.match(pending, /current="reservation"/);
  assert.match(detail, /Final compatibility and/);
  assert.match(checkout, /CheckoutSectionLinks/);
  for (const section of [
    "checkout-contact",
    "checkout-party",
    "checkout-compatibility",
    "checkout-addons",
    "checkout-rules",
  ])
    assert.match(component, new RegExp(section));
});

test("Build 223 keeps live authorization and server-priced checkout gates", async () => {
  const checkout = await readFile(
    "app/booking/accommodations/[accommodationId]/checkout/page.tsx",
    "utf8",
  );
  const action = await readFile(
    "app/booking/accommodations/[accommodationId]/checkout/actions.ts",
    "utf8",
  );
  const detail = await readFile(
    "app/booking/accommodations/[accommodationId]/page.tsx",
    "utf8",
  );
  assert.match(checkout, /requireSignedIn\(returnPath\)/);
  assert.match(checkout, /getReservationCheckout\(/);
  assert.match(
    checkout,
    /disabled=\{!rateAvailable \|\| !checkout\.dateRules\.eligible\}/,
  );
  assert.match(checkout, /finalizeReservationCheckoutAction/);
  assert.match(action, /revalidat|finalize/i);
  assert.match(detail, /getPublicAccommodationDetail\(/);
  assert.match(detail, /startReservationCheckoutAction/);
});
