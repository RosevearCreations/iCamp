export const REGISTRY_SCHEMA: "rosevear.seven-app-identity-registry.v1";
export const ENVELOPE_SCHEMA: "rosevear.seven-app-source-envelope.v1";
export const SECURITY_TIERS: readonly string[];
export const APPLICATIONS: readonly {
  id: string;
  repository: string;
  model: string;
  parent: string | null;
  tenantScoped: boolean;
}[];
export const EVENT_TYPES: readonly string[];
export const ROLE_PERMISSION_MATRIX: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;
export function validateRegistryAgainstTopology(topology: {
  schema?: string;
  self?: { appId?: string };
  validationAuthority?: { appId?: string };
  applications?: Array<{
    appId: string;
    repository: string;
    connectionModel: string;
    externalShell: boolean;
  }>;
  rules?: {
    masterApplications?: number;
    governedExternalShellApplications?: number;
    directMasterApplications?: number;
    authorityTransfer?: boolean;
  };
}): { status: string; valid: boolean };
export function validateSourceEnvelope(
  envelope: Record<string, unknown> | null,
  options?: { asOf?: string },
): {
  valid: boolean;
  status: string;
  sourceOnly?: true;
  cryptographicallyAuthenticated?: false;
  receiverConnected?: false;
  ownerAcceptance?: "HOLD";
};
export function evaluateRoleScope(input: {
  principal: {
    appId: string;
    principalId: string;
    role: string;
    tenantId?: string | null;
    mfaAssurance?: string;
  };
  request: {
    targetAppId: string;
    permission: string;
    tenantId: string | null;
    tier: string;
  };
}): {
  allowed: false;
  status: string;
  requiresOriginalSourceProof?: true;
  requiresIndependentOwnerReview?: true;
  receiverConnected?: false;
};
export function assessPinLifecycle(input: {
  appId: string;
  pins: Array<{
    appId: string;
    fingerprintSha256: string;
    notBefore: string;
    notAfter: string;
    sourceRevision: string;
    custodianAttested: boolean;
    revoked?: boolean;
  }>;
  asOf: string;
}): {
  status: string;
  eligible: false;
  daysUntilEarliestExpiry?: number;
  pinCount?: number;
  autoRotate?: false;
  receiverConnected?: false;
  ownerAcceptance?: "HOLD";
};
export function getRegistrySummary(): {
  schema: string;
  identityCount: number;
  tierCount: number;
  ownerOrder: string[];
  sourceOnly: true;
  externalConnected: false;
  ownerAcceptance: "HOLD";
  rotationAuthority: string;
};
