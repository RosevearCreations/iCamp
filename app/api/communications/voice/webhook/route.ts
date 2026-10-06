import { NextResponse } from "next/server";

import {
  ingestVoiceProviderEvent,
} from "@/lib/voice/postgres.mjs";
import {
  createVoiceProviderAdapter,
  getVoiceProviderConfig,
  verifyVoiceWebhookSignature,
} from "@/lib/voice/provider.mjs";

export async function POST(request: Request) {
  const config = getVoiceProviderConfig();

  if (!config.webhookSecret) {
    return NextResponse.json(
      { error: "Voice webhook verification is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-icamp-voice-timestamp");
  const signature = request.headers.get("x-icamp-voice-signature");

  const verified = verifyVoiceWebhookSignature({
    rawBody,
    timestamp: timestamp ?? "",
    signature,
    secret: config.webhookSecret,
    toleranceSeconds: config.webhookToleranceSeconds,
  });

  if (!verified) {
    return NextResponse.json(
      { error: "Voice webhook signature is invalid." },
      { status: 401 },
    );
  }

  const provider = createVoiceProviderAdapter(config);
  let event;

  try {
    event = provider.normalizeWebhook(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Voice provider event is invalid." },
      { status: 400 },
    );
  }

  if (event.providerKey !== config.provider) {
    return NextResponse.json(
      { error: "Voice provider event does not match configuration." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestVoiceProviderEvent(event);

    return NextResponse.json({
      accepted: true,
      duplicate: result.duplicate,
      callId: result.call?.id ?? null,
      sessionId: result.sessionId,
      nextAction:
        result.call?.direction === "inbound" &&
        !["completed", "failed"].includes(result.call.callState)
          ? "prompt.main"
          : "acknowledge",
    });
  } catch {
    return NextResponse.json(
      { error: "Voice provider event could not be processed." },
      { status: 503 },
    );
  }
}
