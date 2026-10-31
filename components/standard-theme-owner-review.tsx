"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const reviews = [
  {
    key: "command",
    title: "Management Command",
    detail:
      "Readable KPI cards, no clipped text, working campground selector and navigation",
    href: "/workspaces/management/command",
  },
  {
    key: "capacity",
    title: "Capacity & occupancy",
    detail:
      "Accurate calendar totals, clear legend, zero/unknown distinction, responsive chart",
    href: "/workspaces/management/command/capacity",
  },
  {
    key: "seasonal",
    title: "Seasonal utilization",
    detail:
      "Six-month bars and exact counts remain readable at 200% zoom and on small screens",
    href: "/workspaces/management/command/seasonal",
  },
  {
    key: "segments",
    title: "Accommodation segment comparisons",
    detail:
      "Compare 3 and 6-month campsite, cottage and permanent unit totals; inspect responsive tables at 200% zoom",
    href: "/workspaces/management/command/segments",
  },
  {
    key: "forecast",
    title: "Seasonal capacity forecast variance",
    detail:
      "Verify month-to-date actuals, historical baseline and excluded-category notice; no false booking forecast",
    href: "/workspaces/management/command/forecast",
  },
  {
    key: "assistance",
    title: "Camper assistance",
    detail:
      "Case cards, filter/search, owner/staff triage handoff and readable inspector",
    href: "/workspaces/management/command/assistance",
  },
  {
    key: "resolution",
    title: "Camper resolution history",
    detail:
      "Case filters, event chronology and links work using keyboard, mouse or touch",
    href: "/workspaces/management/command/resolutions",
  },
  {
    key: "escalations",
    title: "Camper escalation aging",
    detail:
      "Verify accessible filters, 24/72-hour labels, unknown timestamps and case review links",
    href: "/workspaces/management/command/escalations",
  },
  {
    key: "it",
    title: "I.T. and release status",
    detail:
      "Honest readiness indicators and operational tools, with HELD integrations visibly marked",
    href: "/workspaces/it-analysis",
  },
  {
    key: "mobile",
    title: "Phone and tablet",
    detail:
      "Tap targets, horizontal boards, overflow, long campground names and text at large zoom",
    href: "/workspaces/management/command",
  },
  {
    key: "accessibility",
    title: "Display accessibility",
    detail:
      "Header Display options switch high contrast, reduced motion and larger text; Escape closes the options menu",
    href: "/settings/themes/acceptance",
  },
] as const;

const deviceChecks = [
  {
    key: "desktop",
    label: "Desktop / laptop",
    guidance:
      "At least 1280 CSS pixels; keyboard Tab/Shift+Tab, 200% zoom and focus rings",
  },
  {
    key: "tablet",
    label: "Tablet",
    guidance:
      "About 768–1024 CSS pixels; portrait/landscape, long names and horizontal tables",
  },
  {
    key: "phone",
    label: "Phone",
    guidance:
      "About 360–430 CSS pixels; touch controls, readable cards and no clipped actions",
  },
] as const;
type DeviceResult = "not_tested" | "passed" | "issue";

export function StandardThemeOwnerReview() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [deviceResults, setDeviceResults] = useState<
    Record<string, DeviceResult>
  >({});
  const [copyState, setCopyState] = useState("");
  const done = useMemo(
    () => reviews.filter((item) => checked[item.key]).length,
    [checked],
  );
  const summary = () =>
    [
      "iCamp Build 165 — Standard Theme Cross-Device Verification",
      `Reviewed: ${done}/${reviews.length} areas`,
      ...reviews.map(
        (item) =>
          `${checked[item.key] ? "[reviewed]" : "[not yet reviewed]"} ${item.title}`,
      ),
      "Device observations (self-reported; not automatically verified):",
      ...deviceChecks.map(
        (device) =>
          `${device.label}: ${(deviceResults[device.key] ?? "not_tested").replaceAll("_", " ")}`,
      ),
      "Owner feedback:",
      notes.trim() || "(no feedback entered)",
      "This is owner review feedback, not a billing, integration or production authorization.",
    ].join("\n");

  return (
    <section className="content-panel ops-detail-card camp-theme-review">
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Owner acceptance walkthrough</p>
          <h2>Inspect real screens before sign-off</h2>
        </div>
        <span className="ops-pill">
          {done} / {reviews.length} reviewed in this browser session
        </span>
      </div>
      <div
        className="ops-progress-track"
        role="progressbar"
        aria-label="Owner visual review progress"
        aria-valuemin={0}
        aria-valuemax={reviews.length}
        aria-valuenow={done}
      >
        <span style={{ width: `${(done * 100) / reviews.length}%` }} />
      </div>
      <p className="ops-inline-note">
        Checks on this page are temporary review notes, not a stored approval.
        Open each screen, confirm how it looks on your devices, then copy and
        return your observations for resolution.
      </p>
      <p className="ops-inline-note">
        Try Tab, Shift+Tab, Enter and Space; increase your browser zoom to 200%;
        and use the header Display options to test high contrast and reduced
        motion and larger text; use Escape to close the options. Preferences
        stay on this device and do not alter campground records.
      </p>
      <div className="camp-theme-review__list">
        {reviews.map((item) => (
          <div className="camp-theme-review__item" key={item.key}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(checked[item.key])}
                onChange={(event) =>
                  setChecked((state) => ({
                    ...state,
                    [item.key]: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </label>
            <Link href={item.href}>Inspect screen ↗</Link>
          </div>
        ))}
      </div>
      <div
        className="camp-device-review"
        aria-labelledby="device-review-heading"
      >
        <div className="ops-section-heading">
          <div>
            <p className="eyebrow">Build 165 · Cross-device check</p>
            <h3 id="device-review-heading">What have we actually tested?</h3>
          </div>
        </div>
        <p className="ops-inline-note">
          Test these widths in a browser or on the actual devices. Check
          navigation, forecast tables, escalation handoff, display options,
          contrast and larger text. A simulated viewport does not prove the
          experience on a physical device.
        </p>
        <div className="camp-device-review__grid">
          {deviceChecks.map((device) => (
            <label className="camp-device-review__item" key={device.key}>
              <strong>{device.label}</strong>
              <small>{device.guidance}</small>
              <span>Result</span>
              <select
                value={deviceResults[device.key] ?? "not_tested"}
                onChange={(event) =>
                  setDeviceResults((state) => ({
                    ...state,
                    [device.key]: event.target.value as DeviceResult,
                  }))
                }
              >
                <option value="not_tested">Not yet tested</option>
                <option value="passed">Looks good</option>
                <option value="issue">Needs correction</option>
              </select>
            </label>
          ))}
        </div>
      </div>
      <label className="camp-theme-review__notes">
        What should we adjust?
        <textarea
          rows={5}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Example: Capacity labels overlap at 125% zoom on my tablet…"
        />
      </label>
      <div className="camp-theme-review__actions">
        <button
          type="button"
          className="primary-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(summary());
              setCopyState(
                "Review notes copied. You can paste them back into our conversation.",
              );
            } catch {
              setCopyState(
                "Clipboard access was blocked. Select and copy the review notes shown below.",
              );
            }
          }}
        >
          Copy owner review summary
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setChecked({});
            setDeviceResults({});
            setNotes("");
            setCopyState("");
          }}
        >
          Clear this review
        </button>
      </div>
      {copyState ? (
        <p role="status" className="ops-inline-note">
          {copyState}
        </p>
      ) : null}
      <textarea
        readOnly
        aria-label="Owner review summary for manual copying"
        value={summary()}
        rows={8}
      />
    </section>
  );
}
