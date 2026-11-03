import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { getCampgroundFinanceCloseSource } from "@/lib/finance-close/postgres.mjs";

export const dynamic = "force-dynamic";
const uuid =
  /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function csvCell(value: string | number | null) {
  const input = String(value ?? "");
  const safe =
    /^[\s]*[=+@-]/u.test(input) && typeof value === "string"
      ? `'${input}`
      : input;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff")
    return new Response("Staff sign-in required.", {
      status: 401,
      headers: noStore,
    });
  const url = new URL(request.url);
  const campgroundId = url.searchParams.get("campground") ?? "";
  const day = url.searchParams.get("day") ?? "";
  if (!uuid.test(campgroundId) || !/^\d{4}-\d{2}-\d{2}$/u.test(day))
    return new Response("Invalid campground or close date.", {
      status: 400,
      headers: noStore,
    });
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campgroundId,
  );
  if (
    !authorization?.permissions.some((item) =>
      ["finance.read", "finance.manage"].includes(item),
    ) ||
    !authorization.permissions.some((item) =>
      ["reservation.read", "reservation.modify"].includes(item),
    )
  )
    return new Response("Not authorized", {
      status: 403,
      headers: noStore,
    });
  try {
    const { source, review } = await getCampgroundFinanceCloseSource({
      userId: session.user.id,
      campgroundId,
      localDate: day,
    });
    const rows: (string | number | null)[][] = [
      [
        "build",
        "campground_id",
        "local_day",
        "timezone",
        "source_at",
        "section",
        "currency",
        "captured_cents",
        "succeeded_refunds_cents",
        "net_recorded_cents",
        "receipt_issued_cents",
        "gross_adjustment_evidence_cents",
        "priority",
        "source_id",
        "reservation_id",
        "finding",
        "truncated",
      ],
      ...review.worksheet.map((item): (string | number | null)[] => [
        "196",
        source.campgroundId,
        review.localDate,
        review.timezone,
        review.generatedAt,
        "worksheet",
        item.currencyCode,
        item.capturedCents,
        item.succeededRefundCents,
        item.netRecordedMovementCents,
        item.issuedReceiptCents,
        item.adjustmentEvidenceCents,
        "",
        "",
        "",
        "",
        String(review.truncated),
      ]),
      ...review.cases.map((item): (string | number | null)[] => [
        "196",
        source.campgroundId,
        review.localDate,
        review.timezone,
        review.generatedAt,
        "exception",
        "",
        "",
        "",
        "",
        "",
        "",
        item.priority,
        item.sourceId,
        item.reservationId,
        item.summary,
        String(review.truncated),
      ]),
    ];
    const body =
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const digest = createHash("sha256").update(body).digest("hex");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="icamp-finance-close-${review.localDate}.csv"`,
        ...noStore,
        "X-ICamp-CSV-SHA256": digest,
      },
    });
  } catch {
    return new Response("Source unavailable or invalid close date.", {
      status: 422,
      headers: noStore,
    });
  }
}
