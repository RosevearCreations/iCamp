import { buildFinancialCloseReview, localDay } from "../finance-close/core.mjs";

function finding(kind, priority, reservationId, sourceId, detail) {
  return { kind, priority, reservationId, sourceId, detail };
}

function money(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2_000_000_000;
}

export function buildReconciliation259({
  source,
  invoices = [],
  schedules = [],
  invoiceRowsTruncated = false,
  scheduleRowsTruncated = false,
}) {
  if (
    !source ||
    !Array.isArray(source.payments) ||
    !Array.isArray(source.refunds)
  ) {
    throw new Error("Verified local finance sources are required.");
  }
  const financeReview = buildFinancialCloseReview(source);
  const scheduleByReservation = new Map();
  const invoiceByReservation = new Map();
  const findings = [];
  const touchedReservations = new Set();

  for (const schedule of schedules) {
    if (scheduleByReservation.has(schedule.reservationId)) {
      findings.push(
        finding(
          "schedule",
          "critical",
          schedule.reservationId,
          schedule.id,
          "More than one payment schedule was returned.",
        ),
      );
    }
    scheduleByReservation.set(schedule.reservationId, schedule);
  }
  for (const invoice of invoices) {
    if (invoiceByReservation.has(invoice.reservationId)) {
      findings.push(
        finding(
          "invoice",
          "critical",
          invoice.reservationId,
          invoice.id,
          "More than one invoice was returned for a reservation.",
        ),
      );
    }
    invoiceByReservation.set(invoice.reservationId, invoice);
    const schedule = scheduleByReservation.get(invoice.reservationId);
    if (!schedule) {
      findings.push(
        finding(
          "invoice",
          "attention",
          invoice.reservationId,
          invoice.id,
          "Invoice cannot be compared with an original payment schedule.",
        ),
      );
    } else if (
      !money(invoice.totalPayableCents) ||
      invoice.currencyCode !== schedule.currencyCode ||
      invoice.totalPayableCents !== schedule.totalPayableCents ||
      invoice.reservationAmountCents + invoice.securityDepositCents !==
        invoice.totalPayableCents
    ) {
      findings.push(
        finding(
          "invoice",
          "critical",
          invoice.reservationId,
          invoice.id,
          "Invoice currency or amount differs from the original schedule.",
        ),
      );
    }
  }

  const capturedByReservation = new Map();
  for (const payment of source.payments) {
    touchedReservations.add(payment.reservationId);
    if (payment.state !== "captured") continue;
    const existing = capturedByReservation.get(payment.reservationId) ?? 0;
    capturedByReservation.set(
      payment.reservationId,
      existing + payment.amountCents,
    );
    if (!invoiceByReservation.has(payment.reservationId)) {
      findings.push(
        finding(
          "invoice",
          "attention",
          payment.reservationId,
          payment.id,
          "Captured payment has no invoice in the available evidence window.",
        ),
      );
    }
  }
  for (const refund of source.refunds)
    touchedReservations.add(refund.reservationId);

  const deposits = [...touchedReservations].sort().map((reservationId) => {
    const schedule = scheduleByReservation.get(reservationId);
    const capturedInWindowCents = capturedByReservation.get(reservationId) ?? 0;
    if (!schedule) {
      findings.push(
        finding(
          "deposit",
          "attention",
          reservationId,
          reservationId,
          "Original deposit schedule is missing from this review.",
        ),
      );
      return {
        reservationId,
        depositDueCents: null,
        capturedInWindowCents,
        state: "source_missing",
      };
    }
    if (
      !money(schedule.bookingDepositCents) ||
      !money(schedule.totalPayableCents)
    ) {
      findings.push(
        finding(
          "deposit",
          "critical",
          reservationId,
          schedule.id,
          "Original deposit or payable amount is invalid.",
        ),
      );
    } else if (capturedInWindowCents < schedule.bookingDepositCents) {
      findings.push(
        finding(
          "deposit",
          "attention",
          reservationId,
          schedule.id,
          "Captured evidence in the review window is below the scheduled booking deposit; check older payments before following up.",
        ),
      );
    } else if (capturedInWindowCents > schedule.totalPayableCents) {
      findings.push(
        finding(
          "payment",
          "critical",
          reservationId,
          schedule.id,
          "Captured evidence exceeds the schedule total; investigate duplicate capture.",
        ),
      );
    }
    return {
      reservationId,
      depositDueCents: schedule.bookingDepositCents,
      capturedInWindowCents,
      state:
        capturedInWindowCents < schedule.bookingDepositCents
          ? "requires_review"
          : "covered_in_window_not_allocated",
    };
  });

  const invoiceIssuedByCurrency = new Map();
  for (const invoice of invoices) {
    if (localDay(invoice.issuedAt, source.timezone) !== source.localDate)
      continue;
    invoiceIssuedByCurrency.set(
      invoice.currencyCode,
      (invoiceIssuedByCurrency.get(invoice.currencyCode) ?? 0) +
        invoice.totalPayableCents,
    );
  }
  const currencyCodes = [
    ...new Set([
      ...financeReview.worksheet.map((row) => row.currencyCode),
      ...invoiceIssuedByCurrency.keys(),
    ]),
  ].sort();
  const accountingExpected = currencyCodes.map((currencyCode) => {
    const row = financeReview.worksheet.find(
      (item) => item.currencyCode === currencyCode,
    );
    return {
      currencyCode,
      netRecordedCents: row?.netRecordedMovementCents ?? 0,
      invoicesIssuedCents: invoiceIssuedByCurrency.get(currencyCode) ?? 0,
      succeededRefundsCents: row?.succeededRefundCents ?? 0,
    };
  });
  for (const item of financeReview.cases) {
    findings.push(
      finding(
        item.type,
        item.priority,
        item.reservationId,
        item.sourceId,
        item.summary,
      ),
    );
  }
  const incomplete =
    financeReview.truncated || invoiceRowsTruncated || scheduleRowsTruncated;
  findings.sort(
    (a, b) =>
      Number(b.priority === "critical") - Number(a.priority === "critical"),
  );
  return {
    generatedAt: source.generatedAt,
    localDate: source.localDate,
    timezone: source.timezone,
    incomplete,
    internalReviewStatus: incomplete
      ? "HOLD_INCOMPLETE_SOURCE"
      : findings.length
        ? "REVIEW_EXCEPTIONS"
        : "SOURCE_CHECKS_CLEAR",
    providerSettlementStatus: "HOLD_INDEPENDENT_STATEMENT_REQUIRED",
    accountingCloseStatus: "HOLD_ACCOUNTING_EXPORT_AND_APPROVAL_REQUIRED",
    findings,
    deposits,
    accountingExpected,
    sourceCounts: {
      payments: source.payments.length,
      refunds: source.refunds.length,
      invoices: invoices.length,
      schedules: schedules.length,
    },
    disclaimer:
      "A source comparison is not a bank reconciliation, tax return, verified settlement, or posted accounting close.",
  };
}

