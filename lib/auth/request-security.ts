import { NextRequest } from "next/server";

export function isSameOriginMutation(request: NextRequest): boolean {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

export function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(value, "https://icamp.invalid");

    if (parsed.origin !== "https://icamp.invalid") {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
