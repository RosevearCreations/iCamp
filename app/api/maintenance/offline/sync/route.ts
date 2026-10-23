import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { syncOfflineMaintenanceOperation } from "@/lib/offline-maintenance/postgres.mjs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Sync failed.";
  if (message.startsWith("OFFLINE_CONFLICT:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_CONFLICT: ", ""), code: "conflict" },
      { status: 409 },
    );
  }
  if (message.startsWith("OFFLINE_FORBIDDEN:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_FORBIDDEN: ", ""), code: "forbidden" },
      { status: 403 },
    );
  }
  if (message.startsWith("OFFLINE_MEDIA_ROUTE:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_MEDIA_ROUTE: ", "") },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "Queued maintenance evidence could not be synchronized." },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return NextResponse.json(
      { error: "Authentication required.", code: "authentication" },
      { status: 401 },
    );
  }

  try {
    const payload = await request.json();
    const result = await syncOfflineMaintenanceOperation({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      operation: payload,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
