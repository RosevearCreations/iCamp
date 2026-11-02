import { NextResponse, type NextRequest } from "next/server";

import { createRequestId } from "@/lib/observability/request-id";

export function proxy(request: NextRequest) {
  const requestId = createRequestId();
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-icamp-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-icamp-request-id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons/|favicon.ico|sw.js|manifest.webmanifest).*)",
  ],
};
