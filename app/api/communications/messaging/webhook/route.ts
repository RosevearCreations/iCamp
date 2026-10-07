import { NextResponse } from "next/server";

import { ingestMessagingProviderEvent } from "@/lib/messaging/postgres.mjs";
import {
  createMessagingProviderAdapter,
  getMessagingProviderConfig,
  verifyMessagingWebhookSignature,
} from "@/lib/messaging/provider.mjs";

export async function POST(request: Request) {
  const config = getMessagingProviderConfig();

  if (!config.webhookSecret) {
    return NextResponse.json(
      { error: "Messaging webhook verification is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-icamp-messaging-timestamp");
  const signature = request.headers.get("x-icamp-messaging-signature");

  const verified = verifyMessagingWebhookSignature({
    rawBody,
    timestamp: timestamp ?? "",
    signature,
    secret: config.webhookSecret,
    toleranceSeconds: config.webhookToleranceSeconds,
  });

  if (!verified) {
    return NextResponse.json(
      { error: "Messaging webhook signature is invalid." },
      { status: 401 },
    );
  }

  const provider = createMessagingProviderAdapter(config);
  let event;

  try {
    event = provider.normalizeWebhook(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Messaging provider event is invalid." },
      { status: 400 },
    );
  }

  if (event.providerKey !== config.provider) {
    return NextResponse.json(
      { error: "Messaging provider event does not match configuration." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestMessagingProviderEvent(event);
    const command = result.command;
    const nextAction = !command
      ? "acknowledge"
      : command.validation.state === "verification_required"
        ? "verify.identity"
        : command.validation.accepted
          ? command.validation.action
          : "prompt.help";

    return NextResponse.json({
      accepted: true,
      duplicate: result.duplicate,
      messageId: result.message?.id ?? null,
      deliveryState: result.message?.deliveryState ?? null,
      command: command
        ? {
            kind: command.kind,
            source: command.source,
            state: command.validation.state,
          }
        : null,
      nextAction,
    });
  } catch {
    return NextResponse.json(
      { error: "Messaging provider event could not be processed." },
      { status: 503 },
    );
  }
}
