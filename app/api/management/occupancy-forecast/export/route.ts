import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import {
  buildForwardOccupancyForecast,
  forwardOccupancyCsv,
} from "@/lib/command-centre/forward-occupancy-core.mjs";
import { getCampgroundForwardOccupancySource } from "@/lib/command-centre/forward-occupancy-postgres.mjs";

export const dynamic = "force-dynamic";
const uuid =
  /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return new Response("Staff sign-in required.", {
      status: 401,
      headers: noStore,
    });
  }
  const params = request.nextUrl.searchParams;
  const campgroundId = params.get("campground") ?? "";
  const horizon = Number(params.get("horizon") ?? "3");
  const scenario = params.get("planning") ?? "typical";
  if (
    !uuid.test(campgroundId) ||
    ![1, 2, 3].includes(horizon) ||
    !["low", "typical", "high"].includes(scenario)
  ) {
    return new Response("Invalid export selection.", {
      status: 400,
      headers: noStore,
    });
  }
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campgroundId,
  );
  if (
    !["reports.read", "reservation.read", "accommodation.read"].every(
      (permission) => authorization?.permissions.includes(permission),
    )
  ) {
    return new Response("Not authorized for this campground.", {
      status: 403,
      headers: noStore,
    });
  }
  try {
    const source = await getCampgroundForwardOccupancySource({
      userId: session.user.id,
      campgroundId,
    });
    const report = buildForwardOccupancyForecast(source, {
      horizon: horizon as 1 | 2 | 3,
      scenario: scenario as "low" | "typical" | "high",
    });
    const csv = forwardOccupancyCsv(report, campgroundId);
    const sha256 = createHash("sha256").update(csv, "utf8").digest("hex");
    return new Response(csv, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="icamp-occupancy-forecast-${report.asOfLocalDate}.csv"`,
        "X-iCamp-Export-SHA256": sha256,
        "X-iCamp-Source-Generated-At": report.generatedAt,
      },
    });
  } catch {
    return new Response(
      "Verified forecast source is temporarily unavailable.",
      {
        status: 503,
        headers: noStore,
      },
    );
  }
}
