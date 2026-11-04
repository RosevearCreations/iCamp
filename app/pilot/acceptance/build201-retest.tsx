"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { BUILD200_JOURNEYS } from "@/lib/pilot/build200-pilot.mjs";
import {
  BUILD201_DEVICE_PROFILES,
  BUILD201_FINDING_STATES,
  BUILD201_MAX_FINDINGS,
  BUILD201_RETEST_SCHEMA,
  build201RetestPacket,
  importBuild201Retest,
  normalizeBuild201Findings,
  type Build201RetestFinding,
} from "@/lib/pilot/build201-retest.mjs";

const STORAGE_KEY = "icamp.build201.local-pilot-retest.v1";
const empty: Build201RetestFinding = {
  journey: BUILD200_JOURNEYS[0].id,
  device: "PHONE_TOUCH",
  state: "OPEN_FINDING",
  ticket_ref: "",
  evidence_ref: null,
};

export function Build201Retest() {
  const [entries, setEntries] = useState<Build201RetestFinding[]>([]);
  const [draft, setDraft] = useState<Build201RetestFinding>(empty);
  const [hydrated, setHydrated] = useState(false);
  const [shareText, setShareText] = useState("");
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    let restored: Build201RetestFinding[] = [];
    let failure = false;
    try {
      const previous = sessionStorage.getItem(STORAGE_KEY);
      if (previous)
        restored = importBuild201Retest(previous, BUILD200_JOURNEYS);
    } catch {
      failure = true;
    }
    queueMicrotask(() => {
      if (!active) return;
      setEntries(restored);
      if (failure)
        setMessage(
          "Previous tab notes could not be restored. Start a new local retest packet.",
        );
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ schema: BUILD201_RETEST_SCHEMA, rows: entries }),
      );
    } catch {
      queueMicrotask(() =>
        setMessage(
          "Session notes could not be saved on this device. Copy the packet before leaving.",
        ),
      );
    }
  }, [entries, hydrated]);

  function updateDraft(change: Partial<Build201RetestFinding>) {
    setDraft((previous) => ({ ...previous, ...change }));
    setMessage("");
  }

  function addFinding() {
    try {
      const next = normalizeBuild201Findings(
        [...entries, draft],
        BUILD200_JOURNEYS,
      );
      setEntries(next);
      setDraft(empty);
      setShareText("");
      setMessage("Finding retained in this tab only. No approval was issued.");
    } catch (error) {
      setMessage(
        `Not saved: ${error instanceof Error ? error.message.replaceAll("_", " ") : "invalid entry"}. Use an issue-/ticket-/review- reference, not guest data.`,
      );
    }
  }

  async function exportPacket() {
    try {
      const packet = await build201RetestPacket(entries, BUILD200_JOURNEYS);
      const output = JSON.stringify(packet, null, 2);
      setShareText(output);
      await navigator.clipboard.writeText(output);
      setMessage(
        "Unattested retest packet copied. Paste on the next device to import; no information was sent to the server.",
      );
    } catch {
      setMessage(
        "Packet prepared below, but the clipboard is unavailable. Select and copy it manually.",
      );
    }
  }

  function importPacket() {
    try {
      const imported = importBuild201Retest(importText, BUILD200_JOURNEYS);
      setEntries(imported);
      setShareText("");
      setImportText("");
      setMessage(
        "Sanitized review notes imported. Any claimed external sign-off was discarded; existing tab notes were replaced.",
      );
    } catch (error) {
      setMessage(
        `Import rejected: ${error instanceof Error ? error.message.replaceAll("_", " ") : "invalid packet"}. Existing notes were retained.`,
      );
    }
  }

  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="build201-retest-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Build 201 · recoverable local field review</p>
          <h2 id="build201-retest-title">
            Finding remediation &amp; real-device retest
          </h2>
        </div>
        <span className="ops-pill ops-pill--hold">
          Independent evidence required
        </span>
      </div>
      <p>
        Open workflows in a separate tab, record only non-sensitive issue and
        test receipt IDs, then mark a retest result. Notes recover after
        navigation or refresh in this tab session. Copy/import the sanitized
        packet to another device. A reported pass is <strong>not</strong> a
        witnessed device acceptance or go-live approval.
      </p>
      <div className="ops-kpi-grid">
        <article className="ops-kpi">
          <div>
            <span>Open and blocked findings</span>
            <strong>
              {
                entries.filter((entry) =>
                  [
                    "OPEN_FINDING",
                    "RETEST_FAILED",
                    "BLOCKED_EXTERNAL_EVIDENCE",
                  ].includes(entry.state),
                ).length
              }
            </strong>
            <small>Remain unresolved</small>
          </div>
        </article>
        <article className="ops-kpi">
          <div>
            <span>Owner-reported retest passes</span>
            <strong>
              {
                entries.filter(
                  (entry) => entry.state === "RETEST_REPORTED_PASS",
                ).length
              }
            </strong>
            <small>Independent witness still missing</small>
          </div>
        </article>
        <article className="ops-kpi">
          <div>
            <span>Evidence limit</span>
            <strong>
              {entries.length}/{BUILD201_MAX_FINDINGS}
            </strong>
            <small>Local IDs only; no personal details</small>
          </div>
        </article>
      </div>
      <div className="ops-split-grid">
        <div>
          <h3>Add a finding or retest</h3>
          <label htmlFor="build201-journey">Application journey</label>
          <select
            id="build201-journey"
            value={draft.journey}
            onChange={(event) => updateDraft({ journey: event.target.value })}
          >
            {BUILD200_JOURNEYS.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <label htmlFor="build201-device">
            Device or accessibility profile (owner-reported)
          </label>
          <select
            id="build201-device"
            value={draft.device}
            onChange={(event) => updateDraft({ device: event.target.value })}
          >
            {BUILD201_DEVICE_PROFILES.map((device) => (
              <option key={device} value={device}>
                {device.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <label htmlFor="build201-ticket">
            Issue or retest ticket reference
          </label>
          <input
            id="build201-ticket"
            maxLength={90}
            placeholder="issue-2026-00125"
            value={draft.ticket_ref}
            onChange={(event) =>
              updateDraft({ ticket_ref: event.target.value })
            }
          />
          <label htmlFor="build201-state">Observed outcome</label>
          <select
            id="build201-state"
            value={draft.state}
            onChange={(event) => updateDraft({ state: event.target.value })}
          >
            {BUILD201_FINDING_STATES.map((state) => (
              <option key={state} value={state}>
                {state.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <label htmlFor="build201-evidence">
            Non-sensitive evidence receipt (optional)
          </label>
          <input
            id="build201-evidence"
            maxLength={90}
            placeholder="receipt-2026-00125"
            value={draft.evidence_ref ?? ""}
            onChange={(event) =>
              updateDraft({ evidence_ref: event.target.value || null })
            }
          />
          <button
            className="primary-button"
            type="button"
            disabled={entries.length >= BUILD201_MAX_FINDINGS}
            onClick={addFinding}
          >
            Record local finding
          </button>
        </div>
        <div>
          <h3>Active field review</h3>
          {entries.length ? (
            <ul>
              {entries.map((entry, index) => {
                const journey = BUILD200_JOURNEYS.find(
                  (item) => item.id === entry.journey,
                );
                return (
                  <li
                    key={`${entry.journey}-${entry.device}-${entry.ticket_ref}`}
                  >
                    <strong>{entry.ticket_ref}</strong> —{" "}
                    {entry.state.replaceAll("_", " ")}
                    <br />
                    <small>
                      {entry.device.replaceAll("_", " ")} · {journey?.title}
                    </small>{" "}
                    {journey ? (
                      <Link
                        href={journey.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open workflow (new tab)
                      </Link>
                    ) : null}{" "}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setEntries((previous) =>
                          previous.filter((_, position) => position !== index),
                        );
                        setShareText("");
                      }}
                      aria-label={`Remove ${entry.ticket_ref}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>
              No device observations have been recorded. All real-device
              acceptance remains unverified.
            </p>
          )}
        </div>
      </div>
      <div className="hero-actions">
        <button className="primary-button" type="button" onClick={exportPacket}>
          Copy retest packet for handoff
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setEntries([]);
            setShareText("");
            setMessage(
              "Local findings cleared; no external records were changed.",
            );
          }}
        >
          Clear local findings
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {shareText ? (
        <details>
          <summary>Inspect exported, unsigned packet</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {shareText}
          </pre>
        </details>
      ) : null}
      <details>
        <summary>
          Import a previously exported packet from another device
        </summary>
        <label htmlFor="build201-import">Sanitized Build 201 JSON</label>
        <textarea
          id="build201-import"
          rows={4}
          maxLength={24000}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder="Paste exported Build 201 JSON here"
        />
        <button
          type="button"
          className="secondary-button"
          onClick={importPacket}
        >
          Validate and replace local notes
        </button>
      </details>
    </section>
  );
}
