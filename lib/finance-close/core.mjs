const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const REVIEW_STATES = new Set([
  "pending_approval",
  "approved",
  "submitted",
  "failed",
]);

export function localDay(timestamp, timezone) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function validCloseDate(value, today) {
  if (!DAY.test(String(value))) throw new Error("Invalid close date.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("Invalid calendar close date.");
  const anchor = new Date(`${today}T00:00:00Z`);
  const days = Math.round((anchor.valueOf() - date.valueOf()) / 86400000);
  if (!Number.isFinite(days) || days < 0 || days > 31)
    throw new Error("Choose a campground day within the past 31 days.");
  return value;
}

export function adjustmentEvidence(row) {
  const marker = row.evidence?.build196;
  return marker && typeof marker === "object" ? marker : null;
}

function addMoney(map, currency, cents) {
  const code = String(currency || "UNKNOWN");
  map[code] = (map[code] ?? 0) + Number(cents || 0);
}

function entry(type, priority, reservationId, sourceId, summary, evidencePath) {
  return { type, priority, reservationId, sourceId, summary, evidencePath };
}

export function buildFinancialCloseReview(source) {
  const { timezone, localDate, payments, refunds, adjustments } = source;
  const cases = [];
  const captured = {};
  const refunded = {};
  const receiptTotals = {};
  const adjusted = {};
  const paymentMap = new Map(payments.map((item) => [item.id, item]));
  const proposals = adjustments.filter(
    (item) => adjustmentEvidence(item)?.type === "proposal",
  );
  const decisions = new Map(
    adjustments
      .filter((item) => adjustmentEvidence(item)?.type === "decision")
      .map((item) => [adjustmentEvidence(item).proposalId, item]),
  );

  for (const payment of payments) {
    if (payment.state === "captured") {
      if (localDay(payment.capturedAt, timezone) === localDate)
        addMoney(captured, payment.currencyCode, payment.amountCents);
      if (!payment.receiptId)
        cases.push(
          entry(
            "receipt",
            "attention",
            payment.reservationId,
            payment.id,
            "Captured payment has no linked receipt.",
            "payment",
          ),
        );
      else if (
        payment.receiptCents !== payment.amountCents ||
        payment.receiptCurrency !== payment.currencyCode
      )
        cases.push(
          entry(
            "receipt",
            "critical",
            payment.reservationId,
            payment.id,
            "Receipt amount or currency differs from captured payment.",
            "payment",
          ),
        );
      if (!payment.providerReference)
        cases.push(
          entry(
            "provider",
            "attention",
            payment.reservationId,
            payment.id,
            "Captured payment has no provider reference for settlement matching.",
            "payment",
          ),
        );
    }
    if (
      payment.receiptId &&
      localDay(payment.receiptIssuedAt, timezone) === localDate
    )
      addMoney(receiptTotals, payment.receiptCurrency, payment.receiptCents);
    if (payment.state === "failed")
      cases.push(
        entry(
          "payment",
          "attention",
          payment.reservationId,
          payment.id,
          "Payment failed; inspect original provider evidence.",
          "payment",
        ),
      );
  }

  const activeRefundsByPayment = new Map();
  for (const refund of refunds) {
    if (
      refund.state === "succeeded" &&
      localDay(refund.completedAt, timezone) === localDate
    )
      addMoney(refunded, refund.currencyCode, refund.amountCents);
    if (REVIEW_STATES.has(refund.state))
      cases.push(
        entry(
          "refund",
          refund.state === "failed" ? "critical" : "attention",
          refund.reservationId,
          refund.id,
          `Refund ${refund.state.replaceAll("_", " ")} · approval ${refund.approvalState}.`,
          "refund",
        ),
      );
    if (!paymentMap.has(refund.originalPaymentId))
      cases.push(
        entry(
          "refund",
          "attention",
          refund.reservationId,
          refund.id,
          "Original captured payment is outside this evidence window; verify before acting.",
          "refund",
        ),
      );
    if (!["rejected", "failed"].includes(refund.state)) {
      activeRefundsByPayment.set(
        refund.originalPaymentId,
        (activeRefundsByPayment.get(refund.originalPaymentId) ?? 0) +
          refund.amountCents,
      );
    }
  }
  for (const [paymentId, reservedCents] of activeRefundsByPayment) {
    const payment = paymentMap.get(paymentId);
    if (payment && reservedCents > payment.amountCents)
      cases.push(
        entry(
          "refund",
          "critical",
          payment.reservationId,
          paymentId,
          "Linked pending/succeeded refunds exceed captured payment.",
          "payment",
        ),
      );
  }
  for (const adjustment of adjustments) {
    const marker = adjustmentEvidence(adjustment);
    if (marker?.type === "proposal" || marker?.type === "decision") continue;
    // Approved-and-posted Build 196 rows are actual adjustment evidence;
    // proposals/checker decisions are zero-effect markers only.
    if (localDay(adjustment.occurredAt, timezone) === localDate)
      addMoney(adjusted, adjustment.currencyCode, adjustment.amountCents);
  }
  for (const proposal of proposals) {
    if (!decisions.has(proposal.id))
      cases.push(
        entry(
          "adjustment",
          "attention",
          proposal.reservationId,
          proposal.id,
          "Independent checker decision required. No ledger amount posted.",
          "proposal",
        ),
      );
  }

  cases.sort(
    (a, b) =>
      Number(b.priority === "critical") - Number(a.priority === "critical"),
  );
  const currencies = [
    ...new Set([
      ...Object.keys(captured),
      ...Object.keys(refunded),
      ...Object.keys(receiptTotals),
      ...Object.keys(adjusted),
    ]),
  ].sort();
  const worksheet = currencies.map((currencyCode) => ({
    currencyCode,
    capturedCents: captured[currencyCode] ?? 0,
    succeededRefundCents: refunded[currencyCode] ?? 0,
    netRecordedMovementCents:
      (captured[currencyCode] ?? 0) - (refunded[currencyCode] ?? 0),
    issuedReceiptCents: receiptTotals[currencyCode] ?? 0,
    adjustmentEvidenceCents: adjusted[currencyCode] ?? 0,
  }));
  const truncated = Object.values(source.truncated ?? {}).some(Boolean);
  return {
    generatedAt: source.generatedAt,
    localDate,
    timezone,
    cases,
    worksheet,
    proposals: proposals.map((record) => ({
      id: record.id,
      reservationId: record.reservationId,
      actorUserId: record.actorUserId,
      requestedKind: adjustmentEvidence(record).requestedKind,
      requestedAmountCents: adjustmentEvidence(record).requestedAmountCents,
      currencyCode: record.currencyCode,
      reason: record.reason,
      decision: decisions.has(record.id)
        ? adjustmentEvidence(decisions.get(record.id)).decision
        : null,
      decidedByUserId: decisions.get(record.id)?.actorUserId ?? null,
    })),
    sourceCounts: {
      payments: payments.length,
      refunds: refunds.length,
      adjustments: adjustments.length,
    },
    truncated,
    disclaimer:
      "Recorded movements only; not a bank settlement, cash-balance assertion, or posted close.",
  };
}

export function parseSettlementCsv(text) {
  if (typeof text !== "string" || text.length > 80_000)
    throw new Error("Settlement preview must be a CSV under 80 KB.");
  const rows = [];
  let fields = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell !== "")
        throw new Error("Invalid CSV quote placement.");
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      fields.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      fields.push(cell);
      cell = "";
      if (fields.some((value) => value !== "")) rows.push(fields);
      fields = [];
    } else {
      cell += ch;
    }
    if (rows.length > 201) throw new Error("Maximum 200 settlement rows.");
  }
  if (quoted) throw new Error("Unterminated CSV quote.");
  if (cell !== "" || fields.length) {
    fields.push(cell);
    rows.push(fields);
  }
  const expected = [
    "provider",
    "provider_reference",
    "currency",
    "captured_cents",
    "refunded_cents",
  ];
  if (
    rows.length === 0 ||
    rows[0].map((field) => field.trim().toLowerCase()).join() !==
      expected.join()
  )
    throw new Error(`CSV header must be ${expected.join(",")}.`);
  if (rows.length > 201) throw new Error("Maximum 200 settlement rows.");
  const seen = new Set();
  return rows.slice(1).map((row, index) => {
    if (row.length !== 5)
      throw new Error(`Row ${index + 2} must have five columns.`);
    const [
      provider,
      providerReference,
      currencyCode,
      capturedText,
      refundedText,
    ] = row.map((value) => value.trim());
    if (
      !/^[a-z][a-z0-9_-]{1,63}$/u.test(provider) ||
      !providerReference ||
      providerReference.length > 240 ||
      !/^[A-Z]{3}$/u.test(currencyCode) ||
      !/^\d{1,12}$/u.test(capturedText) ||
      !/^\d{1,12}$/u.test(refundedText)
    )
      throw new Error(
        `Row ${index + 2} has invalid reference, currency or cents.`,
      );
    const key = JSON.stringify([provider, currencyCode, providerReference]);
    if (seen.has(key))
      throw new Error(`Duplicate settlement reference on row ${index + 2}.`);
    seen.add(key);
    return {
      provider,
      providerReference,
      currencyCode,
      capturedCents: Number(capturedText),
      refundedCents: Number(refundedText),
    };
  });
}

export function compareSettlementRows(rows, expected) {
  const sources = new Map(
    expected.map((row) => [
      JSON.stringify([row.provider, row.currencyCode, row.providerReference]),
      row,
    ]),
  );
  const matched = new Set();
  const comparisons = rows.map((row) => {
    const key = JSON.stringify([
      row.provider,
      row.currencyCode,
      row.providerReference,
    ]);
    const source = sources.get(key);
    if (!source)
      return {
        ...row,
        status: "unmatched",
        details: "No recorded source reference within the evidence window.",
      };
    matched.add(key);
    return {
      ...row,
      status:
        row.capturedCents === source.capturedCents &&
        row.refundedCents === source.refundedCents
          ? "matched"
          : "variance",
      details: `Recorded: captured ${source.capturedCents} cents; refunded ${source.refundedCents} cents.`,
    };
  });
  for (const [key, source] of sources)
    if (!matched.has(key))
      comparisons.push({
        ...source,
        status: "missing",
        details: "Recorded source not listed in pasted CSV.",
      });
  return comparisons;
}
