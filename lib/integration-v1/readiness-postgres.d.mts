export function recordReadinessHandshake(data: {
  issuer: string;
  keyId: string;
  nonce: string;
  tenantId: string;
  timestamp: string;
  path: string;
  allowed: boolean;
}): Promise<boolean>;
