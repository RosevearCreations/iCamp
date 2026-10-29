import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { beginTotpEnrollment } from "@/lib/auth/mfa-postgres.mjs";
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
  if (Number(request.headers.get("content-length") ?? "0") > 2048) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  try {
    const input = (await request.json()) as { password?: unknown };
    const password = typeof input.password === "string" ? input.password : "";
    if (password.length < 12 || password.length > 128) {
      return NextResponse.json(
        { error: "Password verification failed." },
        { status: 403 },
      );
    }
    const result = await beginTotpEnrollment({
      userId: session.user.id,
      sessionId: session.sessionId,
      username: session.user.username ?? session.user.email,
      password,
    });
    if (!result) {
      return NextResponse.json(
        { error: "Password verification failed." },
        { status: 403 },
      );
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Authenticator enrollment unavailable or already completed." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
