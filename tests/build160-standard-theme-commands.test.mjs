import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { STANDARD_THEME, SEMANTIC_STATUS } from "../lib/theme/standard.mjs";

const source = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

test("Build 160 retains Standard as the canonical grass/meadow theme and semantic status colours", () => {
  assert.equal(STANDARD_THEME.id, "standard");
  assert.match(STANDARD_THEME.background, /^\/themes\/standard\//);
  assert.equal(STANDARD_THEME.tokens.accent, "#b6f177");
  assert.ok(SEMANTIC_STATUS.operational !== SEMANTIC_STATUS.pending);
  assert.ok(SEMANTIC_STATUS.critical !== SEMANTIC_STATUS.information);
  assert.match(source("app/standard-theme.css"), /\.standard-command__metrics/);
  assert.match(source("app/standard-theme.css"), /\.agreement-stage-grid/);
  assert.match(source("app/standard-theme.css"), /@media \(max-width: 48rem\)/);
});

test("Build 160 Management/I.T. commands preserve permission gates, real-only stats and service HOLD", () => {
  const workspace = source("app/workspaces/[workspace]/page.tsx");
  const command = source("components/standard-ops-command.tsx");
  const platform = source("app/platform/page.tsx");
  const theme = source("app/settings/themes/page.tsx");
  const itPage = source("app/workspaces/it-analysis/page.tsx");
  assert.match(workspace, /requireAnyCampgroundPermission/);
  assert.match(workspace, /<StandardOpsCommand area=/);
  assert.match(command, /getSafeItSnapshot/);
  assert.match(command, /runSandboxLifecycleFixture/);
  assert.match(command, /DISCONNECTED/);
  assert.match(command, /OFF \/ HELD/);
  assert.match(platform, /requireStaff/);
  assert.match(platform, /getPlatformOverview/);
  assert.match(platform, /summary\.active_users/);
  assert.match(theme, /requireAnyCampgroundPermission/);
  assert.match(theme, /Future release/);
  assert.match(itPage, /<StandardOpsCommand area="it-analysis"/);
  assert.match(itPage, /queueHealth\.jobs\.queued/);
  assert.match(itPage, /communicationsHealth\.providers\.events24h/);
});
