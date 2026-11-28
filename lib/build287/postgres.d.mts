import type { ActiveSession } from "../auth/postgres.mjs";
import type { AccountEvidence287 } from "./core.mjs";

export function inspectOwnAccount287(
  session: ActiveSession,
): Promise<AccountEvidence287 & { status: string }>;
