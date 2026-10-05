import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { signedIn: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      signedIn: true,
      session: {
        assuranceLevel: session.assuranceLevel,
        expiresAt: session.expiresAt,
      },
      user: {
        email: session.user.email,
        accountType: session.user.accountType,
        emailVerified: Boolean(session.user.emailVerifiedAt),
        mfaRequired: session.user.mfaRequired,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
