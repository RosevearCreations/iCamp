import { NextRequest, NextResponse } from "next/server";

import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/auth/crypto.mjs";
import { createGuestAccount } from "@/lib/auth/postgres.mjs";
import { isSameOriginMutation } from "@/lib/auth/request-security";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordValidation = validatePassword(password);

  if (!validateEmail(email) || !passwordValidation.ok) {
    return NextResponse.redirect(
      new URL("/auth/register?status=invalid", request.url),
      303,
    );
  }

  try {
    await createGuestAccount({ email, password });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code !== "23505") {
      throw error;
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?status=registration", request.url),
    303,
  );
}
