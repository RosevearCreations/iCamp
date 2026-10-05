import { NextRequest, NextResponse } from "next/server";

import { issuePasswordRecovery } from "@/lib/auth/postgres.mjs";
import { noOpRecoveryDelivery } from "@/lib/auth/recovery-delivery";
import { isSameOriginMutation } from "@/lib/auth/request-security";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const recovery = await issuePasswordRecovery({ email });

  if (recovery) {
    await noOpRecoveryDelivery.deliverPasswordRecovery({
      email: recovery.email,
      token: recovery.token,
    });
  }

  return NextResponse.redirect(
    new URL("/auth/recover?status=requested", request.url),
    303,
  );
}