export function parseAccountingCsv259(csv) {
  if (typeof csv !== "string" || csv.length > 12_000)
    throw new Error("Accounting preview must be text smaller than 12 KB.");
  const rows = csv.trim().split(/\r?\n/u);
  const header =
    "currency,net_recorded_cents,invoices_issued_cents,succeeded_refunds_cents";
  if (rows[0]?.trim().toLowerCase() !== header)
    throw new Error("Accounting CSV requires header: " + header);
  if (rows.length > 51) throw new Error("Maximum 50 accounting rows.");
  const seen = new Set();
  return rows
    .slice(1)
    .filter(Boolean)
    .map((line, index) => {
      const cells = line.split(",").map((value) => value.trim());
      if (
        cells.length !== 4 ||
        !/^[A-Z]{3}$/u.test(cells[0]) ||
        !/^-?\d{1,12}$/u.test(cells[1]) ||
        !/^\d{1,12}$/u.test(cells[2]) ||
        !/^\d{1,12}$/u.test(cells[3])
      )
        throw new Error("Invalid accounting row " + (index + 2) + ".");
      if (seen.has(cells[0])) throw new Error("Duplicate accounting currency.");
      seen.add(cells[0]);
      const [
        currencyCode,
        netRecordedCents,
        invoicesIssuedCents,
        succeededRefundsCents,
      ] = cells;
      return {
        currencyCode,
        netRecordedCents: Number(netRecordedCents),
        invoicesIssuedCents: Number(invoicesIssuedCents),
        succeededRefundsCents: Number(succeededRefundsCents),
      };
    });
}

export function compareAccountingRows259(imported, expected) {
  const byCurrency = new Map(expected.map((row) => [row.currencyCode, row]));
  const reviewed = new Set();
  const results = imported.map((row) => {
    const local = byCurrency.get(row.currencyCode);
    reviewed.add(row.currencyCode);
    if (!local) return { ...row, status: "unmatched" };
    const equal = [
      "netRecordedCents",
      "invoicesIssuedCents",
      "succeededRefundsCents",
    ].every((field) => row[field] === local[field]);
    return { ...row, status: equal ? "matched" : "variance" };
  });
  for (const row of expected) {
    if (!reviewed.has(row.currencyCode))
      results.push({ ...row, status: "missing" });
  }
  return results;
}
