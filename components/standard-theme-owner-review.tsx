"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  prepareIndependentOwnerAcceptanceRequest,
  summarizeStandardThemeClosureReadiness,
} from "@/lib/command-centre/standard-theme-closure-readiness-core.mjs";

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
const accessibilityChecks = [
  {
    key: "keyboard",
    title: "Keyboard and focus",
    guidance:
      "Tab and Shift+Tab order, visible focus, Enter/Space controls and Escape dismissal",
  },
  {
    key: "zoom",
    title: "200% zoom and reflow",
    guidance:
      "At 200% zoom, inspect text, filters, action buttons and table scrolling without clipping",
  },
  {
    key: "contrast",
    title: "High contrast and larger text",
    guidance:
      "Use Display options and confirm all labels, alerts and data remain legible",
  },
  {
    key: "motion",
    title: "Reduced motion and touch",
    guidance:
      "Verify reduced-motion display options, readable notices and usable touch targets",
  },
] as const;
type DeviceResult = "not_tested" | "passed" | "issue";
type DeviceRetest = "not_retested" | "looks_fixed" | "still_fails";
type AccessibilityResult = "not_tested" | "passed" | "needs_fix";
type AccessibilityFollowUp = "open" | "planned" | "owner_retested";
type AccessibilityPriority = "normal" | "urgent";
const retestStorageKey = "icamp:standard-theme-retest:v1";

