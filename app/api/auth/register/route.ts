import { NextRequest, NextResponse } from "next/server";

import { createGuestAccount } from "@/lib/auth/postgres.mjs";
import { isSameOriginMutation } from "@/lib/auth/request-security";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await createGuestAccount({ email, password });
  } catch {
    return NextResponse.redirect(
      new URL("/auth/register?status=review", request.url),
      303,
    );
  }

  return NextResponse.redirect(
    new URL("/auth/login?status=created", request.url),
    303,
  );
}
