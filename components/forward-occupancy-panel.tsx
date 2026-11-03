import Link from "next/link";

import type {
  ForwardOccupancyReport,
  ForwardRow,
  ForwardScenario,
} from "@/lib/command-centre/forward-occupancy-core.mjs";

const labels = {
  campsite: "Campsites",
  rental_cottage: "Rental cottages",
  permanent_unit: "Permanent units",
};

const number = (value: number) => value.toLocaleString("en-CA");
const missing = (row: ForwardRow) =>
  row.reason === "no_operating_inventory"
    ? "No currently operating inventory"
    : "Insufficient verified seasonal records";

export function ForwardOccupancyPanel({
  report,
  campgroundId,
  horizon,
  planning,
  historyWindow,
  historyScenario,
}: {
  report: ForwardOccupancyReport | null;
  campgroundId: string;
  horizon: 1 | 2 | 3;
  planning: ForwardScenario;
  historyWindow: 2 | 3 | 5;
  historyScenario: "low" | "weighted" | "high";
}) {
  const exportQuery = new URLSearchParams({
    campground: campgroundId,
    horizon: String(horizon),
    planning,
  });
  return (
    <section
      className="content-panel ops-detail-card forward195"
      aria-labelledby="forward195-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">
            Build 195 · Source-grounded forward planning
          </p>
          <h2 id="forward195-title">Seasonal occupancy outlook</h2>
        </div>
        <span className="ops-pill">Planning only · No automated actions</span>
      </div>
      <p className="ops-inline-note">
        These projections use two prior observations of the{" "}
        <strong>same calendar month</strong>. They require recorded bookings in
        both seasonal years, enough site nights, and currently operating
        inventory. Unknown history stays unavailable—not zero.
      </p>
      <form
        method="get"
        className="forward195__controls"
        aria-label="Future planning options"
      >
        <input type="hidden" name="campground" value={campgroundId} />
        <input type="hidden" name="window" value={historyWindow} />
        <input type="hidden" name="scenario" value={historyScenario} />
        <label htmlFor="forward195-horizon">
          Planning horizon
          <select id="forward195-horizon" name="horizon" defaultValue={horizon}>
            <option value="1">Next full month</option>
            <option value="2">Next two full months</option>
            <option value="3">Next three full months</option>
          </select>
        </label>
        <label htmlFor="forward195-scenario">
          Scenario
          <select
            id="forward195-scenario"
            name="planning"
            defaultValue={planning}
          >
            <option value="low">Low — smallest observed rate</option>
            <option value="typical">Typical — weighted seasonal rate</option>
            <option value="high">High — largest observed rate</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">
          Update outlook
        </button>
      </form>
      {report ? (
        <>
          <div
            className="forward195__provenance"
            aria-label="Source provenance"
          >
            <div>
              <span>As of (campground local)</span>
              <strong>
                {report.asOfLocalDate} · {report.timezone}
              </strong>
            </div>
            <div>
              <span>Source read (UTC)</span>
              <strong>{report.generatedAt}</strong>
            </div>
            <div>
              <span>Historical range</span>
              <strong>
                {report.sourceFirstMonth.slice(0, 7)} to{" "}
                {report.sourceLastMonth.slice(0, 7)}
              </strong>
            </div>
            <div>
              <span>Forecast model</span>
              <strong>{report.modelVersion}</strong>
            </div>
          </div>
          {report.eligibleRows ? (
            <p className="forward195__notice" role="status">
              {report.eligibleRows} of {report.projections.length * 3}{" "}
              type/month forecasts have sufficient records. Values below are
              estimates of booked <em>site nights</em>, capped at today&apos;s
              operating-site count × calendar days.
            </p>
          ) : (
            <p className="forward195__unavailable" role="status">
              No forecast meets the two-year seasonal evidence gate. We cannot
              responsibly estimate future occupancy from the records currently
              available.
            </p>
          )}
          <div className="camp-occupancy__table-scroll">
            <table className="camp-occupancy__table forward195__table">
              <caption>
                Forward-looking scenarios by month and accommodation type;
                observed seasonal range is not a statistical confidence interval
              </caption>
              <thead>
                <tr>
                  <th scope="col">Future month</th>
                  <th scope="col">Accommodation</th>
                  <th scope="col">Evidence coverage</th>
                  <th scope="col">Potential site nights</th>
                  <th scope="col">Selected projection</th>
                  <th scope="col">Observed range</th>
                  <th scope="col">Confidence / limitation</th>
                </tr>
              </thead>
              <tbody>
                {report.projections.flatMap((period) =>
                  period.rows.map((row) => (
                    <tr key={`${period.month}:${row.kind}`}>
                      <th scope="row">{period.month.slice(0, 7)}</th>
                      <td>{labels[row.kind]}</td>
                      <td>
                        {row.coverage}/2 seasonal years
                        <br />
                        <small>
                          {number(row.observedSiteNights)} observed site nights
                        </small>
                      </td>
                      <td>{number(row.capacityNights)}</td>
                      <td>
                        {row.projectedNights === null
                          ? "Unavailable"
                          : `${number(row.projectedNights)} (${row.selectedPercent}%)`}
                      </td>
                      <td>
                        {row.lowerNights === null
                          ? "—"
                          : `${number(row.lowerNights)}–${number(row.upperNights!)} nights`}
                      </td>
                      <td>
                        {row.reason
                          ? missing(row)
                          : `${row.confidence} · not calibrated`}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <details className="forward195__backtest">
            <summary>ⓘ Actual versus projected: recent backtests</summary>
            <p className="ops-inline-note">
              The previous two completed months are compared with estimates made
              from their two earlier same-season months. Missing or sparse
              history remains unavailable. Errors are absolute site-night
              differences, not proof of future accuracy.
            </p>
            <div className="camp-occupancy__table-scroll">
              <table className="camp-occupancy__table">
                <caption>Read-only recent historical backtests</caption>
                <thead>
                  <tr>
                    <th scope="col">Completed month</th>
                    <th scope="col">Accommodation</th>
                    <th scope="col">Actual booked</th>
                    <th scope="col">Retrospective estimate</th>
                    <th scope="col">Absolute error</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.backtests.map((row) => (
                    <tr key={`${row.month}:${row.kind}`}>
                      <th scope="row">{row.month.slice(0, 7)}</th>
                      <td>{labels[row.kind]}</td>
                      <td>
                        {number(row.actualBookedNights)} /{" "}
                        {number(row.actualSiteNights)} nights
                      </td>
                      <td>
                        {row.projectedNights === null
                          ? "Unavailable"
                          : number(row.projectedNights)}
                      </td>
                      <td>
                        {row.absoluteErrorNights === null
                          ? "—"
                          : number(row.absoluteErrorNights)}
                      </td>
                      <td>{row.coverage}/2 seasonal years</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="forward195__actions">
            <Link
              className="secondary-link"
              href={`/api/management/occupancy-forecast/export?${exportQuery}`}
            >
              Download source-labelled CSV ↗
            </Link>
            <span>
              Print this accessible summary with the browser&apos;s Print
              command.
            </span>
          </div>
          <p className="ops-inline-note">
            <strong>Important limits:</strong> {report.sourceDescription} The
            observed low/high range and qualitative confidence are not
            calibrated probability bands. History may be incomplete; holidays,
            weather, changing inventory and closures can cause very different
            results. Current availability, prices, staffing, deposits and
            settlement are never changed. CSV provenance identifies the source
            date, model, scope, assumptions and backtests; SHA-256 tools verify
            bytes only, not evidence authenticity or a digital signature.
            Billing / Omnichannel remain HELD.
          </p>
        </>
      ) : (
        <p className="forward195__unavailable" role="status">
          The authorized longer-range source is unavailable or could not be
          validated. No projected values or export are offered. Review the
          historical comparison below or try again when the source is available.
        </p>
      )}
    </section>
  );
}
