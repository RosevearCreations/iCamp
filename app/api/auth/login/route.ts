import { NextRequest, NextResponse } from "next/server";

import {
  authenticatePassword,
  createSession,
  revokeSessionByToken,
} from "@/lib/auth/postgres.mjs";
import { matchesWorkspace288, workspaceKind288 } from "@/lib/build288/workspace.mjs";
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

  if (!matchesWorkspace288(workspaceKind288(returnPath), user.accountType)) {
    return NextResponse.redirect(
      new URL(
        `/auth/login?error=workspace&next=${encodeURIComponent(returnPath)}`,
        request.url,
      ),
      303,
    );
  }

  // Replacing the browser's account also retires its old server session.
  // Failed credentials and wrong-workspace attempts leave that session intact.
  const previous = request.cookies.get(getSessionCookieName())?.value;
  if (previous) await revokeSessionByToken(previous, "account-switch");

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
