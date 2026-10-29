import { CHECKPOINTS } from "./ql258-checkpoints.mjs";

export const STATUS = ["NOT_STARTED", "OWNER_REPORTS_IN_PROGRESS_NOT_VERIFIED", "OWNER_REPORTS_DONE_NOT_VERIFIED"];
export function defaults() {
  return Object.fromEntries(CHECKPOINTS.map(([id]) => [id, STATUS[0]]));
}
export function makeReport(input) {
  const ids = CHECKPOINTS.map(([id]) => id);
  if (!input || Object.getPrototypeOf(input) !== Object.prototype ||
      Object.keys(input).length !== ids.length ||
      Object.keys(input).some((id) => !ids.includes(id))) {
    throw Error("Unexpected field.");
  }
  const progress = {};
  for (const id of ids) {
    if (!STATUS.includes(input[id])) throw Error("Unexpected value.");
    progress[id] = input[id];
  }
  return {
    schema: "rosevear.ql258.owner-action-intake.v1",
    application: "iCamp",
    progress,
    verified: false,
    owner_test_authorization: "NOT_GIVEN",
    connection: "DISCONNECTED",
    gate: "HOLD",
    pilot_holds: 12,
  };
}
