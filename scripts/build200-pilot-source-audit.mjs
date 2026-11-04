import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

import {
  BUILD200_JOURNEYS,
  build200ReviewPacket,
} from "../lib/pilot/build200-pilot.mjs";

const root = new URL("../", import.meta.url);
const checks = [];
for (const journey of BUILD200_JOURNEYS) {
  const sources = [
    ...journey.routes.map((route) => `app${route}/page.tsx`),
    ...journey.tests.map((file) => `tests/${file}`),
  ];
  for (const path of sources) {
    const url = new URL(path, root);
    if (!existsSync(url)) throw new Error(`Missing Build 200 source: ${path}`);
    checks.push({
      journey: journey.id,
      path,
      sha256: createHash("sha256").update(readFileSync(url)).digest("hex"),
    });
  }
}
const packet = await build200ReviewPacket();
console.log(
  JSON.stringify(
    {
      build: 200,
      evidence_type: "SOURCE_FILE_AND_TEST_PRESENCE_ONLY",
      checks,
      source_coverage: "PASS",
      owner_acceptance: packet.owner_go_live_decision,
      authenticated_comms_connection: packet.omnichannel_connection,
      no_external_requests_or_writes: true,
    },
    null,
    2,
  ),
);
