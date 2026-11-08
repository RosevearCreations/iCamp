import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { getPlatformOverview } from "@/lib/platform/postgres.mjs";

/** Owner access never confers a campground assignment or tenant read rights. */
export async function requireSysop(returnPath: "/sysop" | "/platform") {
  const session = await requireStaff(returnPath);
  if (session.assuranceLevel !== "aal2") {
    redirect(`/auth/mfa?next=${encodeURIComponent(returnPath)}`);
  }
  const summary = await getPlatformOverview(
    session.user.id,
    session.assuranceLevel,
  );
  if (!summary) redirect("/auth/not-authorized");
  return { session, summary };
}
