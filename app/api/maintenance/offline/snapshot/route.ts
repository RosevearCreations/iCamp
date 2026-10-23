import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getOfflineMaintenanceWorkspace } from "@/lib/offline-maintenance/postgres.mjs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Snapshot failed.";
  if (message.startsWith("OFFLINE_FORBIDDEN:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_FORBIDDEN: ", "") },
      { status: 403 },
    );
  }
  if (message.startsWith("OFFLINE_NOT_FOUND:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_NOT_FOUND: ", "") },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: "Offline maintenance snapshot is temporarily unavailable." },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const campgroundId = new URL(request.url).searchParams.get("campground") ?? "";
  if (!uuidPattern.test(campgroundId)) {
    return NextResponse.json(
      { error: "A valid campground is required." },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getOfflineMaintenanceWorkspace(
      session.user.id,
      campgroundId,
    );
    return NextResponse.json({ snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}
