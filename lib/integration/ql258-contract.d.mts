export type ProgressState =
  | "NOT_STARTED"
  | "OWNER_REPORTS_IN_PROGRESS_NOT_VERIFIED"
  | "OWNER_REPORTS_DONE_NOT_VERIFIED";
export const STATUS: ProgressState[];
export function defaults(): Record<string, ProgressState>;
export function makeReport(
  input: Record<string, ProgressState>,
): Record<string, unknown>;
