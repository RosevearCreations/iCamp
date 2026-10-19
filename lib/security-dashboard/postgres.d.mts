import type { SecurityIncidentSignalKind } from "./core.mjs";

export interface SecurityDashboardDevice {
  id: string;
  deviceCode: string;
  displayName: string;
  deviceType: string;
  locationLabel: string | null;
  zoneReference: string | null;
  healthState: string;
  healthObservedAt: string | null;
  isActive: boolean;
  gateState: string;
  gateStateObservedAt: string | null;
}

export interface SecurityDashboardCredential {
  id: string;
  credentialNumber: string;
  credentialType: string;
  subjectKind: string;
  subjectLabel: string;
  validFrom: string | null;
  validUntil: string | null;
}

export interface SecurityDashboardDeniedAccess {
  id: string;
  deviceCode: string;
  deviceName: string;
  deniedReason: string;
  direction: string;
  occurredAt: string | null;
  subjectKinds: string[];
}

export interface SecurityDashboardOverride {
  id: string;
  deviceCode: string;
  deviceName: string;
  command: string;
  reason: string;
  sourceChannel: string;
  requestedAt: string | null;
  outcome: string;
  providerStatus: string | null;
  outcomeOccurredAt: string | null;
}

export interface SecurityDashboardExpiringPass {
  id: string;
  passNumber: string;
  presentationKind: string;
  linkKind: string;
  subjectLabel: string;
  validUntil: string | null;
}

export interface SecurityDashboardIncidentSignal {
  kind: SecurityIncidentSignalKind;
  subject: string;
  detail: string;
  occurredAt: string | null;
}

export interface SecurityAccessDashboard {
  campground: {
    id: string;
    name: string;
    timeZone: string;
  };
  generatedAt: string;
  windows: {
    recentHours: number;
    expiringHours: number;
  };
  summary: {
    deviceCount: number;
    devicesNeedingAttention: number;
    openGateCount: number;
    activeCredentialCount: number;
    deniedAccessRecentCount: number;
    overrideRecentCount: number;
    expiringPassCount: number;
    incidentSignalCount: number;
  };
  devices: SecurityDashboardDevice[];
  activeCredentials: SecurityDashboardCredential[];
  deniedAccess: SecurityDashboardDeniedAccess[];
  overrides: SecurityDashboardOverride[];
  expiringPasses: SecurityDashboardExpiringPass[];
  incidentSignals: SecurityDashboardIncidentSignal[];
}

export function closeSecurityDashboardPoolForTests(): Promise<void>;

export function listSecurityAccessDashboard(input: {
  userId: string;
  campgroundId: string;
  now?: Date | string;
  limit?: number;
}): Promise<SecurityAccessDashboard>;
