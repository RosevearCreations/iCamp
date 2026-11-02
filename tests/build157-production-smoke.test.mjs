import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_SMOKE_PATHS,
  runPublicSmoke,
  validatedSmokeOrigin,
} from "../lib/launch/build157-smoke.mjs";

const origin = "https://i-camp-pi.vercel.app";
const sha = "a".repeat(40);

test("production smoke permits only exact approved iCamp HTTPS origins", () => {
  assert.equal(validatedSmokeOrigin(origin), origin);
  for (const value of [
    "http://i-camp-pi.vercel.app",
    "https://evil.example",
    "https://i-camp-pi.vercel.app.evil.example",
    "https://i-camp-pi.vercel.app/payload",
    "https://user:password@i-camp-pi.vercel.app",
  ]) {
    assert.throws(() => validatedSmokeOrigin(value));
  }
});

test("all smoke requests are anonymous GET with no redirects or cookies", async () => {
  const seen = [];
  const fetcher = async (url, options) => {
    seen.push({ pathname: url.pathname, options });
    const json = url.pathname.endsWith("/health")
      ? { status: "operational", service: "iCamp" }
      : { version: "0.1.0", buildSha: sha };
    const text = url.pathname.includes("/api/")
      ? JSON.stringify(json)
      : url.pathname.includes("/status")
        ? "iCamp system status"
        : url.pathname.includes("/launch/")
          ? "Launch, tenant billing and connections"
          : "Comms Hub connection";
    return { status: 200, text: async () => text };
  };
  const report = await runPublicSmoke(origin, fetcher, sha);
  assert.equal(report.public_smoke, "PASSED");
  assert.equal(seen.length, PUBLIC_SMOKE_PATHS.length);
  assert.ok(
    seen.every(
      ({ options }) =>
        options.method === "GET" &&
        options.credentials === "omit" &&
        options.redirect === "manual",
    ),
  );
  assert.equal(report.billing_provider_verified, false);
  assert.equal(report.integration_gate, "HOLD");
});

test("blocked gateway, mismatched commit and redirected pages cannot pass", async () => {
  const fetcher = async (url) => ({
    status: url.pathname === "/api/version" ? 200 : 302,
    text: async () =>
      JSON.stringify({ version: "0.1.0", buildSha: "b".repeat(40) }),
  });
  const report = await runPublicSmoke(origin, fetcher, sha);
  assert.equal(report.public_smoke, "NOT_PASSED");
  assert.equal(
    report.checks.find((item) => item.check === "version").result,
    "WRONG_COMMIT",
  );
  assert.equal(report.operational_launch_authorized, false);
});
