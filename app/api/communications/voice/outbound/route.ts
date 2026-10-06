import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { startOutboundVoiceCall } from "@/lib/voice/postgres.mjs";
import {
  createVoiceProviderAdapter,
  getVoiceProviderConfig,
} from "@/lib/voice/provider.mjs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.user.accountType !== "staff") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let body: {
    organizationId?: string;
    campgroundId?: string;
    lineId?: string;
    destinationEndpointId?: string;
    purpose?: string;
    idempotencyKey?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Outbound voice request is invalid." },
      { status: 400 },
    );
  }

  for (const value of [
    body.organizationId,
    body.campgroundId,
    body.lineId,
    body.destinationEndpointId,
  ]) {
    if (!value || !uuidPattern.test(value)) {
      return NextResponse.json(
        { error: "Outbound voice request is invalid." },
        { status: 400 },
      );
    }
  }

  if (
    !body.idempotencyKey ||
    body.idempotencyKey.length < 8 ||
    body.idempotencyKey.length > 200
  ) {
    return NextResponse.json(
      { error: "Outbound voice idempotency key is invalid." },
      { status: 400 },
    );
  }

  if (
    body.purpose &&
    !["transactional", "operational", "marketing"].includes(body.purpose)
  ) {
    return NextResponse.json(
      { error: "Outbound voice purpose is invalid." },
      { status: 400 },
    );
  }

  try {
    const provider = createVoiceProviderAdapter(getVoiceProviderConfig());
    const call = await startOutboundVoiceCall({
      actorUserId: session.user.id,
      organizationId: body.organizationId,
      campgroundId: body.campgroundId,
      lineId: body.lineId,
      destinationEndpointId: body.destinationEndpointId,
      purpose:
        (body.purpose as "transactional" | "operational" | "marketing") ??
        "operational",
      idempotencyKey: body.idempotencyKey,
      provider,
    });

    return NextResponse.json({
      accepted: true,
      callId: call.id,
      callState: call.callState,
      sandbox: provider.mode === "sandbox",
    });
  } catch (error) {
    const message =
      error instanceof Error && /Not authorized/.test(error.message)
        ? "Not authorized."
        : "Outbound voice call could not be started.";

    return NextResponse.json(
      { error: message },
      { status: message === "Not authorized." ? 403 : 503 },
    );
  }
}
