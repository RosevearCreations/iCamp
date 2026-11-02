export const INTEGRATION_CONTRACT_VERSION: string;
export type ReadinessConfig = {
  enabled: boolean;
  keyId: string;
  secret: Buffer;
  tenantId: string;
  environment: string;
  applicationVersion: string;
};
export function loadIntegrationReadinessConfig(
  env?: Record<string, string | undefined>,
): ReadinessConfig;
export function canonicalReadinessSignature(data: {
  path: string;
  timestamp: string;
  nonce: string;
  tenantId: string;
  keyId: string;
}): string;
export function verifySignedReadiness(
  headers: Headers,
  path: string,
  config: ReadinessConfig,
  now?: Date,
):
  | { ok: false; httpStatus: number; code: string }
  | {
      ok: true;
      issuer: string;
      destination: string;
      business: string;
      environment: string;
      keyId: string;
      tenantId: string;
      nonce: string;
      timestamp: string;
      allowed: boolean;
    };
