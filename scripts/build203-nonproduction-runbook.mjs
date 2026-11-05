import {
  build203Runbook,
  build203ReviewReadback,
} from "../lib/pilot/build203-custody.mjs";

const report = build203ReviewReadback();
const instructions = build203Runbook(report);
if (
  instructions.connection_state !== "DISCONNECTED / HOLD" ||
  instructions.authorizeHandshake ||
  instructions.liveCallsOrMessages ||
  instructions.steps.length !== 6 ||
  instructions.steps.some((step) => step.status !== "MANUAL_EVIDENCE_REQUIRED")
)
  throw new Error("BUILD203_UNSAFE_RUNBOOK_STATE");
process.stdout.write(`${JSON.stringify(instructions, null, 2)}\n`);
