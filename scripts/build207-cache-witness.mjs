import { appendFile, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function cacheState(value) {
  if (value === "true") return "HIT";
  if (value === "false") return "MISS";
  return "UNVERIFIED";
}

export function buildCacheRecord({
  lane,
  npmHit,
  browserHit,
  lockSha256,
  browserExecutableVerified = false,
}) {
  if (!["verify", "browser", "database"].includes(lane)) {
    throw new Error("UNRECOGNIZED_CI_LANE");
  }
  if (!/^[a-f0-9]{64}$/.test(lockSha256)) {
    throw new Error("LOCKFILE_DIGEST_REQUIRED");
  }
  const browser = lane === "browser";
  if (browser && !browserExecutableVerified) {
    throw new Error("CHROMIUM_EXECUTABLE_NOT_VERIFIED");
  }
  return {
    schema: "icamp.build207.cache-witness.v1",
    lane,
    npmCache: cacheState(npmHit),
    browserCache: browser ? cacheState(browserHit) : "NOT_APPLICABLE",
    lockSha256,
    cleanInstallRequired: true,
    chromiumInstalled: browser ? browserExecutableVerified : null,
    cacheHitIsNotReleaseApproval: true,
  };
}

export function formatCacheSummary(record) {
  return [
    `### Build 207 — ${record.lane} cache witness`,
    "",
    `- npm tarball cache: **${record.npmCache}** (reported by setup-node).`,
    `- Chromium browser cache: **${record.browserCache}** (reported by actions/cache).`,
    `- SHA-256 of reviewed package-lock.json: \`${record.lockSha256}\`.`,
    `- Chromium executable verified after mandatory installation: **${record.chromiumInstalled === null ? "N/A" : record.chromiumInstalled}**.`,
    "- All checks still run in every job. A cache hit is not a release authorization.",
    "",
  ].join("\n");
}

async function main() {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const lock = await readFile(resolve(root, "package-lock.json"));
  const lockSha256 = createHash("sha256").update(lock).digest("hex");
  const browser = process.argv.includes("--browser");
  let browserExecutableVerified = false;
  if (browser) {
    // Resolve the version-locked executable via the actual Playwright dependency;
    // a restored cache alone is never enough to satisfy this preflight.
    const { chromium } = await import("@playwright/test");
    const executable = chromium.executablePath();
    const file = await stat(executable);
    browserExecutableVerified = file.isFile() && file.size > 0;
  }
  const record = buildCacheRecord({
    lane: process.env.ICAMP_CI_LANE,
    npmHit: process.env.ICAMP_NPM_CACHE_HIT,
    browserHit: process.env.ICAMP_BROWSER_CACHE_HIT,
    lockSha256,
    browserExecutableVerified,
  });
  const summary = formatCacheSummary(record);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  console.log(JSON.stringify(record));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error("Build 207 cache witness failed:", error.message);
    process.exitCode = 1;
  });
}
