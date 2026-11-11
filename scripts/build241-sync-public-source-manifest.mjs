/** Build-time public discovery metadata only. Never signs a receipt or enrolls a key.
 * Vercel Git integration provides the exact SHA of the commit being deployed;
 * an absent/invalid production SHA must STOP release rather than publish a stale pin.
 */
import { readFile, writeFile } from "node:fs/promises";

const path = new URL(
  "../public/.well-known/rosevear-integration-manifest.json",
  import.meta.url,
);
const sha = String(process.env.VERCEL_GIT_COMMIT_SHA ?? "").trim();
const environment = process.env.VERCEL_ENV;
const valid = /^[0-9a-f]{40}$/.test(sha);

if (environment === "production" && !valid) {
  throw new Error(
    "Production source manifest needs an exact Vercel Git commit SHA.",
  );
}

if (valid && (environment === "production" || environment === "preview")) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (
    manifest.source_id !== "icamp" ||
    manifest.tenant_boundary !== "platform_shell"
  ) {
    throw new Error("iCamp manifest shell identity changed. Release stopped.");
  }
  if (
    manifest.signature?.key_id !== null ||
    manifest.signature?.value !== null ||
    manifest.connection_state !== "DISCONNECTED / HOLD"
  ) {
    throw new Error(
      "Unexpected signer or connection assertion in discovery manifest.",
    );
  }
  manifest.source_revision = sha;
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o644,
  });
  process.stdout.write(
    `iCamp public manifest prepared for Git revision ${sha.slice(0, 12)} (signer HOLD).\n`,
  );
} else {
  process.stdout.write(
    "iCamp source manifest retains committed baseline (non-deployment build).\n",
  );
}
