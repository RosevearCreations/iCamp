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
    key: "assistance",
    title: "Camper assistance",
    detail:
      "Case cards, filter/search, owner/staff triage handoff and readable inspector",
    href: "/workspaces/management/command/assistance",
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
] as const;

export function StandardThemeOwnerReview() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [copyState, setCopyState] = useState("");
  const done = useMemo(
    () => reviews.filter((item) => checked[item.key]).length,
    [checked],
  );
  const summary = () =>
    [
      "iCamp Build 162 — Standard Theme Owner Walkthrough",
      `Reviewed: ${done}/${reviews.length} areas`,
      ...reviews.map(
        (item) =>
          `${checked[item.key] ? "[reviewed]" : "[not yet reviewed]"} ${item.title}`,
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
