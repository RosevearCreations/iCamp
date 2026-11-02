import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getOfflineMaintenanceSyncAudit } from "@/lib/offline-maintenance/postgres.mjs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  const campgroundId =
    new URL(request.url).searchParams.get("campground") ?? "";
  if (!uuidPattern.test(campgroundId)) {
    return NextResponse.json(
      { error: "A valid campground is required." },
      { status: 400 },
    );
  }
  try {
    const audit = await getOfflineMaintenanceSyncAudit(
      session.user.id,
      campgroundId,
    );
    return NextResponse.json(
      { audit },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("OFFLINE_FORBIDDEN:")
    ) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Sync audit temporarily unavailable." },
      { status: 503 },
    );
  }
}
