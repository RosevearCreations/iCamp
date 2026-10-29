import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { verifyTotpForSession } from "@/lib/auth/mfa-postgres.mjs";
import { isSameOriginMutation } from "@/lib/auth/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? "0") > 512) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  try {
    const input = (await request.json()) as { code?: unknown };
    const code = typeof input.code === "string" ? input.code : "";
    const verified = await verifyTotpForSession({
      userId: session.user.id,
      sessionId: session.sessionId,
      code,
    });
    if (!verified) {
      return NextResponse.json(
        { error: "Code not accepted or temporarily locked." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { verified: true, assuranceLevel: "aal2" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "MFA verification is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
