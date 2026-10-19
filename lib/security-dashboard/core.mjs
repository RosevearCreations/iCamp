export const SECURITY_DASHBOARD_EXPIRY_HOURS = 48;
export const SECURITY_DASHBOARD_RECENT_HOURS = 24;

const INCIDENT_SIGNAL_KINDS = new Set([
  "device_fault",
  "denied_access",
  "override_failure",
]);

export function normalizeSecurityDashboardLimit(value, fallback = 10) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(50, Math.max(1, parsed));
}

export function securityDeviceNeedsAttention(healthState, isActive = true) {
  if (!isActive) return false;
  return !["healthy", "retired"].includes(String(healthState ?? "unknown"));
}

export function normalizeIncidentSignalKind(value) {
  const kind = String(value ?? "").trim();
  if (!INCIDENT_SIGNAL_KINDS.has(kind)) {
    throw new Error("Unsupported security incident signal kind.");
  }
  return kind;
}

export function incidentSignalLabel(kind) {
  switch (normalizeIncidentSignalKind(kind)) {
    case "device_fault":
      return "Device fault";
    case "denied_access":
      return "Denied access";
    case "override_failure":
      return "Override failure";
  }
}
