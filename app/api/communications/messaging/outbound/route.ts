import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { startOutboundMessage } from "@/lib/messaging/postgres.mjs";
import {
  createMessagingProviderAdapter,
  getMessagingProviderConfig,
} from "@/lib/messaging/provider.mjs";

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
    text?: string;
    mediaAssetIds?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Outbound messaging request is invalid." },
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
        { error: "Outbound messaging request is invalid." },
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
      { error: "Outbound messaging idempotency key is invalid." },
      { status: 400 },
    );
  }

  if (
    typeof body.text !== "string" ||
    body.text.trim().length < 1 ||
    body.text.trim().length > 1600
  ) {
    return NextResponse.json(
      { error: "Outbound message text is invalid." },
      { status: 400 },
    );
  }

  if (
    body.purpose &&
    !["transactional", "operational", "marketing"].includes(body.purpose)
  ) {
    return NextResponse.json(
      { error: "Outbound messaging purpose is invalid." },
      { status: 400 },
    );
  }

  const mediaAssetIds = body.mediaAssetIds ?? [];

  if (
    !Array.isArray(mediaAssetIds) ||
    mediaAssetIds.length > 10 ||
    mediaAssetIds.some((id) => !uuidPattern.test(id))
  ) {
    return NextResponse.json(
      { error: "Outbound MMS media selection is invalid." },
      { status: 400 },
    );
  }

  try {
    const provider = createMessagingProviderAdapter(
      getMessagingProviderConfig(),
    );
    const result = await startOutboundMessage({
      actorUserId: session.user.id,
      organizationId: body.organizationId as string,
      campgroundId: body.campgroundId as string,
      lineId: body.lineId as string,
      destinationEndpointId: body.destinationEndpointId as string,
      purpose:
        (body.purpose as "transactional" | "operational" | "marketing") ??
        "operational",
      idempotencyKey: body.idempotencyKey,
      text: body.text,
      mediaAssetIds,
      provider,
    });

    return NextResponse.json({
      accepted: true,
      duplicate: result.duplicate,
      messageId: result.message.id,
      channel: result.message.channel,
      deliveryState: result.message.deliveryState,
      sandbox: provider.mode === "sandbox",
    });
  } catch (error) {
    const message =
      error instanceof Error && /Not authorized/.test(error.message)
        ? "Not authorized."
        : "Outbound message could not be sent.";

    return NextResponse.json(
      { error: message },
      { status: message === "Not authorized." ? 403 : 503 },
    );
  }
}