export function StandardThemeOwnerReview() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [deviceResults, setDeviceResults] = useState<
    Record<string, DeviceResult>
  >({});
  const [deviceCorrections, setDeviceCorrections] = useState<
    Record<string, string>
  >({});
  const [deviceRetests, setDeviceRetests] = useState<
    Record<string, DeviceRetest>
  >({});
  const [copyState, setCopyState] = useState("");
  const [accessibilityResults, setAccessibilityResults] = useState<
    Record<string, AccessibilityResult>
  >({});
  const [accessibilityNotes, setAccessibilityNotes] = useState<
    Record<string, string>
  >({});
  const [accessibilityFollowUps, setAccessibilityFollowUps] = useState<
    Record<string, AccessibilityFollowUp>
  >({});
  const [accessibilityPriorities, setAccessibilityPriorities] = useState<
    Record<string, AccessibilityPriority>
  >({});
  const [accessibilityNextSteps, setAccessibilityNextSteps] = useState<
    Record<string, string>
  >({});
  const [retestFilter, setRetestFilter] = useState<"open" | "all" | "observed">(
    "open",
  );
  const done = useMemo(
    () => reviews.filter((item) => checked[item.key]).length,
    [checked],
  );
  const accessibilityPassed = accessibilityChecks.filter(
    (item) => accessibilityResults[item.key] === "passed",
  ).length;
  const accessibilityIssues = accessibilityChecks.filter(
    (item) => accessibilityResults[item.key] === "needs_fix",
  ).length;
  const acceptanceQueue = accessibilityChecks
    .map((item) => ({
      ...item,
      result: accessibilityResults[item.key] ?? "not_tested",
      followUp: accessibilityFollowUps[item.key] ?? "open",
      priority: accessibilityPriorities[item.key] ?? "normal",
      nextStep: accessibilityNextSteps[item.key]?.trim() ?? "",
    }))
    .sort(
      (a, b) =>
        Number(b.result === "needs_fix") - Number(a.result === "needs_fix") ||
        Number(b.priority === "urgent") - Number(a.priority === "urgent") ||
        a.title.localeCompare(b.title),
    );
  const acceptanceOutstanding = acceptanceQueue.filter(
    (item) => item.result !== "passed" || item.followUp === "planned",
  );
  const reviewInputs = {
    areas: reviews.map((item) => ({
      key: item.key,
      reviewed: checked[item.key] === true,
    })),
    devices: deviceChecks.map((item) => ({
      key: item.key,
      result: deviceResults[item.key] ?? "not_tested",
      correction: deviceCorrections[item.key] ?? "",
      retest: deviceRetests[item.key] ?? "not_retested",
    })),
    accessibility: accessibilityChecks.map((item) => ({
      key: item.key,
      result: accessibilityResults[item.key] ?? "not_tested",
      followUp: accessibilityFollowUps[item.key] ?? "open",
      priority: accessibilityPriorities[item.key] ?? "normal",
    })),
    notes,
  };
  const closureReadiness = summarizeStandardThemeClosureReadiness(reviewInputs);
  const independentRequest =
    prepareIndependentOwnerAcceptanceRequest(reviewInputs);
  const retestQueue = deviceChecks.map((device) => {
    const result = deviceResults[device.key] ?? "not_tested";
    const retest = deviceRetests[device.key] ?? "not_retested";
    const hasCorrection = Boolean(deviceCorrections[device.key]?.trim());
    const inScope =
      result === "issue" || hasCorrection || retest !== "not_retested";
    return { ...device, result, retest, hasCorrection, inScope };
  });
  const outstanding = retestQueue.filter(
    (item) => item.inScope && item.retest !== "looks_fixed",
  );
  const observed = retestQueue.filter(
    (item) => item.inScope && item.retest === "looks_fixed",
  );
  const queueVisible = retestQueue.filter((item) =>
    retestFilter === "all"
      ? item.inScope
      : retestFilter === "open"
        ? item.inScope && item.retest !== "looks_fixed"
        : item.inScope && item.retest === "looks_fixed",
  );
  const summary = () =>
    [
      "iCamp Build 171 — Standard Theme Independent Owner Review Request Readiness",
      `Reviewed: ${done}/${reviews.length} areas`,
      ...reviews.map(
        (item) =>
          `${checked[item.key] ? "[reviewed]" : "[not yet reviewed]"} ${item.title}`,
      ),
      "Device observations (self-reported; not automatically verified):",
      ...deviceChecks.flatMap((device) => [
        `${device.label}: ${(deviceResults[device.key] ?? "not_tested").replaceAll("_", " ")}`,
        `Correction / screen: ${deviceCorrections[device.key]?.trim() || "(not entered)"}`,
        `Manual retest: ${(deviceRetests[device.key] ?? "not_retested").replaceAll("_", " ")}`,
      ]),
      `Accessibility owner retest summary: ${accessibilityPassed} passed, ${accessibilityIssues} need correction, ${accessibilityChecks.length - accessibilityPassed - accessibilityIssues} not tested`,
      ...accessibilityChecks.map(
        (item) =>
          `${item.title}: ${(accessibilityResults[item.key] ?? "not_tested").replaceAll("_", " ")} — ${accessibilityNotes[item.key]?.trim() || "No observation recorded"} | follow-up ${(accessibilityFollowUps[item.key] ?? "open").replaceAll("_", " ")} | priority ${accessibilityPriorities[item.key] ?? "normal"} | next step: ${accessibilityNextSteps[item.key]?.trim() || "not assigned"}`,
      ),
      `Accessibility acceptance follow-ups still requiring review: ${acceptanceOutstanding.length}. Owner retest is not independent acceptance.`,
      `Closure readiness for requesting separate owner sign-off: ${closureReadiness.canRequestIndependentReview ? "local walkthrough complete" : "not ready"}; ${closureReadiness.blockers.length} local blocker(s)`,
      ...closureReadiness.blockers.map((item) => `Open: ${item}`),
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
            <p className="eyebrow">
              Build 171 · Independent owner review request preparation
            </p>
            <h3 id="device-review-heading">
              Which screens still need attention?
            </h3>
          </div>
        </div>
        <p className="ops-inline-note">
          Test these widths in a browser or on actual devices. Record the screen
          and correction needed, then manually retest after any fix. Check
          scenario filters, evidence readback, contrast and larger text. A
          simulated viewport does not prove the experience on a physical device.
        </p>
        <div
          className="camp-device-review__queue"
          aria-labelledby="retest-queue-heading"
        >
          <div className="ops-section-heading">
            <div>
              <h3 id="retest-queue-heading">Manual device retest worklist</h3>
              <p>
                {outstanding.length} need attention · {observed.length}{" "}
                owner-observed corrections ·{" "}
                {deviceChecks.length - outstanding.length - observed.length} not
                flagged
              </p>
            </div>
            <label htmlFor="device-retest-filter">
              Queue view
              <select
                id="device-retest-filter"
                value={retestFilter}
                onChange={(event) =>
                  setRetestFilter(event.target.value as typeof retestFilter)
                }
              >
                <option value="open">Needs attention</option>
                <option value="all">All flagged devices</option>
                <option value="observed">Owner-observed as corrected</option>
              </select>
            </label>
          </div>
          {queueVisible.length ? (
            <ul className="camp-device-review__queue-list">
              {queueVisible.map((item) => (
                <li key={item.key}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.retest === "still_fails"
                      ? "Still fails · correction needed"
                      : item.retest === "looks_fixed"
                        ? "Owner observed correction · not independently approved"
                        : "Manual retest not recorded"}
                  </span>
                  <small>
                    {deviceCorrections[item.key]?.trim() ||
                      "No screen/correction description entered"}
                  </small>
                  <a href={`#device-result-${item.key}`}>Open device check ↗</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-inline-note">
              No device checks match this queue. Record an issue or screen
              correction below to add a retest item.
            </p>
          )}
          <p className="ops-inline-note">
            The queue is based on notes in this browser. An owner-observed fix
            is not automatic acceptance or an independent physical-device test.
          </p>
        </div>
        <div className="camp-device-review__grid">
          {deviceChecks.map((device) => (
            <div className="camp-device-review__item" key={device.key}>
              <strong>{device.label}</strong>
              <small>{device.guidance}</small>
              <label htmlFor={`device-result-${device.key}`}>
                Review result
              </label>
              <select
                id={`device-result-${device.key}`}
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
              <label htmlFor={`device-correction-${device.key}`}>
                Screen and correction needed
              </label>
              <textarea
                id={`device-correction-${device.key}`}
                rows={3}
                maxLength={1000}
                value={deviceCorrections[device.key] ?? ""}
                onChange={(event) =>
                  setDeviceCorrections((state) => ({
                    ...state,
                    [device.key]: event.target.value,
                  }))
                }
                placeholder="Example: Forecast filter wraps over Apply at 200% zoom…"
              />
              <label htmlFor={`device-retest-${device.key}`}>
                Manual correction retest
              </label>
              <select
                id={`device-retest-${device.key}`}
                value={deviceRetests[device.key] ?? "not_retested"}
                onChange={(event) =>
                  setDeviceRetests((state) => ({
                    ...state,
                    [device.key]: event.target.value as DeviceRetest,
                  }))
                }
              >
                <option value="not_retested">Not retested</option>
                <option value="looks_fixed">
                  Looks corrected on this device
                </option>
                <option value="still_fails">Still needs correction</option>
              </select>
            </div>
          ))}
        </div>
      </div>
      <div
        className="camp-theme-review__accessibility"
        aria-labelledby="owner-accessibility-heading"
      >
        <div className="ops-section-heading">
          <div>
            <p className="eyebrow">
              Build 171 · Owner accessibility closure readiness
            </p>
            <h3 id="owner-accessibility-heading">
              Accessibility retest summary
            </h3>
            <p role="status">
              {accessibilityPassed} passed · {accessibilityIssues} need
              correction ·{" "}
              {accessibilityChecks.length -
                accessibilityPassed -
                accessibilityIssues}{" "}
              not yet tested
            </p>
          </div>
        </div>
        <p className="ops-inline-note">
          Retest these interactions manually on real screens and devices. The
          results are owner observations only—not automated WCAG certification
          or production authorization.
        </p>
        <div
          className="camp-theme-review__followup"
          aria-labelledby="accessibility-followup-heading"
        >
          <div className="ops-section-heading">
            <div>
              <h4 id="accessibility-followup-heading">
                Manual accessibility acceptance follow-up queue
              </h4>
              <p role="status">
                {acceptanceOutstanding.length} require owner review ·{" "}
                {accessibilityIssues} observed failures · {accessibilityPassed}{" "}
                owner-observed passes
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const lines = [
                  "iCamp Build 170 — Local owner accessibility follow-up (manual observations only)",
                  ...acceptanceQueue.map(
                    (item) =>
                      `${item.title} | ${item.result} | ${item.priority} | ${item.followUp} | next: ${item.nextStep || "not assigned"}`,
                  ),
                  "Owner-entered outcomes are not independent WCAG certification or formal production sign-off.",
                ];
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  setCopyState(
                    "Accessibility follow-up copied locally. No approval, message or case was sent.",
                  );
                } catch {
                  setCopyState(
                    "Clipboard unavailable. Use the visible follow-up queue and review summary.",
                  );
                }
              }}
            >
              Copy accessibility follow-up handoff
            </button>
          </div>
          <ol>
            {acceptanceQueue.map((item) => (
              <li key={item.key}>
                <strong>{item.title}</strong> ·{" "}
                {item.result.replaceAll("_", " ")} · {item.priority} ·{" "}
                {item.followUp.replaceAll("_", " ")}
                <small>
                  {item.nextStep ||
                    "Next correction or owner retest not recorded"}
                </small>
                <a href={`#owner-accessibility-${item.key}`}>Review check ↗</a>
              </li>
            ))}
          </ol>
          <p className="ops-inline-note">
            A self-reported retest does not close an issue or signify formal
            owner accessibility acceptance. Confirm manually on real devices and
            obtain any required independent sign-off.
          </p>
        </div>
        <div
          className="camp-theme-review__readiness"
          aria-labelledby="owner-closure-readiness-heading"
        >
          <div className="ops-section-heading">
            <div>
              <p className="eyebrow">
                Build 171 · Independent owner acceptance request preflight
              </p>
              <h4 id="owner-closure-readiness-heading">
                Owner accessibility closure readiness
              </h4>
              <p role="status">
                {closureReadiness.canRequestIndependentReview
                  ? "Local walkthrough complete — request separate independent owner sign-off"
                  : `${closureReadiness.blockers.length} review item(s) still open — not ready for independent sign-off request`}
              </p>
              <small>
                {closureReadiness.areasReviewed}/{closureReadiness.totalAreas}{" "}
                screens · {closureReadiness.devicePasses}/
                {closureReadiness.totalDevices} devices ·{" "}
                {closureReadiness.accessibilityPasses}/
                {closureReadiness.totalAccessibility} accessibility checks
                observed as passing
              </small>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const lines = [
                  "iCamp Build 170 — Owner closure readiness handoff (NOT APPROVAL)",
                  `Reviewed screens ${closureReadiness.areasReviewed}/${closureReadiness.totalAreas}; devices ${closureReadiness.devicePasses}/${closureReadiness.totalDevices}; accessibility ${closureReadiness.accessibilityPasses}/${closureReadiness.totalAccessibility}`,
                  `Ready to request separate independent owner sign-off: ${closureReadiness.canRequestIndependentReview ? "yes, local walkthrough only" : "no"}`,
                  ...closureReadiness.blockers.map((item) => `Open: ${item}`),
                  "No formal owner approval, WCAG certification, production authorization or integration activation is recorded here.",
                ];
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  setCopyState(
                    "Owner closure readiness handoff copied locally. Nothing was approved or submitted.",
                  );
                } catch {
                  setCopyState(
                    "Clipboard blocked. Readiness findings remain visible below.",
                  );
                }
              }}
            >
              Copy closure readiness handoff
            </button>
          </div>
          {closureReadiness.blockers.length ? (
            <details>
              <summary>
                Review {closureReadiness.blockers.length} outstanding
                walkthrough items
              </summary>
              <ul>
                {closureReadiness.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="ops-inline-note">
              All required browser-local checks were marked complete. An
              independent owner must still inspect the actual screens and
              explicitly authorize any formal acceptance outside this checklist.
            </p>
          )}
        </div>
        <div
          className="camp-theme-review__readiness"
          aria-labelledby="owner-independent-request-heading"
        >
          <div className="ops-section-heading">
            <div>
              <p className="eyebrow">
                Build 171 · Manual handoff only · No owner sign-off recorded
              </p>
              <h4 id="owner-independent-request-heading">
                Prepare independent owner acceptance request
              </h4>
              <p role="status">
                {independentRequest.ready
                  ? "Ready to copy a draft request for a separate independent reviewer."
                  : `${independentRequest.blockers.length} local review blockers; request not yet available.`}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={!independentRequest.ready}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    prepareIndependentOwnerAcceptanceRequest(
                      reviewInputs,
                      new Date(),
                    ).text,
                  );
                  setCopyState(
                    "Draft independent review request copied. We did not submit, approve or send anything.",
                  );
                } catch {
                  setCopyState(
                    "Clipboard blocked; the read-only request preview remains below for manual copying.",
                  );
                }
              }}
            >
              Copy independent review request draft
            </button>
          </div>
          <p className="ops-inline-note">
            A separate authorized reviewer must inspect real devices and record
            a decision outside this browser-local worksheet. This button never
            creates an approval, submits a workflow, or enables an integration.
          </p>
          <textarea
            readOnly
            rows={5}
            aria-label="Independent owner review request preview"
            value={independentRequest.text}
          />
        </div>
        <div className="camp-theme-review__accessibility-grid">
          {accessibilityChecks.map((item) => (
            <div
              className="camp-theme-review__accessibility-item"
              key={item.key}
            >
              <strong>{item.title}</strong>
              <small>{item.guidance}</small>
              <label htmlFor={`owner-accessibility-${item.key}`}>
                Manual retest result
              </label>
              <select
                id={`owner-accessibility-${item.key}`}
                value={accessibilityResults[item.key] ?? "not_tested"}
                onChange={(event) =>
                  setAccessibilityResults((state) => ({
                    ...state,
                    [item.key]: event.target.value as AccessibilityResult,
                  }))
                }
              >
                <option value="not_tested">Not tested</option>
                <option value="passed">Passed in owner review</option>
                <option value="needs_fix">Needs correction</option>
              </select>
              <label htmlFor={`owner-accessibility-note-${item.key}`}>
                Observed screen / next correction
              </label>
              <textarea
                id={`owner-accessibility-note-${item.key}`}
                rows={2}
                maxLength={350}
                value={accessibilityNotes[item.key] ?? ""}
                onChange={(event) =>
                  setAccessibilityNotes((state) => ({
                    ...state,
                    [item.key]: event.target.value,
                  }))
                }
                placeholder="Record the screen and what our team should retest…"
              />
              <label htmlFor={`owner-accessibility-priority-${item.key}`}>
                Follow-up priority
              </label>
              <select
                id={`owner-accessibility-priority-${item.key}`}
                value={accessibilityPriorities[item.key] ?? "normal"}
                onChange={(event) =>
                  setAccessibilityPriorities((state) => ({
                    ...state,
                    [item.key]: event.target.value as AccessibilityPriority,
                  }))
                }
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent owner review</option>
              </select>
              <label htmlFor={`owner-accessibility-followup-${item.key}`}>
                Manual follow-up state
              </label>
              <select
                id={`owner-accessibility-followup-${item.key}`}
                value={accessibilityFollowUps[item.key] ?? "open"}
                onChange={(event) =>
                  setAccessibilityFollowUps((state) => ({
                    ...state,
                    [item.key]: event.target.value as AccessibilityFollowUp,
                  }))
                }
              >
                <option value="open">Open for review</option>
                <option value="planned">Correction or retest planned</option>
                <option value="owner_retested">
                  Owner manually retested (not accepted)
                </option>
              </select>
              <label htmlFor={`owner-accessibility-next-${item.key}`}>
                Next correction / owner follow-up
              </label>
              <textarea
                id={`owner-accessibility-next-${item.key}`}
                rows={2}
                maxLength={350}
                value={accessibilityNextSteps[item.key] ?? ""}
                onChange={(event) =>
                  setAccessibilityNextSteps((state) => ({
                    ...state,
                    [item.key]: event.target.value,
                  }))
                }
                placeholder="Record the affected screen, next action and what needs independent review…"
              />
            </div>
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
          className="secondary-button"
          onClick={() => {
            try {
              window.localStorage.setItem(
                retestStorageKey,
                JSON.stringify({
                  version: 2,
                  reviewedAreas: reviews
                    .filter((item) => checked[item.key])
                    .map((item) => item.key),
                  results: deviceChecks.map((item) => ({
                    key: item.key,
                    result: deviceResults[item.key] ?? "not_tested",
                    correction: (deviceCorrections[item.key] ?? "").slice(
                      0,
                      1000,
                    ),
                    retest: deviceRetests[item.key] ?? "not_retested",
                  })),
                  accessibility: accessibilityChecks.map((item) => ({
                    key: item.key,
                    result: accessibilityResults[item.key] ?? "not_tested",
                    note: (accessibilityNotes[item.key] ?? "").slice(0, 350),
                    followUp: accessibilityFollowUps[item.key] ?? "open",
                    priority: accessibilityPriorities[item.key] ?? "normal",
                    nextStep: (accessibilityNextSteps[item.key] ?? "").slice(
                      0,
                      350,
                    ),
                  })),
                }),
              );
              setCopyState(
                "Device retest draft saved on this browser only. No approval was recorded.",
              );
            } catch {
              setCopyState(
                "Browser storage is unavailable. Copy your review summary instead.",
              );
            }
          }}
        >
          Save local retest draft
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            try {
              const raw = window.localStorage.getItem(retestStorageKey);
              if (!raw || raw.length > 8_000) throw new Error("No valid draft");
              const parsed: unknown = JSON.parse(raw);
              if (
                !parsed ||
                typeof parsed !== "object" ||
                !("version" in parsed) ||
                ![1, 2].includes(parsed.version as number) ||
                !("results" in parsed) ||
                !Array.isArray(parsed.results)
              )
                throw new Error("Invalid draft");
              const results: Record<string, DeviceResult> = {};
              const corrections: Record<string, string> = {};
              const retests: Record<string, DeviceRetest> = {};
              for (const device of deviceChecks) {
                const item = parsed.results.find(
                  (entry: unknown) =>
                    entry &&
                    typeof entry === "object" &&
                    "key" in entry &&
                    entry.key === device.key,
                );
                if (!item) continue;
                results[device.key] = (
                  ["not_tested", "passed", "issue"].includes(item.result)
                    ? item.result
                    : "not_tested"
                ) as DeviceResult;
                corrections[device.key] =
                  typeof item.correction === "string"
                    ? item.correction.slice(0, 1000)
                    : "";
                retests[device.key] = (
                  ["not_retested", "looks_fixed", "still_fails"].includes(
                    item.retest,
                  )
                    ? item.retest
                    : "not_retested"
                ) as DeviceRetest;
              }
              setDeviceResults(results);
              setDeviceCorrections(corrections);
              setDeviceRetests(retests);
              const accessResults: Record<string, AccessibilityResult> = {};
              const accessNotes: Record<string, string> = {};
              const accessFollowUps: Record<string, AccessibilityFollowUp> = {};
              const accessPriorities: Record<string, AccessibilityPriority> =
                {};
              const accessNextSteps: Record<string, string> = {};
              const accessibilityDraft =
                "accessibility" in parsed && Array.isArray(parsed.accessibility)
                  ? parsed.accessibility
                  : [];
              for (const item of accessibilityChecks) {
                const entry = accessibilityDraft.find(
                  (candidate: unknown) =>
                    candidate &&
                    typeof candidate === "object" &&
                    "key" in candidate &&
                    candidate.key === item.key,
                );
                if (!entry) continue;
                accessResults[item.key] = (
                  ["not_tested", "passed", "needs_fix"].includes(entry.result)
                    ? entry.result
                    : "not_tested"
                ) as AccessibilityResult;
                accessNotes[item.key] =
                  typeof entry.note === "string"
                    ? entry.note.slice(0, 350)
                    : "";
                accessFollowUps[item.key] = (
                  ["open", "planned", "owner_retested"].includes(entry.followUp)
                    ? entry.followUp
                    : "open"
                ) as AccessibilityFollowUp;
                accessPriorities[item.key] = (
                  ["normal", "urgent"].includes(entry.priority)
                    ? entry.priority
                    : "normal"
                ) as AccessibilityPriority;
                accessNextSteps[item.key] =
                  typeof entry.nextStep === "string"
                    ? entry.nextStep.slice(0, 350)
                    : "";
              }
              setAccessibilityResults(accessResults);
              setAccessibilityNotes(accessNotes);
              setAccessibilityFollowUps(accessFollowUps);
              setAccessibilityPriorities(accessPriorities);
              setAccessibilityNextSteps(accessNextSteps);
              const reviewedDraft =
                "reviewedAreas" in parsed && Array.isArray(parsed.reviewedAreas)
                  ? parsed.reviewedAreas
                  : [];
              setChecked(
                Object.fromEntries(
                  reviews.map((item) => [
                    item.key,
                    reviewedDraft.includes(item.key),
                  ]),
                ),
              );
              setCopyState(
                "Browser-local retest draft and screen checklist restored. Verify them against the current screens before requesting independent review.",
              );
            } catch {
              setCopyState(
                "No usable local retest draft was found. Current review notes remain unchanged.",
              );
            }
          }}
        >
          Load local retest draft
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            try {
              window.localStorage.removeItem(retestStorageKey);
              setCopyState(
                "Saved browser-local retest draft deleted. Current session notes remain visible.",
              );
            } catch {
              setCopyState("Unable to clear the saved browser draft.");
            }
          }}
        >
          Delete saved retest draft
        </button>
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
            setDeviceCorrections({});
            setDeviceRetests({});
            setAccessibilityResults({});
            setAccessibilityNotes({});
            setAccessibilityFollowUps({});
            setAccessibilityPriorities({});
            setAccessibilityNextSteps({});
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
