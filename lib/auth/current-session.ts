import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionByToken } from "@/lib/auth/postgres.mjs";
import { getSessionCookieName } from "@/lib/auth/session-cookie";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(getSessionCookieName())?.value;

  if (!rawToken) {
    return null;
  }

  return getSessionByToken(rawToken);
}

export async function requireSignedIn(returnPath = "/") {
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent(returnPath)}`);
  }

  return session;
}

export async function requireStaff(returnPath = "/") {
  const session = await requireSignedIn(returnPath);

  if (session.user.accountType !== "staff") {
    redirect("/auth/not-authorized");
  }

  return session;
}
