"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CapacityForecastVariance } from "@/lib/command-centre/capacity-forecast-core.mjs";
import {
  createSavedForecastBackup,
  exportSavedForecastComparisonCsv,
  FORECAST_ACTIVITY_LIMIT,
  FORECAST_SAVED_LIMIT,
  parseForecastActivityHistory,
  parseSavedForecastViews,
  recordForecastActivity,
  recoverSavedForecastBackup,
  reviewRecoveryChecksum,
  serializeForecastActivityHistory,
  serializeSavedForecastViews,
  sha256Hex,
  upsertSavedForecastView,
  verifyExportChecksum,
  type ForecastActivityEvent,
  type SavedForecastView,
} from "@/lib/command-centre/forecast-saved-views-core.mjs";

type Snapshot = Pick<
  CapacityForecastVariance,
  "lookbackMonths" | "scenario" | "generatedAt"
> & { total: CapacityForecastVariance["total"] };

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ForecastSavedViews({
  campgroundId,
  userId,
  current,
  comparisons,
}: {
  campgroundId: string;
  userId: string;
  current: Pick<CapacityForecastVariance, "lookbackMonths" | "scenario">;
  comparisons: Snapshot[];
}) {
  const key = `icamp:forecast-saved:v1:${userId}:${campgroundId}`;
  const historyKey = `icamp:forecast-activity:v1:${userId}:${campgroundId}`;
  const [views, setViews] = useState<SavedForecastView[]>([]);
  const [label, setLabel] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryDraft, setRecoveryDraft] = useState<
    SavedForecastView[] | null
  >(null);
  const [recoveryHash, setRecoveryHash] = useState("");
  const [expectedHash, setExpectedHash] = useState("");
  const [acknowledgeUnverified, setAcknowledgeUnverified] = useState(false);
  const [history, setHistory] = useState<ForecastActivityEvent[]>([]);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationExpected, setVerificationExpected] = useState("");
  const [verificationResult, setVerificationResult] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "exports" | "recoveries" | "verifications"
  >("all");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setViews(parseSavedForecastViews(window.localStorage.getItem(key)));
        setHistory(
          parseForecastActivityHistory(window.localStorage.getItem(historyKey)),
        );
        setMessage("");
      } catch {
        setViews([]);
        setMessage(
          "Browser storage is unavailable; saved views cannot be retained.",
        );
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, historyKey]);

  const recordActivity = (event: ForecastActivityEvent) => {
    try {
      const updated = recordForecastActivity(
        parseForecastActivityHistory(window.localStorage.getItem(historyKey)),
        event,
      );
      window.localStorage.setItem(
        historyKey,
        serializeForecastActivityHistory(updated),
      );
      setHistory(updated);
      return true;
    } catch {
      return false;
    }
  };

  const write = (updated: SavedForecastView[]) => {
    try {
      window.localStorage.setItem(key, serializeSavedForecastViews(updated));
      setViews(updated);
      setMessage(
        "Saved in this browser only. Historical figures are recalculated from the current authorized source.",
      );
      return true;
    } catch {
      setMessage(
        "Unable to save in this browser. Your existing views were not changed.",
      );
      return false;
    }
  };

  const selectedKey = `${current.lookbackMonths}:${current.scenario}`;
  const recoveryReview = recoveryDraft
    ? reviewRecoveryChecksum(recoveryHash, expectedHash, acknowledgeUnverified)
    : null;
  const visibleHistory = history.filter((item) =>
    historyFilter === "all"
      ? true
      : historyFilter === "exports"
        ? ["backup", "comparison_csv"].includes(item.action)
        : historyFilter === "recoveries"
          ? item.action === "recovery"
          : item.action.startsWith("verification_"),
  );
  const linkFor = (view: SavedForecastView) =>
    `/workspaces/management/command/forecast?campground=${encodeURIComponent(campgroundId)}&window=${view.lookbackMonths}&scenario=${view.scenario}`;

  return (
    <section
      className="content-panel ops-detail-card camp-forecast__saved"
      aria-labelledby="saved-forecast-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">
            Build 171 · Checksum exception review and recovery activity
          </p>
          <h2 id="saved-forecast-heading">Saved scenario comparison views</h2>
        </div>
        <span className="ops-pill">
          {loaded ? views.length : "…"} / {FORECAST_SAVED_LIMIT} saved
        </span>
      </div>
      <p className="ops-inline-note">
        Save a named window/scenario combination for this signed-in user and
        campground on this browser. Only the name and filter choices are stored
        locally—never booking counts. Comparisons below use this page&apos;s
        newly read, campground-authorized historical records; they are not
        predictions or shared presets.
      </p>
      <form
        className="camp-forecast__save-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            write(upsertSavedForecastView(views, { label, ...current }));
            setLabel("");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to save this view.",
            );
          }
        }}
      >
        <label htmlFor="saved-forecast-name">
          Name this view
          <input
            id="saved-forecast-name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={48}
            required
            placeholder="Example: High-rate 5-month review"
          />
        </label>
        <button type="submit" className="secondary-button" disabled={!loaded}>
          Save selected scenario
        </button>
      </form>
      {message ? (
        <p role="status" className="ops-inline-note">
          {message}
        </p>
      ) : null}
      <div
        className="camp-forecast__recovery"
        aria-labelledby="forecast-recovery-heading"
      >
        <h3 id="forecast-recovery-heading">Backup, recover and export</h3>
        <p className="ops-inline-note">
          Download a portable preference backup to restore these filters on
          another browser while signed in as the same user and campground. The
          backup includes scope IDs and view names, not reservation data.
          Recovery is previewed before replacing local views; the CSV comparison
          uses this page&apos;s current authorized source.
        </p>
        <div className="camp-forecast__recovery-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!loaded || !views.length}
            onClick={async () => {
              try {
                const filename = "icamp-scenario-preferences.json";
                const contents = createSavedForecastBackup(views, {
                  userId,
                  campgroundId,
                });
                const sha256 = await sha256Hex(contents);
                downloadText(filename, contents, "application/json");
                downloadText(
                  `${filename}.sha256`,
                  `${sha256}  ${filename}\n`,
                  "text/plain",
                );
                const retained = recordActivity({
                  action: "backup",
                  occurredAt: new Date().toISOString(),
                  viewCount: views.length,
                  sha256,
                });
                setMessage(
                  `Preference backup and SHA-256 checksum downloaded. SHA-256: ${sha256}. ${retained ? "Logged locally." : "Browser history unavailable."} Keep the scope IDs private; this checksum is not a signature.`,
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to create a saved-view backup.",
                );
              }
            }}
          >
            Download preference backup
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!loaded || !views.length}
            onClick={async () => {
              try {
                const filename = "icamp-historical-comparisons.csv";
                const contents = exportSavedForecastComparisonCsv(
                  views,
                  comparisons,
                );
                const sha256 = await sha256Hex(contents);
                downloadText(filename, contents, "text/csv;charset=utf-8");
                downloadText(
                  `${filename}.sha256`,
                  `${sha256}  ${filename}\n`,
                  "text/plain",
                );
                const retained = recordActivity({
                  action: "comparison_csv",
                  occurredAt: new Date().toISOString(),
                  viewCount: views.length,
                  sha256,
                });
                setMessage(
                  `Historical comparison CSV and SHA-256 checksum downloaded. SHA-256: ${sha256}. ${retained ? "Logged locally." : "Browser history unavailable."} This is a historical snapshot, not a future-demand forecast or signature.`,
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to export the current source comparison.",
                );
              }
            }}
          >
            Export current comparison CSV
          </button>
        </div>
        <label htmlFor="forecast-recovery-file">
          Choose an iCamp scenario preference backup (JSON, 8 KB maximum)
        </label>
        <input
          id="forecast-recovery-file"
          type="file"
          accept=".json,application/json"
          disabled={!loaded}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setRecoveryDraft(null);
            setRecoveryHash("");
            setExpectedHash("");
            setAcknowledgeUnverified(false);
            if (!file) return;
            if (file.size > 8_000) {
              setMessage(
                "Recovery file exceeds 8 KB. No saved views were changed.",
              );
              event.target.value = "";
              return;
            }
            try {
              const contents = await file.text();
              const restored = recoverSavedForecastBackup(contents, {
                userId,
                campgroundId,
              });
              const sha256 = await sha256Hex(contents);
              setRecoveryDraft(restored);
              setRecoveryHash(sha256);
              setMessage(
                `${restored.length} valid saved view(s) ready. Backup SHA-256: ${sha256}. Verify independently against a trusted checksum before restoring.`,
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Recovery file could not be read.",
              );
            }
            event.target.value = "";
          }}
        />
        {recoveryDraft ? (
          <div
            className="camp-forecast__restore-confirm"
            role="group"
            aria-label="Confirm saved view recovery"
          >
            <p>
              Restore {recoveryDraft.length} view(s) and replace the{" "}
              {views.length} current browser-local view(s)?
            </p>
            <label htmlFor="forecast-expected-hash">
              Trusted backup SHA-256 (64 hexadecimal characters, if available)
              <input
                id="forecast-expected-hash"
                value={expectedHash}
                maxLength={64}
                spellCheck={false}
                onChange={(event) =>
                  setExpectedHash(event.target.value.trim().toLowerCase())
                }
                placeholder="Paste independently verified checksum"
              />
            </label>
            <p className="ops-inline-note" role="status">
              <strong>Recovery integrity review: </strong>
              {recoveryReview?.guidance}
            </p>
            {!expectedHash ? (
              <label className="camp-forecast__unverified-acknowledgement">
                <input
                  type="checkbox"
                  checked={acknowledgeUnverified}
                  onChange={(event) =>
                    setAcknowledgeUnverified(event.target.checked)
                  }
                />
                I understand that this backup has no independently verified
                checksum. I am requesting a browser-local preference recovery,
                not authenticating the file or approving an external action.
              </label>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              disabled={!recoveryReview?.canRestore}
              onClick={() => {
                if (!recoveryReview?.canRestore) {
                  setMessage(
                    "Recovery integrity review is not complete. No saved views were changed.",
                  );
                  return;
                }
                if (write(recoveryDraft)) {
                  const retained = recordActivity({
                    action: "recovery",
                    occurredAt: new Date().toISOString(),
                    viewCount: recoveryDraft.length,
                    sha256: recoveryHash,
                  });
                  setMessage(
                    `Browser-local restore completed (${recoveryReview.status === "match" ? "checksum matched" : "unverified exception acknowledged"}). SHA-256: ${recoveryHash}. ${retained ? "Recovery recorded in local activity history." : "Browser activity history unavailable."} No independent authenticity or owner approval was established.`,
                  );
                  setRecoveryDraft(null);
                  setExpectedHash("");
                  setAcknowledgeUnverified(false);
                }
              }}
            >
              Confirm local restore
            </button>
            {recoveryReview?.status !== "match" ? (
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  const lines = [
                    "iCamp Build 171 — Local recovery checksum exception (NOT trusted provenance)",
                    `Local backup SHA-256: ${recoveryHash}`,
                    `Review status: ${recoveryReview?.status ?? "unavailable"}`,
                    recoveryReview?.guidance ?? "No valid integrity result.",
                    "No backup contents, booking data, approval or external notification included.",
                  ];
                  try {
                    await navigator.clipboard.writeText(lines.join("\n"));
                    const retained = recordActivity({
                      action: "recovery_exception",
                      occurredAt: new Date().toISOString(),
                      viewCount: recoveryDraft.length,
                      sha256: recoveryHash,
                    });
                    setMessage(
                      `Local recovery exception copied for manual review. ${retained ? "Metadata retained in browser history." : "Local history unavailable."} No recovery or message was sent.`,
                    );
                  } catch {
                    setMessage(
                      "Clipboard unavailable. Review the visible checksum exception before any restore.",
                    );
                  }
                }}
              >
                Copy integrity exception for manual review
              </button>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setRecoveryDraft(null);
                setExpectedHash("");
                setAcknowledgeUnverified(false);
                setMessage(
                  "Recovery canceled; local saved views were not changed.",
                );
              }}
            >
              Cancel recovery
            </button>
          </div>
        ) : null}
        <div
          className="camp-forecast__verification"
          aria-labelledby="forecast-verification-heading"
        >
          <h4 id="forecast-verification-heading">
            Verify downloaded export bytes against a checksum
          </h4>
          <p className="ops-inline-note">
            Choose a local iCamp CSV or JSON export (2 MB maximum). Paste its
            trusted SHA-256 digest or the full companion `.sha256` line.
            Verification hashes the original file bytes entirely in this
            browser. A matching digest proves byte equality only—never who
            created the file.
          </p>
          <label htmlFor="forecast-verify-file">
            Local comparison CSV or preference JSON
          </label>
          <input
            id="forecast-verify-file"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={!loaded}
            onChange={(event) => {
              setVerificationFile(event.target.files?.[0] ?? null);
              setVerificationResult("");
            }}
          />
          <label htmlFor="forecast-verify-hash">
            Trusted SHA-256 digest or companion line
          </label>
          <textarea
            id="forecast-verify-hash"
            rows={2}
            maxLength={220}
            spellCheck={false}
            value={verificationExpected}
            onChange={(event) => {
              setVerificationExpected(event.target.value);
              setVerificationResult("");
            }}
            placeholder="64 hex characters or: SHA-256  filename.csv"
          />
          <button
            type="button"
            className="secondary-button"
            disabled={
              !loaded || !verificationFile || !verificationExpected.trim()
            }
            onClick={async () => {
              const file = verificationFile;
              if (!file) return;
              if (file.size > 2_000_000 || !/\.(csv|json)$/i.test(file.name)) {
                setVerificationResult(
                  "Choose a CSV or JSON file no larger than 2 MB. No history changed.",
                );
                return;
              }
              try {
                const result = await verifyExportChecksum(
                  await file.arrayBuffer(),
                  verificationExpected,
                  file.name,
                );
                const retained = recordActivity({
                  action: result.matches
                    ? "verification_match"
                    : "verification_mismatch",
                  occurredAt: new Date().toISOString(),
                  viewCount: 0,
                  sha256: result.actualSha256,
                });
                setVerificationResult(
                  `${result.matches ? "SHA-256 MATCH" : "SHA-256 MISMATCH — do not rely on this file"}. Calculated: ${result.actualSha256}. Expected: ${result.expectedSha256}. ${retained ? "Result logged as metadata only." : "Local history unavailable."} Equality does not establish authenticity or approval.`,
                );
              } catch (error) {
                setVerificationResult(
                  error instanceof Error
                    ? error.message
                    : "Checksum verification failed. No files were changed.",
                );
              }
            }}
          >
            Verify local export checksum
          </button>
          {verificationResult ? (
            <p role="status" className="ops-inline-note">
              {verificationResult}
            </p>
          ) : null}
        </div>
        <div
          className="camp-forecast__history"
          aria-labelledby="forecast-history-heading"
        >
          <div className="ops-section-heading">
            <div>
              <h4 id="forecast-history-heading">
                Browser-local export and recovery history
              </h4>
              <small>
                Up to {FORECAST_ACTIVITY_LIMIT} metadata-only entries for this
                user and campground, including checksum checks;{" "}
                {"not a server audit trail"} or proof of authenticity.
              </small>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={!history.length}
              onClick={() => {
                try {
                  window.localStorage.removeItem(historyKey);
                  setHistory([]);
                  setMessage(
                    "Local export and recovery history cleared; downloaded files and saved views are unchanged.",
                  );
                } catch {
                  setMessage("Unable to clear browser-local history.");
                }
              }}
            >
              Clear local history
            </button>
          </div>
          <div className="camp-forecast__history-tools">
            <label htmlFor="forecast-history-filter">
              Activity review
              <select
                id="forecast-history-filter"
                value={historyFilter}
                onChange={(event) =>
                  setHistoryFilter(event.target.value as typeof historyFilter)
                }
              >
                <option value="all">All activity</option>
                <option value="exports">Exports only</option>
                <option value="recoveries">Recoveries only</option>
                <option value="verifications">Checksum checks only</option>
              </select>
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={!visibleHistory.length}
              onClick={async () => {
                const lines = [
                  "iCamp Build 171 — Local checksum exceptions and recovery activity (NOT a server audit)",
                  ...visibleHistory.map(
                    (item) =>
                      `${item.occurredAt} | ${item.action} | ${item.viewCount} saved views | SHA-256 ${item.sha256}`,
                  ),
                  "Browser-local, mutable metadata only. No file authenticity or independent ownership was established.",
                ];
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  setMessage(
                    "Selected local activity metadata copied. Nothing was transmitted or approved.",
                  );
                } catch {
                  setMessage(
                    "Clipboard blocked; use the visible activity list.",
                  );
                }
              }}
            >
              Copy activity review
            </button>
          </div>
          {visibleHistory.length ? (
            <ol>
              {visibleHistory.map((item, index) => (
                <li key={`${item.occurredAt}:${index}`}>
                  <strong>{item.action.replaceAll("_", " ")}</strong> ·{" "}
                  {item.viewCount} view(s) · {item.occurredAt}
                  <code>SHA-256 {item.sha256}</code>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ops-inline-note">
              No locally retained activities match this review filter.
            </p>
          )}
        </div>
      </div>
      {!loaded ? (
        <p role="status">Loading saved views from this browser…</p>
      ) : views.length ? (
        <div className="camp-occupancy__table-scroll">
          <table className="camp-occupancy__table camp-forecast__saved-table">
            <caption>
              Current source comparison of saved historical-rate scenarios; site
              nights
            </caption>
            <thead>
              <tr>
                <th scope="col">Saved view</th>
                <th scope="col">Estimate</th>
                <th scope="col">Actual − estimate</th>
                <th scope="col">Comparable types</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {views.map((view) => {
                const snapshot = comparisons.find(
                  (item) =>
                    item.lookbackMonths === view.lookbackMonths &&
                    item.scenario === view.scenario,
                );
                return (
                  <tr key={view.key}>
                    <th scope="row">
                      {view.label}
                      <small>
                        {view.lookbackMonths} months · {view.scenario}
                        {view.key === selectedKey ? " · selected" : ""}
                      </small>
                    </th>
                    <td>
                      {snapshot
                        ? snapshot.total.expectedNights.toLocaleString("en-CA")
                        : "Unavailable"}
                    </td>
                    <td>
                      {snapshot
                        ? `${snapshot.total.varianceNights > 0 ? "+" : ""}${snapshot.total.varianceNights.toLocaleString("en-CA")}`
                        : "—"}
                    </td>
                    <td>
                      {snapshot ? `${snapshot.total.comparableKinds} / 3` : "—"}
                    </td>
                    <td className="camp-forecast__saved-actions">
                      <Link href={linkFor(view)}>Open ↗</Link>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          write(views.filter((item) => item.key !== view.key))
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ops-inline-note">
          No local saved views yet. Choose scenario filters above, name the
          selection, and save it here.
        </p>
      )}
      <p className="ops-inline-note">
        An unavailable source remains unavailable; no saved number is
        substituted. Clearing browser storage removes these view preferences.
      </p>
    </section>
  );
}
