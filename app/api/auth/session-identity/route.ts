import { getCurrentSession } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import { getPlatformOverview } from "@/lib/platform/postgres.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ signedIn: false }, { headers });
    const assigned =
      session.user.accountType === "staff"
        ? await listAssignedCampgrounds(session.user.id).catch(() => null)
        : [];
    const platform =
      session.user.accountType === "staff" && session.assuranceLevel === "aal2"
        ? Boolean(
            await getPlatformOverview(
              session.user.id,
              session.assuranceLevel,
            ).catch(() => null),
          )
        : false;
    return Response.json(
      {
        signedIn: true,
        username: session.user.username ?? session.user.email,
        accountType: session.user.accountType,
        assurance: session.assuranceLevel,
        platform,
        assigned:
          assigned?.map((item) => ({
            id: item.campgroundId,
            name: item.campgroundName,
            roles: item.roleCodes,
          })) ?? null,
      },
      { headers },
    );
  } catch {
    return Response.json({ unavailable: true }, { status: 503, headers });
  }
}
