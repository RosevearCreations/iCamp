import { NextRequest, NextResponse } from "next/server";

import { resetPasswordWithToken } from "@/lib/auth/postgres.mjs";
import { isSameOriginMutation } from "@/lib/auth/request-security";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("password") ?? "");

  try {
    const reset = await resetPasswordWithToken({ token, newPassword });

    if (!reset) {
      return NextResponse.redirect(
        new URL("/auth/reset?status=invalid", request.url),
        303,
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/auth/reset?status=invalid", request.url),
      303,
    );
  }

  return NextResponse.redirect(
    new URL("/auth/login?status=reset", request.url),
    303,
  );
}
