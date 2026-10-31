"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ResolutionTimelineSummary } from "@/lib/command-centre/resolution-timeline-core.mjs";

export function CamperResolutionTimeline({
  summary,
  campgroundId,
}: {
  summary: ResolutionTimelineSummary;
  campgroundId: string;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "urgent">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      summary.entries.filter((item) => {
        if (filter === "open" && item.caseState === "closed") return false;
        if (filter === "closed" && item.caseState !== "closed") return false;
        if (
          filter === "urgent" &&
          (item.severity !== "urgent" || item.caseState === "closed")
        )
          return false;
        const query = search.trim().toLowerCase();
        return (
          !query ||
          `${item.summary} ${item.accommodationCode} ${item.assignedToLabel ?? ""} ${item.outcomeCode ?? ""}`
            .toLowerCase()
            .includes(query)
        );
      }),
    [summary.entries, filter, search],
  );
  const recent = visible.slice(0, 60);
  const selected =
    recent.find((item) => item.id === selectedId) ?? recent[0] ?? null;
  const triageHref = selected
    ? `/workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(campgroundId)}#assistance-case-${encodeURIComponent(selected.id)}`
    : null;
  return (
    <section
      className="content-panel ops-detail-card camp-resolution"
      aria-labelledby="resolution-timeline-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Read-only case history · Source-linked</p>
          <h2 id="resolution-timeline-heading">Camper resolution timeline</h2>
        </div>
        <Link
          href={`/workspaces/management/command/assistance?campground=${encodeURIComponent(campgroundId)}`}
        >
          Assistance board ↗
        </Link>
      </div>
      <p className="ops-inline-note">
        This timeline is compiled from real camper requests, case changes and
        recorded staff events. It never sends a message or updates a case.
      </p>
      <div className="camp-command__filters">
        <label>
          Find a case
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Site, problem, staff or outcome…"
          />
        </label>
        <label>
          Case status
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">All cases</option>
            <option value="open">Not closed</option>
            <option value="closed">Closed cases</option>
            <option value="urgent">Urgent and open</option>
          </select>
        </label>
      </div>
      <p className="camp-assistance__summary" role="status" aria-live="polite">
        Showing {recent.length} of {visible.length} matching cases (latest 60 by
        case update) · {summary.count} campground cases total
      </p>
      <div className="camp-resolution__layout">
        <div
          className="camp-resolution__cases"
          aria-label="Select a camper case"
        >
          {recent.map((item) => (
            <button
              key={item.id}
              className="camp-resolution__case"
              type="button"
              aria-pressed={item.id === selected?.id}
              onClick={() => setSelectedId(item.id)}
            >
              <span>
                <strong>{item.accommodationCode}</strong>
                <span
                  className={`camp-assistance__severity camp-assistance__severity--${item.severity}`}
                >
                  {item.severity}
                </span>
              </span>
              <b>{item.summary}</b>
              <small>
                {item.caseState.replaceAll("_", " ")} ·{" "}
                {item.durationHours != null
                  ? `${item.durationHours} h to close`
                  : "Resolution duration not yet available"}
              </small>
            </button>
          ))}
          {!recent.length ? (
            <p className="ops-inline-note">
              No matching cases. Change the filters to continue.
            </p>
          ) : null}
        </div>
        <div
          className="camp-resolution__detail"
          aria-label="Case event history"
          aria-live="polite"
          aria-atomic="false"
        >
          {selected ? (
            <>
              <div className="ops-section-heading">
                <div>
                  <p className="eyebrow">
                    {selected.accommodationCode} ·{" "}
                    {selected.caseState.toUpperCase()}
                  </p>
                  <h3>{selected.summary}</h3>
                </div>
                {triageHref ? (
                  <Link className="primary-link" href={triageHref}>
                    Open case actions ↗
                  </Link>
                ) : null}
              </div>
              <dl className="camp-resolution__facts">
                <div>
                  <dt>Submitted</dt>
                  <dd>
                    {selected.submittedAt?.replace("T", " ").slice(0, 16) ??
                      "Unavailable"}{" "}
                    UTC
                  </dd>
                </div>
                <div>
                  <dt>Assigned</dt>
                  <dd>{selected.assignedToLabel ?? "Not assigned"}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>
                    {selected.durationHours != null
                      ? `${selected.durationHours} hours`
                      : "Not measured"}
                  </dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>
                    {selected.outcomeCode?.replaceAll("_", " ") ??
                      "Open / not recorded"}
                  </dd>
                </div>
              </dl>
              {selected.caseState === "closed" &&
              !selected.closureEventPresent ? (
                <p className="camp-resolution__warning" role="status">
                  The case has a closed status but no matching closure event in
                  the returned history. Review the source record.
                </p>
              ) : null}
              <ol
                className="camp-resolution__events"
                aria-label="Chronological case events"
              >
                {selected.submittedAt ? (
                  <li>
                    <span
                      className="camp-resolution__marker"
                      aria-hidden="true"
                    />
                    <div>
                      <strong>Request submitted</strong>
                      <time dateTime={selected.submittedAt}>
                        {selected.submittedAt.replace("T", " ").slice(0, 16)}{" "}
                        UTC
                      </time>
                      <p>Camper request received by iCamp.</p>
                    </div>
                  </li>
                ) : null}
                {selected.events.map((event) => (
                  <li key={event.id}>
                    <span
                      className="camp-resolution__marker"
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{event.kind.replaceAll("_", " ")}</strong>
                      <time dateTime={event.occurredAt}>
                        {event.occurredAt.replace("T", " ").slice(0, 16)} UTC
                      </time>
                      <p>{event.summary}</p>
                      <small>
                        {event.actor} · {event.sourceChannel}
                      </small>
                    </div>
                  </li>
                ))}
                {!selected.submittedAt && !selected.events.length ? (
                  <li>
                    <p>No timestamped history is available for this case.</p>
                  </li>
                ) : null}
              </ol>
            </>
          ) : (
            <p role="status">No case selected for this filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
