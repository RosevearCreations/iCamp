import assert from "node:assert/strict";
import test from "node:test";
import { STANDARD_THEME, SEMANTIC_STATUS } from "../lib/theme/standard.mjs";

test("the first theme is Standard and all status meanings remain immutable", () => {
  assert.equal(STANDARD_THEME.id, "standard");
  assert.equal(STANDARD_THEME.version, 1);
  assert.match(STANDARD_THEME.background, /^\/themes\/standard\//);
  for (const [key, value] of Object.entries(SEMANTIC_STATUS)) {
    assert.match(key, /^(operational|pending|critical|information|disabled)$/);
    assert.match(value, /^#[a-fA-F0-9]{6}$/);
  }
  assert.equal(Object.isFrozen(SEMANTIC_STATUS), true);
  assert.equal("operational" in STANDARD_THEME.tokens, false);
});
