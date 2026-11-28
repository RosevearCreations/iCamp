import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesWorkspace288,
  workspaceKind288,
  workspaceSignIn288,
} from "../lib/build288/workspace.mjs";

test("Build 288 distinguishes account entry paths without granting access", () => {
  assert.equal(workspaceKind288("/sysop/accounts"), "platform");
  assert.equal(
    workspaceKind288("/campground?campground=example"),
    "campground",
  );
  assert.equal(workspaceKind288("/guest/hub"), "guest");
  assert.equal(workspaceKind288("/sysop-fake"), "general");
  assert.equal(workspaceKind288("//evil.example/sysop"), "general");
  assert.equal(matchesWorkspace288("platform", "guest"), false);
  assert.equal(matchesWorkspace288("guest", "staff"), false);
  assert.equal(matchesWorkspace288("campground", "staff"), true);
  assert.equal(matchesWorkspace288("platform", "staff"), true);
});

test("Build 288 account switch permits only fixed local login destinations", () => {
  assert.equal(workspaceSignIn288("platform"), "/auth/login?next=%2Fsysop");
  assert.equal(
    workspaceSignIn288("campground"),
    "/auth/login?next=%2Fcampground",
  );
  assert.equal(workspaceSignIn288("guest"), "/auth/login?next=%2Fguest%2Fhub");
  assert.equal(workspaceSignIn288("//evil.example"), null);
});
