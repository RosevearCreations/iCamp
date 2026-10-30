import { runPublicSmoke } from "../lib/launch/build157-smoke.mjs";

const [origin, expectedSha = ""] = process.argv.slice(2);
if (!origin || !/^[0-9a-f]{40}$/.test(expectedSha)) {
  console.error(
    "Usage: node scripts/build157-production-smoke.mjs https://i-camp-pi.vercel.app <40-character-main-sha>",
  );
  process.exitCode = 2;
} else {
  try {
    const result = await runPublicSmoke(origin, fetch, expectedSha);
    console.log(JSON.stringify(result, null, 2));
    if (result.public_smoke !== "PASSED") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Smoke failed.");
    process.exitCode = 1;
  }
}
