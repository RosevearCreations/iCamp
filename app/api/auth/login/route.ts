import { NextRequest, NextResponse } from "next/server";

import { authenticatePassword, createSession } from "@/lib/auth/postgres.mjs";
import {
  isSameOriginMutation,
  safeReturnPath,
} from "@/lib/auth/request-security";
import {
  getSessionCookieName,
  getSessionCookieOptions,
  sessionMaxAgeSeconds,
} from "@/lib/auth/session-cookie";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const returnPath = safeReturnPath(formData.get("next"));

  const user = await authenticatePassword({ email, password });

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/auth/login?error=credentials&next=${encodeURIComponent(returnPath)}`,
        request.url,
      ),
      303,
    );
  }

  const session = await createSession({
    userId: user.id,
    assuranceLevel: "aal1",
    expiresInSeconds: sessionMaxAgeSeconds,
  });

  const response = NextResponse.redirect(new URL(returnPath, request.url), 303);
  response.cookies.set(
    getSessionCookieName(),
    session.token,
    getSessionCookieOptions(),
  );

  return response;
}
