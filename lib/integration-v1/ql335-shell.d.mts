export const SHELL_ID: "icamp";
export const CONTRACT: "rosevear.shell.nonproduction.v1";
export const PATHS: readonly string[];
export function verifyICampShellGet(input: {
  method?: string;
  path?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  runtime?: string;
  nowMs?: number;
  trust?: Record<string, unknown>;
  claimNonce?: (input: Record<string, unknown>) => Promise<boolean>;
  signWithSourceKms?: (input: Buffer) => Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown> & { httpStatus: number }>;
