import { NextResponse } from "next/server";

import { ingestPaymentProviderEvent } from "@/lib/payments/postgres.mjs";
import {
  createPaymentProviderAdapter,
  getPaymentProviderConfig,
  verifyPaymentWebhookSignature,
} from "@/lib/payments/provider.mjs";

export async function POST(request: Request) {
  const config = getPaymentProviderConfig();

  if (!config.webhookSecret) {
    return NextResponse.json(
      { error: "Payment webhook verification is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-icamp-payment-timestamp");
  const signature = request.headers.get("x-icamp-payment-signature");

  const verified = verifyPaymentWebhookSignature({
    rawBody,
    timestamp: timestamp ?? "",
    signature,
    secret: config.webhookSecret,
    toleranceSeconds: config.webhookToleranceSeconds,
  });

  if (!verified) {
    return NextResponse.json(
      { error: "Payment webhook signature is invalid." },
      { status: 401 },
    );
  }

  const provider = createPaymentProviderAdapter(config);
  let event;

  try {
    event = provider.normalizeWebhook(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Payment provider event is invalid." },
      { status: 400 },
    );
  }

  if (event.providerKey !== config.provider) {
    return NextResponse.json(
      { error: "Payment provider event does not match configuration." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestPaymentProviderEvent(event);
    return NextResponse.json({
      accepted: true,
      duplicate: result.duplicate,
      paymentId: result.payment?.id ?? null,
      paymentState: result.payment?.state ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Payment provider event could not be processed." },
      { status: 503 },
    );
  }
}
