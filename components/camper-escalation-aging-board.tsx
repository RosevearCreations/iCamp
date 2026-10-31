"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  summarizeAcknowledgementEvidence,
  summarizeAcknowledgementHandoff,
  summarizeEvidenceGapFollowUps,
  type EscalationAgingSummary,
} from "@/lib/command-centre/escalation-aging-core.mjs";
import {
  captureEscalationRecheckReceipt,
  createEscalationDeltaEvidenceHandoff,
  ESCALATION_SESSION_LIMIT,
  parseEscalationSnapshotSession,
  prioritizeEscalationRecheckDeltas,
  serializeEscalationSnapshotSession,
  type LocalRecheckReceipt,
} from "@/lib/command-centre/escalation-recheck-receipts-core.mjs";

const levels: Record<string, string> = {
  main_foreman: "Main foreman",
  manager: "Manager",
  owner: "Owner",
};
const evidenceLabels: Record<string, string> = {
  recorded: "Source timestamp recorded",
  pending: "Awaiting acknowledgment",
  missing_timestamp: "Acknowledged, timestamp missing",
  invalid_timestamp: "Source timestamp invalid",
  sequence_unknown: "Raised timestamp unavailable",
  state_conflict: "Open state conflicts with timestamp",
};

export function CamperEscalationAgingBoard({
  summary,
  campgroundId,
  userId,
}: {
  summary: EscalationAgingSummary;
  campgroundId: string;
  userId: string;
}) {
  const router = useRouter();
  const sessionKey = `icamp:escalation-observations:v1:${userId}:${campgroundId}`;
  const [filter, setFilter] = useState<
    | "all"
    | "over24"
    | "over72"
    | "unacknowledged"
    | "urgent"
    | "evidence_gap"
    | "unassigned_gap"
  >("all");
  const [search, setSearch] = useState("");
  const [handoffCopyStatus, setHandoffCopyStatus] = useState("");
  const [recheckReceipts, setRecheckReceipts] = useState<LocalRecheckReceipt[]>(
    [],
  );
  const [recheckStatus, setRecheckStatus] = useState("");
  const [rechecksLoaded, setRechecksLoaded] = useState(false);
  const [deltaHandoffFocus, setDeltaHandoffFocus] = useState<"triage" | "all">(
    "triage",
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setRecheckReceipts(
          parseEscalationSnapshotSession(
            window.sessionStorage.getItem(sessionKey),
            { userId, campgroundId },
          ),
        );
      } catch {
        setRecheckReceipts([]);
        setRecheckStatus(
          "This browser tab cannot retain source observations across refreshes.",
        );
      }
      setRechecksLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionKey, userId, campgroundId]);
  const handoff = useMemo(
    () => summarizeAcknowledgementHandoff(summary),
    [summary],
  );
  const evidence = useMemo(
    () => summarizeAcknowledgementEvidence(summary),
    [summary],
  );
  const followUps = useMemo(
    () => summarizeEvidenceGapFollowUps(summary),
    [summary],
  );
  const recheckDeltas = useMemo(
    () => prioritizeEscalationRecheckDeltas(recheckReceipts, summary),
    [recheckReceipts, summary],
  );
  const evidenceByEscalation = useMemo(
    () => new Map(evidence.records.map((item) => [item.escalationId, item])),
    [evidence],
  );
  const visible = useMemo(
    () =>
      summary.items.filter((item) => {
        if (filter === "over24" && !["over24", "over72"].includes(item.band))
          return false;
        if (filter === "over72" && item.band !== "over72") return false;
        if (filter === "unacknowledged" && item.state !== "open") return false;
        if (filter === "urgent" && item.severity !== "urgent") return false;
        if (
          filter === "evidence_gap" &&
          ["recorded", "pending"].includes(
            evidenceByEscalation.get(item.escalationId)?.status ?? "pending",
          )
        )
          return false;
        if (
          filter === "unassigned_gap" &&
          (item.assignedToLabel ||
            ["recorded", "pending"].includes(
              evidenceByEscalation.get(item.escalationId)?.status ?? "pending",
            ))
        )
          return false;
        const query = search.trim().toLowerCase();
        return (
          !query ||
          `${item.summary} ${item.siteCode} ${item.assignedToLabel ?? ""} ${item.level}`
            .toLowerCase()
            .includes(query)
        );
      }),
    [summary.items, filter, search, evidenceByEscalation],
  );
  const caseHref = (id: string) =>
    `/workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(campgroundId)}#assistance-case-${encodeURIComponent(id)}`;
  const captureRecheck = (escalationId: string) => {
    if (!rechecksLoaded) return;
    try {
      const previous = recheckReceipts.find(
        (receipt) => receipt.escalationId === escalationId,
      );
      const receipt = captureEscalationRecheckReceipt(
        summary,
        escalationId,
        new Date(),
        previous,
      );
      const updated = [
        receipt,
        ...recheckReceipts.filter((item) => item.escalationId !== escalationId),
      ].slice(0, ESCALATION_SESSION_LIMIT);
      setRecheckReceipts(updated);
      try {
        window.sessionStorage.setItem(
          sessionKey,
          serializeEscalationSnapshotSession(updated, { userId, campgroundId }),
        );
        setRecheckStatus(
          "Scoped source readback retained in this browser tab for up to four hours. It is not a server receipt or closure proof.",
        );
      } catch {
        setRecheckStatus(
          "Readback retained only on this page; browser session storage is unavailable.",
        );
      }
    } catch (error) {
      setRecheckStatus(
        error instanceof Error
          ? error.message
          : "Could not capture a source observation.",
      );
    }
  };
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
      <div
        className="camp-aging__evidence"
        aria-labelledby="evidence-readback-heading"
      >
        <div>
          <p className="eyebrow">Read-only source event readback</p>
          <h3 id="evidence-readback-heading">Acknowledgment evidence status</h3>
          <p>
            {evidence.recordedCount} with a chronologically valid source
            timestamp · {evidence.pendingCount} pending · {evidence.gapCount}{" "}
            with missing or conflicting source evidence
          </p>
          <small>
            Timestamps reflect the source triage database only. They are not an
            independent witness receipt, notification delivery or case closure.
          </small>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setFilter("evidence_gap")}
        >
          Show evidence gaps
        </button>
      </div>
      <div
        className="camp-aging__followup"
        aria-labelledby="gap-followup-heading"
      >
        <div className="ops-section-heading">
          <div>
            <p className="eyebrow">
              Build 171 · Source snapshot continuity and delta handoff
            </p>
            <h3 id="gap-followup-heading">
              {followUps.count} source discrepancies to review
            </h3>
            <p>
              {followUps.urgentCount} urgent · {followUps.unassignedCount}{" "}
              unassigned · {followUps.unknownAgeCount} with unknown age
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setFilter("unassigned_gap")}
          >
            Show unassigned gaps
          </button>
        </div>
        <div className="camp-aging__recheck-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              router.refresh();
              setRecheckStatus(
                "Requested a fresh authorized source read. Once updated, capture the observed status below; refresh alone is not proof of resolution.",
              );
            }}
          >
            Refresh authorized source readback
          </button>
          <small>
            Source snapshot UTC: {summary.generatedAt}. Recheck receipts are
            temporary observations scoped to this user/campground in the current
            browser tab for at most four hours, not signed acknowledgments.
            Refresh to compare against newly authorized source data. Closing the
            tab removes session-only snapshots.
          </small>
        </div>
        {followUps.count ? (
          <>
            <div className="camp-aging__followup-list">
              {followUps.items.map((item) => (
                <div
                  className="camp-aging__followup-item"
                  key={item.escalationId}
                >
                  <div>
                    <strong>
                      {item.siteCode} · {evidenceLabels[item.status]}
                    </strong>
                    <small>
                      {item.severity} · {item.assignedToLabel ?? "Unassigned"} ·{" "}
                      {item.band.replaceAll("over", "over ")}
                    </small>
                    <small>{item.guidance}</small>
                    <small>Source escalation: {item.escalationId}</small>
                  </div>
                  <Link href={caseHref(item.caseId)}>Review in triage ↗</Link>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!rechecksLoaded}
                    onClick={() => captureRecheck(item.escalationId)}
                  >
                    Record source readback
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const lines = [
                  "iCamp Build 167 — Source evidence gap follow-up (read-only)",
                  `Generated from source: ${summary.generatedAt}`,
                  ...followUps.items.map(
                    (item) =>
                      `${item.siteCode} | case ${item.caseId} | escalation ${item.escalationId} | ${item.status} | ${item.assignedToLabel ?? "unassigned"} | ${item.guidance}`,
                  ),
                  "Recheck original triage records. This is neither an acknowledgment nor independent evidence of closure.",
                ];
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  setHandoffCopyStatus(
                    "Source follow-up handoff copied locally. No message was sent and no case changed.",
                  );
                } catch {
                  setHandoffCopyStatus(
                    "Clipboard blocked. Use the visible source-linked list to review these gaps.",
                  );
                }
              }}
            >
              Copy follow-up handoff
            </button>
          </>
        ) : (
          <p className="ops-inline-note">
            No acknowledgment timestamp discrepancies in the active source
            readback. Pending acknowledgment remains a separate queue.
          </p>
        )}
        {recheckReceipts.length ? (
          <div
            className="camp-aging__recheck-receipts"
            aria-labelledby="recheck-receipts-heading"
          >
            <h4 id="recheck-receipts-heading">
              Prioritized recheck delta worklist ({recheckDeltas.count})
            </h4>
            <p className="ops-inline-note">
              {recheckDeltas.needsTriageCount} require source triage ·{" "}
              {recheckDeltas.newSnapshotCount} have a newer unchanged source
              snapshot. Highest-priority changes and records missing from the
              active source appear first. A changed source status is only an
              observation.{" "}
              {"Missing from active source: not independent closure proof."}
            </p>
            <div
              className="camp-aging__delta-handoff"
              aria-labelledby="delta-handoff-heading"
            >
              <h4 id="delta-handoff-heading">
                Source-pinned delta evidence handoff
              </h4>
              <p className="ops-inline-note">
                Current source UTC: {summary.generatedAt}. Include captured and
                current source evidence statuses with a direct triage path. This
                is a local clipboard handoff, not a sent notification or proof
                of closure.
              </p>
              <div className="camp-aging__delta-handoff-actions">
                <label htmlFor="delta-handoff-focus">
                  Evidence handoff selection
                  <select
                    id="delta-handoff-focus"
                    value={deltaHandoffFocus}
                    onChange={(event) =>
                      setDeltaHandoffFocus(
                        event.target.value as typeof deltaHandoffFocus,
                      )
                    }
                  >
                    <option value="triage">
                      Changed / missing active source only
                    </option>
                    <option value="all">
                      All captured source observations
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      const handoff = createEscalationDeltaEvidenceHandoff(
                        summary,
                        recheckDeltas,
                        campgroundId,
                        deltaHandoffFocus,
                      );
                      if (!handoff.selectedCount) {
                        setRecheckStatus(
                          "No captured source deltas match this handoff selection. Capture or select an observation first.",
                        );
                        return;
                      }
                      await navigator.clipboard.writeText(handoff.text);
                      setRecheckStatus(
                        `${handoff.selectedCount} source-pinned delta observation(s) copied locally; no case or external evidence was changed.`,
                      );
                    } catch {
                      setRecheckStatus(
                        "Could not copy the source-pinned handoff. Review the visible source status and triage links.",
                      );
                    }
                  }}
                >
                  Copy source-pinned delta evidence handoff
                </button>
              </div>
            </div>
            <div className="camp-occupancy__table-scroll">
              <table className="camp-occupancy__table">
                <caption>
                  Operator-captured observations, ordered by source delta
                  urgency; not independent proof
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Source escalation</th>
                    <th scope="col">Prior → observed status</th>
                    <th scope="col">Latest source delta and priority</th>
                    <th scope="col">Source read at UTC</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recheckDeltas.items.map((receipt) => {
                    const current = evidenceByEscalation.get(
                      receipt.escalationId,
                    );
                    const refreshed =
                      receipt.sourceObservedAt !== summary.generatedAt;
                    return (
                      <tr key={receipt.escalationId}>
                        <th scope="row">
                          {receipt.escalationId}
                          <small>
                            Operator note: {receipt.operatorRecordedAt}
                          </small>
                        </th>
                        <td>
                          {receipt.previousStatus ?? "First readback"} →{" "}
                          {receipt.status}
                          <small>{receipt.change}</small>
                        </td>
                        <td>
                          <strong>{receipt.kind.replaceAll("_", " ")}</strong>
                          <small>
                            {receipt.currentStatus ?? "Not in active source"} ·{" "}
                            {receipt.severity} ·{" "}
                            {receipt.assignedToLabel ?? "unassigned"}
                          </small>
                          <small>{receipt.guidance}</small>
                        </td>
                        <td>{receipt.sourceObservedAt}</td>
                        <td className="camp-aging__recheck-row-actions">
                          <Link href={caseHref(receipt.caseId)}>
                            Inspect triage ↗
                          </Link>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!rechecksLoaded || !refreshed || !current}
                            onClick={() => captureRecheck(receipt.escalationId)}
                          >
                            Capture refreshed source
                          </button>
                          {!current ? (
                            <small>
                              Not in active source readback; investigate before
                              claiming closure.
                            </small>
                          ) : !refreshed ? (
                            <small>Refresh source to recheck.</small>
                          ) : (
                            <small>New source snapshot available.</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const lines = [
                  "iCamp Build 171 — Session-scoped source snapshot continuity (NOT independent proof)",
                  ...recheckDeltas.items.map(
                    (item) =>
                      `${item.escalationId} | case ${item.caseId} | ${item.kind} | ${item.guidance} | ${item.status} → current ${item.currentStatus ?? "not in active source"} | source observed ${item.sourceObservedAt} | operator noted ${item.operatorRecordedAt}`,
                  ),
                  "No case, acknowledgment, external receipt, notification or closure was written.",
                ];
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  setRecheckStatus(
                    "Local recheck observations copied; no message was sent.",
                  );
                } catch {
                  setRecheckStatus(
                    "Clipboard blocked; readbacks remain visible on this page.",
                  );
                }
              }}
            >
              Copy local recheck receipts
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setRecheckReceipts([]);
                try {
                  window.sessionStorage.removeItem(sessionKey);
                  setRecheckStatus(
                    "This tab's scoped source snapshots were cleared; original cases are unchanged.",
                  );
                } catch {
                  setRecheckStatus(
                    "Page observations cleared. Browser session storage could not be cleared; end the tab session to remove its copy.",
                  );
                }
              }}
            >
              Clear local recheck receipts
            </button>
          </div>
        ) : null}
        {recheckStatus ? (
          <p role="status" className="ops-inline-note">
            {recheckStatus}
          </p>
        ) : null}
        {handoffCopyStatus ? (
          <p role="status" className="ops-inline-note">
            {handoffCopyStatus}
          </p>
        ) : null}
        <p className="ops-inline-note">
          Follow-up is a review prompt only: no ticket, notification,
          assignment, acknowledgment, closure or independent proof receipt has
          been created.
        </p>
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
            <option value="evidence_gap">Acknowledgment evidence gaps</option>
            <option value="unassigned_gap">Unassigned evidence gaps</option>
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
              <th scope="col">Evidence readback</th>
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
                  <strong>
                    {
                      evidenceLabels[
                        evidenceByEscalation.get(item.escalationId)?.status ??
                          "pending"
                      ]
                    }
                  </strong>
                  <small>
                    Acknowledged:{" "}
                    {evidenceByEscalation.get(item.escalationId)?.status ===
                    "recorded"
                      ? new Date(item.acknowledgedAt!).toLocaleString("en-CA", {
                          timeZone: "UTC",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }) + " UTC"
                      : "Not verifiably recorded"}
                  </small>
                  <small>Source escalation: {item.escalationId}</small>
                </td>
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
        source after acting. Missing timestamps and conflicts require staff
        source review; no synthetic evidence is supplied. No SMS, calls or
        Omnichannel dispatch happen from this report.
      </p>
    </section>
  );
}
