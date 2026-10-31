"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type BoardCase = {
  id: string;
  summary: string;
  caseState: string;
  category: string;
  severity: string;
  accommodationCode: string;
  submittedAt: string | null;
  assignedToLabel: string | null;
  activeEscalationLevel: string | null;
  mediaCount: number;
};

const columns = [
  { state: "new", title: "New", note: "Awaiting first review" },
  { state: "triaged", title: "Triaged", note: "Classified and ready" },
  { state: "assigned", title: "Assigned", note: "Staff follow-up" },
  { state: "escalated", title: "Escalated", note: "Management attention" },
  { state: "closed", title: "Closed", note: "Outcome recorded" },
] as const;

export function CamperAssistanceBoard({
  cases,
  campgroundId,
}: {
  cases: BoardCase[];
  campgroundId: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "urgent" | "unassigned" | "open"
  >("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      cases.filter((item) => {
        if (
          filter === "urgent" &&
          (item.severity !== "urgent" || item.caseState === "closed")
        )
          return false;
        if (
          filter === "unassigned" &&
          (item.assignedToLabel || item.caseState === "closed")
        )
          return false;
        if (filter === "open" && item.caseState === "closed") return false;
        const query = search.trim().toLowerCase();
        return (
          !query ||
          `${item.summary} ${item.category} ${item.accommodationCode} ${item.assignedToLabel ?? ""}`
            .toLowerCase()
            .includes(query)
        );
      }),
    [cases, filter, search],
  );
  const selected = cases.find((item) => item.id === selectedId) ?? null;
  const caseHref = (id: string) =>
    `/workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(campgroundId)}#assistance-case-${encodeURIComponent(id)}`;

  return (
    <section className="content-panel ops-detail-card camp-assistance">
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Guest service workflow · Source-linked</p>
          <h2>Camper assistance board</h2>
        </div>
        <Link
          href={`/workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(campgroundId)}`}
        >
          Open full triage desk ↗
        </Link>
      </div>
      <p className="camp-assistance__intro">
        Select a case to inspect its current status. All assignments, messages,
        escalation and closure actions remain in the existing permission-checked
        triage desk.
      </p>
      <div className="camp-command__filters">
        <label>
          Search cases
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Site, topic, staff or category…"
          />
        </label>
        <label>
          Quick filter
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="open">Open cases</option>
            <option value="urgent">Urgent</option>
            <option value="unassigned">Unassigned</option>
            <option value="all">All including closed</option>
          </select>
        </label>
      </div>
      <div className="camp-assistance__summary" role="status">
        Showing {visible.length} of {cases.length} cases · Read-only board
      </div>
      <div
        className="camp-assistance__board"
        aria-label="Camper assistance workflow columns"
      >
        {columns.map((column) => {
          const items = visible.filter(
            (item) => item.caseState === column.state,
          );
          return (
            <section
              className="camp-assistance__column"
              key={column.state}
              aria-label={`${column.title} cases`}
            >
              <div
                className={`camp-assistance__column-heading camp-assistance__column-heading--${column.state}`}
              >
                <h3>
                  {column.title} <span>{items.length}</span>
                </h3>
                <small>{column.note}</small>
              </div>
              <div className="camp-assistance__cards">
                {items.length ? (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-pressed={selected?.id === item.id}
                      className="camp-assistance__case"
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
                      <small>{item.category.replaceAll("_", " ")}</small>
                      <small>
                        {item.assignedToLabel
                          ? `Assigned: ${item.assignedToLabel}`
                          : "Awaiting assignment"}
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="camp-assistance__column-empty">
                    No matching cases
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {selected ? (
        <aside
          className="camp-assistance__inspector"
          aria-label="Selected case details"
        >
          <div className="ops-section-heading">
            <div>
              <p className="eyebrow">
                Selected case · {selected.accommodationCode}
              </p>
              <h3>{selected.summary}</h3>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setSelectedId(null)}
            >
              Close details
            </button>
          </div>
          <div className="camp-assistance__details">
            <div>
              <span>Workflow state</span>
              <strong>{selected.caseState}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{selected.severity}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{selected.category}</strong>
            </div>
            <div>
              <span>Assigned to</span>
              <strong>{selected.assignedToLabel ?? "Unassigned"}</strong>
            </div>
            <div>
              <span>Escalation</span>
              <strong>{selected.activeEscalationLevel ?? "None active"}</strong>
            </div>
            <div>
              <span>Evidence attachments</span>
              <strong>{selected.mediaCount}</strong>
            </div>
            <div>
              <span>Submitted</span>
              <strong>
                {selected.submittedAt?.slice(0, 16).replace("T", " ") ??
                  "Not recorded"}
              </strong>
            </div>
          </div>
          <Link className="primary-link" href={caseHref(selected.id)}>
            Open case, history and authorized actions ↗
          </Link>
        </aside>
      ) : (
        <p className="ops-inline-note">
          Choose a case card to review ownership, priority and escalation
          without changing any guest records.
        </p>
      )}
    </section>
  );
}
