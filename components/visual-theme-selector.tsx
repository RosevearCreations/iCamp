"use client";

import { useEffect, useState } from "react";

type VisualTheme = "standard" | "orbit";
const preferenceKey = "icamp.visualTheme.v1";

function applyVisualTheme(value: VisualTheme) {
  document
    .querySelector<HTMLElement>(".app-shell")
    ?.setAttribute("data-visual", value);
  try {
    window.localStorage.setItem(preferenceKey, value);
  } catch {
    // Browsers that block persistence still have a functional theme control.
  }
}

export function VisualThemeSelector({
  defaultTheme = "standard",
}: Readonly<{ defaultTheme?: VisualTheme }>) {
  const [visual, setVisual] = useState<VisualTheme>(defaultTheme);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(preferenceKey);
      } catch {
        // The platform's Meadow default remains available without storage.
      }
      const next: VisualTheme =
        saved === "orbit" || saved === "standard" ? saved : defaultTheme;
      setVisual(next);
      applyVisualTheme(next);
    });
    return () => {
      active = false;
    };
  }, [defaultTheme]);
  return (
    <label className="visual-theme-selector">
      <span>Theme</span>
      <select
        aria-label="iCamp visual theme"
        value={visual}
        onChange={(event) => {
          const next: VisualTheme =
            event.target.value === "orbit" ? "orbit" : "standard";
          setVisual(next);
          applyVisualTheme(next);
        }}
      >
        <option value="standard">Standard / Meadow</option>
        <option value="orbit">Orbit Command</option>
      </select>
    </label>
  );
}
