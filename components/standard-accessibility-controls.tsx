"use client";

import { useEffect, useState } from "react";

type Preference = "contrast" | "motion";
const storageKeys: Record<Preference, string> = {
  contrast: "icamp.standard.highContrast.v1",
  motion: "icamp.standard.reducedMotion.v1",
};

function applyPreference(preference: Preference, enabled: boolean) {
  if (preference === "contrast") {
    document.documentElement.dataset.icampContrast = enabled
      ? "high"
      : "standard";
  } else {
    document.documentElement.dataset.icampMotion = enabled
      ? "reduced"
      : "standard";
  }
  try {
    window.localStorage.setItem(
      storageKeys[preference],
      enabled ? "true" : "false",
    );
  } catch {
    // Browsers with storage disabled can still change the current screen.
  }
}

export function StandardAccessibilityControls() {
  const [contrast, setContrast] = useState(false);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const savedContrast =
          window.localStorage.getItem(storageKeys.contrast) === "true";
        const savedMotion =
          window.localStorage.getItem(storageKeys.motion) === "true";
        setContrast(savedContrast);
        setMotion(savedMotion);
        applyPreference("contrast", savedContrast);
        applyPreference("motion", savedMotion);
      } catch {
        // Session defaults remain usable without browser storage.
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <details className="standard-accessibility">
      <summary>Display options</summary>
      <div
        className="standard-accessibility__menu"
        aria-label="Standard theme display preferences"
      >
        <button
          type="button"
          aria-pressed={contrast}
          onClick={() => {
            const next = !contrast;
            setContrast(next);
            applyPreference("contrast", next);
          }}
        >
          High contrast: {contrast ? "On" : "Off"}
        </button>
        <button
          type="button"
          aria-pressed={motion}
          onClick={() => {
            const next = !motion;
            setMotion(next);
            applyPreference("motion", next);
          }}
        >
          Reduced motion: {motion ? "On" : "Off"}
        </button>
        <p>Saved on this device only. Keyboard and screen reader friendly.</p>
      </div>
    </details>
  );
}
