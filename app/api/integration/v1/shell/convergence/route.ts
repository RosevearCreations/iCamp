import manifest from "@/public/.well-known/rosevear-integration-manifest.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHA = /^[a-f0-9]{40}$/u;

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.search || url.hash) {
    return new Response(null, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const actual = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const valid = actual !== null && SHA.test(actual);
  const revisionState =
    valid &&
    actual === manifest.source_revision &&
    manifest.tenant_boundary === "platform_shell"
      ? "LOCAL_BUILD_REVISION_MATCH"
      : "SOURCE_REVISION_STALE_OR_UNAVAILABLE";
  return Response.json(
    {
      schema: "rosevear.ai-data.master363.icamp-source-convergence.v1",
      sourceId: "icamp",
      repository: "RosevearCreations/iCamp",
      sourceRole: "platform_shell",
      sourceRevision: valid ? actual : null,
      manifestRevision: manifest.source_revision,
      revisionEvidence:
        "DEPLOYMENT_SELF_REPORT_REQUIRES_INDEPENDENT_GITHUB_VERCEL_CHECK",
      revisionState,
      sourceSignerState: "AWAITING_INDEPENDENT_SOURCE_SIGNER",
      independentlyVerifiedPin: false,
      signedHealthReceipt: "HOLD_NO_ORIGINAL_SOURCE_SIGNER",
      durableReplayProof: "HOLD_NOT_PROVISIONED",
      tenantBoundary: "PLATFORM_SHELL_ONLY_NO_CAMPGROUND_DATA",
      connected: false,
      ownerAccepted: false,
      connectionState: "DISCONNECTED / HOLD",
      master: "ai-data-platform",
      communicationsPlane: "rosevear-comms-hub",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
