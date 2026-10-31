"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  summarizeAcknowledgementHandoff,
  type EscalationAgingSummary,
} from "@/lib/command-centre/escalation-aging-core.mjs";

const levels: Record<string, string> = {
  main_foreman: "Main foreman",
  manager: "Manager",
  owner: "Owner",
};

export function CamperEscalationAgingBoard({
  summary,
  campgroundId,
}: {
  summary: EscalationAgingSummary;
  campgroundId: string;
}) {
  const [filter, setFilter] = useState<
    "all" | "over24" | "over72" | "unacknowledged" | "urgent"
  >("all");
  const [search, setSearch] = useState("");
  const handoff = useMemo(
    () => summarizeAcknowledgementHandoff(summary),
    [summary],
  );
  const visible = useMemo(
    () =>
      summary.items.filter((item) => {
        if (filter === "over24" && !["over24", "over72"].includes(item.band))
          return false;
        if (filter === "over72" && item.band !== "over72") return false;
        if (filter === "unacknowledged" && item.state !== "open") return false;
        if (filter === "urgent" && item.severity !== "urgent") return false;
        const query = search.trim().toLowerCase();
        return (
          !query ||
          `${item.summary} ${item.siteCode} ${item.assignedToLabel ?? ""} ${item.level}`
            .toLowerCase()
            .includes(query)
        );
      }),
    [summary.items, filter, search],
  );
  const caseHref = (id: string) =>
    `/workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(campgroundId)}#assistance-case-${encodeURIComponent(id)}`;
  return (
    <section
      className="content-panel ops-detail-card camp-aging"
      aria-labelledby="escalation-aging-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Original escalation records · Read-only</p>
          <h2 id="escalation-aging-heading">Camper escalation review queue</h2>
        </div>
        <Link
          href={`/workspaces/management/command/resolutions?campground=${encodeURIComponent(campgroundId)}`}
        >
          Resolution timeline ↗
        </Link>
      </div>
      <p className="ops-inline-note">
        24-hour and 72-hour bands are attention prompts, not contractual
        deadlines. Aging is measured from the original raised timestamp. A
        missing timestamp is shown as unknown, never as zero hours.
      </p>
      <div
        className="camp-aging__handoff"
        aria-labelledby="ack-handoff-heading"
      >
        <div>
          <p className="eyebrow">Acknowledgment handoff · Source-linked</p>
          <h3 id="ack-handoff-heading">
            {handoff.pendingCount} awaiting acknowledgment
          </h3>
          <p>
            {handoff.urgentCount} urgent · {handoff.attentionCount} in
            24/72-hour attention bands · {handoff.unassignedCount} unassigned ·{" "}
            {handoff.unknownAgeCount} with unknown age
          </p>
          {handoff.ambiguousCount ? (
            <p className="camp-resolution__warning" role="status">
              {handoff.ambiguousCount} pending case(s) have multiple active
              escalation records. Inspect the source record before acting.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setFilter("unacknowledged")}
        >
          Show acknowledgment queue
        </button>
      </div>
      <div className="camp-command__filters">
        <label>
          Find an escalation
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Site, case, staff or level…"
          />
        </label>
        <label>
          Aging filter
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">All active</option>
            <option value="over24">24+ hours</option>
            <option value="over72">72+ hours</option>
            <option value="unacknowledged">Not yet acknowledged</option>
            <option value="urgent">Urgent priority</option>
          </select>
        </label>
      </div>
      <p className="camp-assistance__summary" role="status" aria-live="polite">
        Showing {visible.length} of {summary.activeCount} active escalations ·
        no case changes made
      </p>
      {summary.multipleActive ? (
        <p role="status" className="camp-resolution__warning">
          {summary.multipleActive} case(s) have multiple active escalation
          records. The newest is shown, and the source desk should be reviewed.
        </p>
      ) : null}
      <div className="camp-occupancy__table-scroll">
        <table className="camp-occupancy__table camp-aging__table">
          <caption>Active camper escalations, oldest priority first</caption>
          <thead>
            <tr>
              <th scope="col">Site / case</th>
              <th scope="col">Escalation</th>
              <th scope="col">State</th>
              <th scope="col">Priority</th>
              <th scope="col">Time since raised</th>
              <th scope="col">Owner</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.escalationId}>
                <th scope="row">
                  <strong>{item.siteCode}</strong>
                  <small>{item.summary}</small>
                </th>
                <td>{levels[item.level] ?? item.level.replaceAll("_", " ")}</td>
                <td>
                  <span
                    className={`camp-aging__status camp-aging__status--${item.state}`}
                  >
                    {item.state === "open"
                      ? "Awaiting acknowledgment"
                      : "Acknowledged; unresolved"}
                  </span>
                </td>
                <td>{item.severity}</td>
                <td>
                  <strong
                    className={
                      item.band === "over72" ? "ops-text-hold" : undefined
                    }
                  >
                    {item.ageHours == null
                      ? "Unknown"
                      : `${item.ageHours} hours`}
                  </strong>
                  <small>
                    {item.band === "over72"
                      ? "72+ hour review"
                      : item.band === "over24"
                        ? "24+ hour review"
                        : item.band === "unknown"
                          ? "Missing source time"
                          : "Under 24 hours"}
                  </small>
                </td>
                <td>{item.assignedToLabel ?? "Unassigned"}</td>
                <td>
                  <Link href={caseHref(item.caseId)}>
                    {item.state === "open"
                      ? "Open triage to acknowledge ↗"
                      : "Review resolution in triage ↗"}
                  </Link>
                  {item.multipleActive ? (
                    <small>Verify active record first</small>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? (
        <p role="status" className="ops-inline-note">
          No active escalation matches these filters.
        </p>
      ) : null}
      <p className="ops-inline-note">
        The links open the existing campground-authorized triage desk, where
        acknowledgment requires the current source record and its version. A
        handoff is not proof that staff acknowledged anything; refresh the
        source after acting. No SMS, calls or Omnichannel dispatch happen from
        this report.
      </p>
    </section>
  );
}
