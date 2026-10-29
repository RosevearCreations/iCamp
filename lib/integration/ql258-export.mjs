import { CHECKPOINTS } from "./ql258-checkpoints.mjs";

export function sanitizedReturn(values) {
  const ids = CHECKPOINTS.map(([id]) => id);
  if (Object.keys(values).length !== ids.length) {
    throw new Error("Invalid owner progress.");
  }
  const progress = {};
  for (const id of ids) {
    if (!["NOT_STARTED", "OWNER_REPORTS_IN_PROGRESS_NOT_VERIFIED", "OWNER_REPORTS_DONE_NOT_VERIFIED"].includes(values[id])) {
      throw new Error("Invalid progress status.");
    }
    progress[id] = values[id];
  }
  return { application: "iCamp", progress, connection: "DISCONNECTED" };
}
