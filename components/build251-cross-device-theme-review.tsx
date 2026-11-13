"use client";

import { useEffect, useState } from "react";

import {
  assessCrossDeviceThemeAcceptance,
  type ManualThemeReport,
} from "@/lib/release/build251-readiness-core.mjs";

type CheckName =
  "heroVisible" | "navigationUsable" | "textReadable" | "noHorizontalOverflow";
type Visual = "standard" | "orbit";
type Factor = "desktop" | "tablet" | "mobile";

const storageKey = "icamp.themeAcceptance.manual.v1";
const deviceKey = "icamp.themeAcceptance.deviceId.v1";
const initialChecks = {
  heroVisible: false,
  navigationUsable: false,
  textReadable: false,
  noHorizontalOverflow: false,
};
const checklist: Array<{ key: CheckName; title: string }> = [
  {
    key: "heroVisible",
    title: "Meadow hero or Orbit header renders correctly",
  },
  {
    key: "navigationUsable",
    title: "Navigation, links and controls are usable",
  },
  {
    key: "textReadable",
    title: "Text remains readable at normal and zoomed sizes",
  },
  { key: "noHorizontalOverflow", title: "No horizontal clipping or overflow" },
];
function save(records: ManualThemeReport[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  } catch {
    // The export remains usable when local storage is unavailable.
  }
}

export function CrossDeviceThemeReview({
  sourceRevision,
}: Readonly<{ sourceRevision: string }>) {
  const [deviceId, setDeviceId] = useState("");
  const [factor, setFactor] = useState<Factor>("desktop");
  const [visual, setVisual] = useState<Visual>("standard");
  const [checks, setChecks] = useState(initialChecks);
  const [records, setRecords] = useState<ManualThemeReport[]>([]);
  const [importText, setImportText] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        let id = window.localStorage.getItem(deviceKey);
        if (!id) {
          id = window.crypto.randomUUID();
          window.localStorage.setItem(deviceKey, id);
        }
        setDeviceId(id);
        const saved = JSON.parse(
          window.localStorage.getItem(storageKey) ?? "[]",
        );
        if (Array.isArray(saved))
          setRecords(
            saved
              .filter((entry) => entry?.sourceRevision === sourceRevision)
              .slice(0, 12),
          );
      } catch {
        setFeedback(
          "Browser storage unavailable. Reviews can still be copied.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [sourceRevision]);

  const report = assessCrossDeviceThemeAcceptance({
    records,
    sourceRevision,
    asOf: new Date().toISOString(),
  });
  const exportPayload = JSON.stringify(
    {
      schema: "icamp.theme.manual-device-export.v1",
      records: records.filter(
        (entry) =>
          entry.deviceId === deviceId &&
          entry.sourceRevision === sourceRevision,
      ),
    },
    null,
    2,
  );
  function captureReview() {
    if (!deviceId || !Object.values(checks).every(Boolean)) {
      setFeedback("Finish all four visual checks on this real device.");
      return;
    }
    if (!/^[a-f0-9]{40}$/u.test(sourceRevision)) {
      setFeedback(
        "Exact deployed source revision unavailable. Review is HOLD.",
      );
      return;
    }
    const newRecord: ManualThemeReport = {
      schema: "icamp.theme.manual-acceptance.v1",
      formFactor: factor,
      visual,
      deviceId,
      sourceRevision,
      recordedAt: new Date().toISOString(),
      checks: { ...checks },
    };
    const next = records.filter(
      (entry) =>
        !(
          entry.deviceId === deviceId &&
          entry.formFactor === factor &&
          entry.visual === visual
        ),
    );
    const joined = [...next, newRecord].slice(-12);
    setRecords(joined);
    save(joined);
    setChecks(initialChecks);
    setFeedback(
      "Manual visual report saved here. No external approval implied.",
    );
  }
  function mergeOtherDevice() {
    if (importText.length > 20000) {
      setFeedback("Import is too large.");
      return;
    }
    try {
      const parsed = JSON.parse(importText);
      if (
        parsed?.schema !== "icamp.theme.manual-device-export.v1" ||
        !Array.isArray(parsed.records) ||
        parsed.records.length > 2
      )
        throw new Error("Invalid device export.");
      const next = [...records];
      for (const item of parsed.records) {
        if (
          item?.sourceRevision !== sourceRevision ||
          item?.deviceId === deviceId ||
          !["standard", "orbit"].includes(item?.visual) ||
          !["desktop", "tablet", "mobile"].includes(item?.formFactor)
        )
          throw new Error("Incorrect source or device.");
        const key = item.formFactor + ":" + item.visual;
        const existing = next.findIndex(
          (entry) => entry.formFactor + ":" + entry.visual === key,
        );
        if (existing >= 0) next.splice(existing, 1);
        next.push(item);
      }
      const assessment = assessCrossDeviceThemeAcceptance({
        records: next,
        sourceRevision,
        asOf: new Date().toISOString(),
      });
      if (
        assessment.status !==
          "MANUAL_CROSS_DEVICE_CHECKLIST_COMPLETE_UNVERIFIED" &&
        !assessment.status.startsWith("HOLD_MISSING_CROSS_DEVICE")
      )
        throw new Error("Device evidence failed consistency checks.");
      setRecords(next);
      save(next);
      setImportText("");
      setFeedback("Other device report imported; identity is self-reported.");
    } catch {
      setFeedback(
        "Device export invalid, stale or inconsistent. Nothing imported.",
      );
    }
  }

  return (
    <div className="page-stack">
      <p>
        <strong>Source:</strong> <code>{sourceRevision}</code>
      </p>
      <p>
        This is a manual, self-reported presentation checklist. It never enrolls
        a signer, authenticates a device or approves a campground or Comms Hub
        connection. Repeat both visual choices on each physical device.
      </p>
      <label>
        Actual device class
        <select
          value={factor}
          onChange={(event) => setFactor(event.target.value as Factor)}
        >
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
          <option value="mobile">Mobile</option>
        </select>
      </label>
      <label>
        Visual theme being reviewed
        <select
          value={visual}
          onChange={(event) => setVisual(event.target.value as Visual)}
        >
          <option value="standard">Standard / Meadow</option>
          <option value="orbit">Orbit Command</option>
        </select>
      </label>
      <fieldset>
        <legend>
          Confirm by actually looking at this theme on this device
        </legend>
        {checklist.map(({ key, title }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={checks[key]}
              onChange={(event) =>
                setChecks({ ...checks, [key]: event.target.checked })
              }
            />{" "}
            {title}
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={captureReview}>
        Save this device&apos;s manual visual check
      </button>
      <p role="status">
        <strong>{report.status}</strong> · {report.completed.length}/6 visual
        combinations recorded. Independent owner acceptance: HOLD.
      </p>
      <label>
        Copy this device&apos;s evidence to another device
        <textarea readOnly rows={7} value={exportPayload} />
      </label>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(exportPayload).then(
            () => setFeedback("Device evidence copied."),
            () => setFeedback("Copy the text manually from the field above."),
          );
        }}
      >
        Copy device evidence
      </button>
      <label>
        Paste another device&apos;s exported evidence
        <textarea
          rows={6}
          maxLength={20000}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
      </label>
      <button type="button" onClick={mergeOtherDevice}>
        Import independently reviewed device evidence
      </button>
      <p role="status">{feedback}</p>
    </div>
  );
}
