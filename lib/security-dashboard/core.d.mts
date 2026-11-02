export const SECURITY_DASHBOARD_EXPIRY_HOURS: number;
export const SECURITY_DASHBOARD_RECENT_HOURS: number;

export type SecurityIncidentSignalKind =
  "device_fault" | "denied_access" | "override_failure";

export function normalizeSecurityDashboardLimit(
  value: unknown,
  fallback?: number,
): number;

export function securityDeviceNeedsAttention(
  healthState: unknown,
  isActive?: boolean,
): boolean;

export function normalizeIncidentSignalKind(
  value: unknown,
): SecurityIncidentSignalKind;

export function incidentSignalLabel(
  kind: SecurityIncidentSignalKind | string,
): string;
