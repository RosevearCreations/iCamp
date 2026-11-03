import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getOwnGuestProfileDetail } from "@/lib/guest-profile/postgres.mjs";
import { buildOwnPrivacyExport } from "@/lib/guest-privacy/core.mjs";
import {
  listOwnGuestPrivacy,
  listOwnPrivacyExportRecords,
  recordOwnPrivacyExportReceipt,
} from "@/lib/guest-privacy/postgres.mjs";

export const dynamic = "force-dynamic";
const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
};
const uuid =
  /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "guest")
    return new Response("Guest sign-in required.", {
      status: 401,
      headers: noStore,
    });
  const campgroundId =
    new URL(request.url).searchParams.get("campground") ?? "";
  if (!uuid.test(campgroundId))
    return new Response("Invalid campground.", {
      status: 400,
      headers: noStore,
    });
  try {
    const [privacy, detail, records] = await Promise.all([
      listOwnGuestPrivacy({ userId: session.user.id, campgroundId }),
      getOwnGuestProfileDetail({ userId: session.user.id, campgroundId }),
      listOwnPrivacyExportRecords({ userId: session.user.id, campgroundId }),
    ]);
    // The private export always represents exactly one guest and campground.
    const { bytes, sha256 } = buildOwnPrivacyExport({
      campgroundId,
      campgroundName: records.campgroundName,
      exportedAt: new Date().toISOString(),
      detail,
      privacy,
      records,
    });
    await recordOwnPrivacyExportReceipt({
      userId: session.user.id,
      campgroundId,
      sha256,
      incomplete: privacy.truncated || records.truncated,
    });
    return new Response(bytes.toString("utf8"), {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="icamp-my-privacy-${campgroundId.slice(0, 8)}.json"`,
        "X-ICamp-Export-SHA256": sha256,
      },
    });
  } catch {
    return new Response(
      "This guest has no verified access to the selected campground, or its data is unavailable.",
      {
        status: 403,
        headers: noStore,
      },
    );
  }
}
