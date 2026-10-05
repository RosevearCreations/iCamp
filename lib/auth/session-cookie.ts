const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-icamp_session"
    : "icamp_session";
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  } as const;
}

export const sessionMaxAgeSeconds = SESSION_MAX_AGE_SECONDS;
