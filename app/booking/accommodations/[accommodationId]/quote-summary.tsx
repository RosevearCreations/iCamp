import { formatMoney } from "@/lib/pricing/core.mjs";
import type { PublicQuotePreview } from "@/lib/public-accommodation-detail/quote-preview.mjs";

import { QuoteFreshness } from "./quote-freshness";
import styles from "./quote-summary.module.css";

function money(value: number | undefined, currency: string) {
  return formatMoney(value ?? NaN, currency);
}

export function QuoteSummary({
  quote,
  printMode = false,
}: Readonly<{ quote: PublicQuotePreview; printMode?: boolean }>) {
  if (
    quote.status !== "quoted" ||
    !quote.currencyCode ||
    quote.knownSubtotalCents === undefined
  ) {
    return (
      <div role="status" className={styles.warning}>
        No canonical rate covers these dates. We cannot issue a booking price
        preview.
      </div>
    );
  }
  const currency = quote.currencyCode;
  const payment = quote.paymentSchedule;
  const cancellation = quote.cancellationPolicy;
  return (
    <div className={styles.quote} data-quote-source="server-authoritative">
      <div className={styles.banner}>
        <strong>Server-priced estimate · {currency}</strong>
        <p>
          Priced at{" "}
          <time dateTime={quote.quotedAt}>
            {new Date(quote.quotedAt).toUTCString()}
          </time>
          .
        </p>
        <p>
          Expires at{" "}
          <time dateTime={quote.expiresAt ?? undefined}>
            {quote.expiresAt
              ? new Date(quote.expiresAt).toUTCString()
              : "Not available"}
          </time>
          .
        </p>
        <p>
          Stay: {quote.arrivalDate} to {quote.departureDate} · {quote.nights}{" "}
          nights · accommodation availability revision{" "}
          {quote.availabilityRevision}.
        </p>
      </div>
      {!printMode && quote.expiresAt ? (
        <QuoteFreshness expiresAt={quote.expiresAt} />
      ) : null}

      <h3>Night-by-night allocation</h3>
      <p className={styles.muted}>
        Date allocations split the canonical stay rate evenly for comparison;
        weekly, monthly or annual plan rates may apply. These are not separately
        purchasable nightly tariffs. Date-specific adjustments are shown
        independently.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Night</th>
              <th scope="col">Allocated base</th>
              <th scope="col">Adjustments</th>
              <th scope="col">Allocated amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.nightly?.map((night) => (
              <tr key={night.date}>
                <th scope="row">{night.date}</th>
                <td>{money(night.baseCents, currency)}</td>
                <td>{money(night.adjustmentCents, currency)}</td>
                <td>{money(night.allocatedCents, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {quote.adjustments?.length ? (
        <details>
          <summary>
            Which rules changed these dates? ({quote.adjustments.length})
          </summary>
          <ul>
            {quote.adjustments.map((item, index) => (
              <li key={`${item.date}-${item.code}-${index}`}>
                {item.date} · {item.displayName} ·{" "}
                {money(item.deltaCents, currency)}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className={styles.muted}>
          No active date-price adjustments applied.
        </p>
      )}

      <h3>Itemized cost preview</h3>
      <div className="table-wrap">
        <table className={styles.totals}>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Base accommodation ({quote.ratePlan})</th>
              <td>{money(quote.baseCents, currency)}</td>
            </tr>
            <tr>
              <th scope="row">Applied date adjustments</th>
              <td>{money(quote.adjustmentCents, currency)}</td>
            </tr>
            {quote.rateFloorCorrectionCents ? (
              <tr>
                <th scope="row">Minimum-zero stay adjustment</th>
                <td>{money(quote.rateFloorCorrectionCents, currency)}</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">Stay subtotal</th>
              <td>{money(quote.stayCents, currency)}</td>
            </tr>
            {quote.charges?.map((charge) => (
              <tr key={charge.code}>
                <th scope="row">
                  {charge.displayName} ·{" "}
                  {charge.applicationMode === "automatic"
                    ? "mandatory"
                    : "selected optional"}{" "}
                  · quantity {charge.quantity}
                </th>
                <td>{money(charge.lineTotalCents, currency)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Automatic fees subtotal</th>
              <td>{money(quote.automaticCents, currency)}</td>
            </tr>
            <tr>
              <th scope="row">Selected extras subtotal</th>
              <td>{money(quote.optionalCents, currency)}</td>
            </tr>
            <tr className={styles.highlight}>
              <th scope="row">Known subtotal before unpriced taxes</th>
              <td>{money(quote.knownSubtotalCents, currency)}</td>
            </tr>
            <tr>
              <th scope="row">Tax</th>
              <td>Not configured · not included</td>
            </tr>
            <tr>
              <th scope="row">Final tax-inclusive amount</th>
              <td>Unavailable until tax rules are configured</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.warning} role="status">
        <strong>Not a final amount:</strong> The canonical booking catalogue
        does not contain a configured tax-rate calculation. Taxes,
        person/vehicle exceptions or other campground-specific costs may still
        apply. We do not assume 0% tax. Confirm an actual all-in amount with the
        campground before making a commitment.
      </p>

      <h3>Deposit and payment timing</h3>
      {payment ? (
        <dl className={styles.facts}>
          <div>
            <dt>Illustrative booking deposit (known subtotal only)</dt>
            <dd>{money(payment.bookingDepositCents, currency)}</dd>
          </div>
          <div>
            <dt>Remaining balance before tax</dt>
            <dd>{money(payment.reservationBalanceCents, currency)}</dd>
          </div>
          <div>
            <dt>Balance due date</dt>
            <dd>{payment.balanceDueDate}</dd>
          </div>
          <div>
            <dt>Additional security deposit</dt>
            <dd>
              {money(payment.securityDepositCents, currency)} ·{" "}
              {payment.securityDepositDueStage.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt>
              Illustrative combined amount including security deposit, before
              tax
            </dt>
            <dd>{money(payment.totalPayableCents, currency)}</dd>
          </div>
        </dl>
      ) : (
        <p>
          Campground deposit terms are missing or not compatible with this rate
          currency. Contact the office for a quote.
        </p>
      )}
      <p className={styles.muted}>
        Amounts and due dates here are policy previews, not a payment request.
        The final schedule is recalculated at booking; no payment provider is
        active.
      </p>

      <h3>Cancellation and refund policy preview</h3>
      {cancellation ? (
        <dl className={styles.facts}>
          <div>
            <dt>Early-cancellation window</dt>
            <dd>
              {cancellation.freeCancellationDaysBeforeArrival} days before
              arrival
            </dd>
          </div>
          <div>
            <dt>Early refund basis</dt>
            <dd>
              {cancellation.earlyRefundBasisPoints / 100}% of eligible captured
              payment
            </dd>
          </div>
          <div>
            <dt>Late refund basis</dt>
            <dd>
              {cancellation.lateRefundBasisPoints / 100}% of eligible captured
              payment
            </dd>
          </div>
          <div>
            <dt>Security deposit refund basis</dt>
            <dd>
              {cancellation.securityDepositRefundBasisPoints / 100}% of eligible
              captured security deposit
            </dd>
          </div>
          <div>
            <dt>Configured cancellation fee</dt>
            <dd>{money(cancellation.cancellationFeeCents, currency)}</dd>
          </div>
        </dl>
      ) : (
        <p>
          No compatible campground cancellation/refund terms are configured. No
          refund entitlement is implied.
        </p>
      )}
      {quote.policyWarnings?.length ? (
        <ul className={styles.warning}>
          {quote.policyWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <p className={styles.muted}>
        This preview does not create a hold, reservation, payment, refund or
        guarantee. Refreshing or printing re-fetches current source terms.
        Changes to dates, rates, live holds or fees require a new server quote.
        Billing and IVR/SMS remain HELD / DISCONNECTED.
      </p>
    </div>
  );
}
