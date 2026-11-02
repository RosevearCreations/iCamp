export const LAUNCH_CHECKS = Object.freeze([
  ["pilot", "Independent pilot acceptance and defect closure"],
  ["legal", "Published terms, privacy and subscription agreements"],
  ["billing", "Tenant subscription billing provider and cancellation test"],
  ["payments", "Campground payment provider and refunds"],
  ["messages", "Consent-safe notifications, SMS and voice"],
  ["access", "Physical gate/device integration and emergency fallback"],
  ["operations", "Backups, monitoring, support, capacity and recovery"],
]);

export const LAUNCH_STATES = Object.freeze([
  "NOT_VERIFIED",
  "BLOCKED",
  "OWNER_REPORTED_READY",
]);

export function blankLaunch() {
  return Object.fromEntries(LAUNCH_CHECKS.map(([id]) => [id, "NOT_VERIFIED"]));
}

export function launchReport(input) {
  const checks = Object.fromEntries(
    LAUNCH_CHECKS.map(([id]) => [
      id,
      LAUNCH_STATES.includes(input?.[id]) ? input[id] : "NOT_VERIFIED",
    ]),
  );
  return {
    build: 156,
    environment: "READINESS_PREVIEW",
    checks,
    independent_verification: "REQUIRED",
    external_services_enabled: false,
    billing_live: false,
    public_launch_authorized: false,
    integration_connection: "DISCONNECTED",
    integration_gate: "HOLD",
  };
}
