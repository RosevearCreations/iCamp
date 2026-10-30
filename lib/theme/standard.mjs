/** Canonical first theme. Only presentation tokens are overridable. */
export const STANDARD_THEME = Object.freeze({
  id: "standard",
  label: "Standard",
  style: "Meadow & evergreen",
  version: 1,
  background: "/themes/standard/meadow-hero.webp",
  tokens: Object.freeze({
    background: "#081d1b",
    surface: "#102b27",
    surfaceSoft: "#17382f",
    foreground: "#f5fff3",
    subdued: "#bcd0c4",
    line: "#305548",
    accent: "#b6f177",
    sunshine: "#efbe66",
  }),
});

// Status meaning does not vary with the selected visual theme.
export const SEMANTIC_STATUS = Object.freeze({
  operational: "#61e99c",
  pending: "#efbe66",
  critical: "#fb7488",
  information: "#71caff",
  disabled: "#bcd0c4",
});
