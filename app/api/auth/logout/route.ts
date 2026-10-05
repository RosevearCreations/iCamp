import { NextRequest, NextResponse } from "next/server";

import { revokeSessionByToken } from "@/lib/auth/postgres.mjs";
import { isSameOriginMutation } from "@/lib/auth/request-security";
import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth/session-cookie";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const rawToken = request.cookies.get(getSessionCookieName())?.value;

  if (rawToken) {
    await revokeSessionByToken(rawToken, "logout");
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(getSessionCookieName(), "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
