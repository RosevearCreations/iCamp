export function configuredSources275(): string[];
export function handshakeSummary275(): Promise<{
  status: string;
  schemaReady: boolean;
  receipts: { source: string; observedAt: string }[];
}>;
export function acceptHandshake275(
  body: string,
  signature: string | null,
): Promise<{ accepted: boolean; status: string }>;
