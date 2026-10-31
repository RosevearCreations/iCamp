import { getCurrentSession } from "@/lib/auth/current-session";
import { hasAnyCampgroundPermission } from "@/lib/authz/postgres.mjs";
import { STANDARD_OWNER_INTAKE_VERSION } from "@/lib/command-centre/standard-theme-owner-intake-core.mjs";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const session = await getCurrentSession();
  if (
    !session ||
    session.user.accountType !== "staff" ||
    !(await hasAnyCampgroundPermission(session.user.id, "reports.read"))
  ) {
    return Response.json(
      { error: "Authorized staff review access required." },
      { status: 403, headers },
    );
  }
  return Response.json(
    {
      version: STANDARD_OWNER_INTAKE_VERSION,
      scope: "assigned_campground_reports_read",
      mode: "read_only_contract",
      submissionEnabled: false,
      authoritativeDecisionLedgerEnabled: false,
      requiresDistinctAuthenticatedOwner: true,
      requiresSourceVersionAndFreshRetest: true,
      supportedReadbackClaims: ["pending", "rejected", "recheck", "approved"],
      importedClaimsTrusted: false,
      billing: "HELD",
      omnichannel: "DISCONNECTED_HOLD",
    },
    { status: 200, headers },
  );
}
