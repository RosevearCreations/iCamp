/** Routes and tests, not assertions that a real guest or device was observed. */
export const BUILD200_JOURNEYS = Object.freeze([
  {
    id: "guest_discovery_booking",
    title: "Guest discovery, quote & booking draft",
    href: "/booking/map",
    routes: [
      "/booking/map",
      "/booking/accommodations/[accommodationId]",
      "/booking/accommodations/[accommodationId]/checkout",
      "/guest/booking-drafts",
    ],
    tests: [
      "build173-public-discovery-comparison.test.mjs",
      "build174-transparent-quote-preview.test.mjs",
      "build175-booking-drafts.test.mjs",
    ],
    manual: "Real guest, live availability and payment provider sign-off",
  },
  {
    id: "guest_arrival_stay",
    title: "Arrival, stay, service & cancellation",
    href: "/guest/hub",
    routes: [
      "/guest/arrival-planner",
      "/guest/hub",
      "/guest/stay",
      "/guest/assistance",
      "/guest/reservation-options",
    ],
    tests: [
      "build177-arrival-planner.test.mjs",
      "build178-my-stay-hub.test.mjs",
      "build179-assistance-conversations.test.mjs",
      "build176-reservation-options.test.mjs",
    ],
    manual: "Real-device arrival, guest permissions and assistance handoff",
  },
  {
    id: "front_desk_turnover",
    title: "Front desk, departure & availability release",
    href: "/workspaces/management/campgrounds/reservations/front-desk",
    routes: [
      "/workspaces/management/campgrounds/reservations/front-desk",
      "/workspaces/maintenance/turnover-release",
      "/workspaces/management/command",
    ],
    tests: [
      "build185-front-desk-workboard.test.mjs",
      "build186-turnover-release.test.mjs",
      "build194-command-layouts.test.mjs",
    ],
    manual: "Staff role, actual housekeeping sign-off and owner observation",
  },
  {
    id: "maintenance_offline",
    title: "Maintenance, staff handoff & offline recovery",
    href: "/workspaces/maintenance/work-orders",
    routes: [
      "/workspaces/maintenance/work-orders",
      "/workspaces/maintenance/offline",
      "/workspaces/maintenance/foreman",
    ],
    tests: [
      "build065-maintenance-work-orders.test.mjs",
      "build189-offline-sync.test.mjs",
      "build190-staff-readiness.test.mjs",
    ],
    manual: "Real tablet offline conflict, foreman and safety acceptance",
  },
  {
    id: "guest_privacy_recovery",
    title: "Privacy request, owner review & recovery",
    href: "/guest/privacy",
    routes: [
      "/guest/privacy",
      "/workspaces/management/campgrounds/privacy",
      "/workspaces/it-analysis/resilience",
    ],
    tests: ["build197-guest-privacy.test.mjs", "build198-resilience.test.mjs"],
    manual: "Identity, retention and independently witnessed recovery proof",
  },
  {
    id: "security_access",
    title: "Visitor access & security incident",
    href: "/workspaces/security/credentials",
    routes: [
      "/workspaces/security/credentials",
      "/workspaces/security/incidents",
    ],
    tests: [
      "build187-security-incidents.test.mjs",
      "build188-access-reconciliation.test.mjs",
    ],
    manual: "Real gate/device denial and authorized security staff sign-off",
  },
  {
    id: "omnichannel_connection",
    title: "Omnichannel consent & Comms Hub integration",
    href: "/integration/comms-hub",
    routes: [
      "/integration/comms-hub",
      "/launch/subscriptions",
      "/pilot/acceptance",
    ],
    tests: [
      "build134-integration-contract-readiness.test.mjs",
      "build199-subscription-sandbox.test.mjs",
    ],
    manual:
      "Independent signed source identity, approved nonproduction tenant and owner TEST window",
  },
]);

export const BUILD200_REVIEW_STATES = Object.freeze([
  "NOT_RUN",
  "BLOCKED",
  "FAILED",
  "PASS_OWNER_REPORTED",
]);

export function build200ReviewRows(reports = {}) {
  const rows = BUILD200_JOURNEYS.map((journey) => {
    const report = reports[journey.id] ?? {};
    const state = BUILD200_REVIEW_STATES.includes(report.state)
      ? report.state
      : "NOT_RUN";
    const sourceRef =
      typeof report.sourceRef === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$/.test(report.sourceRef)
        ? report.sourceRef
        : null;
    return {
      journey: journey.id,
      state,
      source_ref: sourceRef,
      awaiting_independent_review: state === "PASS_OWNER_REPORTED",
      automated_source_present_is_not_owner_acceptance: true,
    };
  });
  const counts = Object.fromEntries(
    BUILD200_REVIEW_STATES.map((state) => [
      state,
      rows.filter((row) => row.state === state).length,
    ]),
  );
  return { rows, counts };
}

export async function build200ReviewPacket(reports = {}) {
  const { rows, counts } = build200ReviewRows(reports);
  const digestBytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ schema: "icamp.build200.pilot.v1", rows }),
    ),
  );
  const sourceDigest = [...new Uint8Array(digestBytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return Object.freeze({
    schema: "icamp.build200.pilot.v1",
    build: 200,
    fixture: "Camp Rosevear",
    source_sha256: sourceDigest,
    rows,
    counts,
    signed_original_comms_hub_source: "MISSING",
    independent_pilot_signoff: "MISSING",
    real_device_acceptance: "MISSING",
    public_launch_authorized: false,
    omnichannel_connection: "DISCONNECTED / HOLD",
    owner_go_live_decision: "NO_GO_PENDING_EVIDENCE",
    external_effects: false,
  });
}
