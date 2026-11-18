"use client";

import { useEffect, useState } from "react";

export const VISUAL_THEMES = [
  { id: "standard", label: "Standard / Meadow" },
  { id: "orbit", label: "Orbit Command" },
  { id: "niagara", label: "Niagara Falls" },
  { id: "nova-scotia", label: "Nova Scotia Coast" },
  { id: "bc-mountains", label: "BC Snow Mountains" },
  { id: "saskatchewan", label: "Saskatchewan Gold" },
] as const;

export type VisualTheme = (typeof VISUAL_THEMES)[number]["id"];
const preferenceKey = "icamp.visualTheme.v1";

export function isVisualTheme(value: string): value is VisualTheme {
  return VISUAL_THEMES.some((entry) => entry.id === value);
}

function applyVisualTheme(value: VisualTheme) {
  document
    .querySelector<HTMLElement>(".app-shell")
    ?.setAttribute("data-visual", value);
  try {
    window.localStorage.setItem(preferenceKey, value);
  } catch {
    // Browsers without storage still support visual selection in this tab.
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
        // Standard / Meadow remains the safe default.
      }
      const next = saved && isVisualTheme(saved) ? saved : defaultTheme;
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
          const next = isVisualTheme(event.target.value)
            ? event.target.value
            : "standard";
          setVisual(next);
          applyVisualTheme(next);
        }}
      >
        {VISUAL_THEMES.map((item) => (
          <option value={item.id} key={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
