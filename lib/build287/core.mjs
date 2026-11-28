/** Only boolean evidence leaves the runtime; no host or credential values. */
export function databasePin287(connectionString, expectedHost) {
  if (!connectionString || !expectedHost?.trim()) return "unconfigured";
  try {
    const actual = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(actual.protocol))
      return "mismatch";
    return actual.hostname.toLowerCase() === expectedHost.trim().toLowerCase()
      ? "matches"
      : "mismatch";
  } catch {
    return "unconfigured";
  }
}

export function assessAccount287(evidence) {
  if (!evidence.sessionEligible) return "HOLD_FRESH_MFA";
  if (!evidence.querySucceeded) return "HOLD_DIAGNOSTIC_UNAVAILABLE";
  if (!evidence.sessionVerified) return "HOLD_FRESH_MFA";
  if (evidence.hostPin !== "matches") return "HOLD_DATABASE_TARGET";
  if (!evidence.ownerBindingTable || !evidence.migrationLedger)
    return "HOLD_DATABASE_RECONCILIATION";
  if (!evidence.mfaVerified || !evidence.mfaRequired) return "HOLD_MFA_POLICY";
  if (!evidence.grantActive) return "HOLD_PLATFORM_GRANT";
  if (!evidence.bindingVerified) return "HOLD_INDEPENDENT_OWNER_REVIEW";
  return "SELF_ACCESS_PREREQUISITES_PRESENT";
}
