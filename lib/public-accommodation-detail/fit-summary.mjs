const specs = Object.freeze({
  campsite: [
    "Site type",
    "Maximum RV length",
    "Electrical",
    "Water",
    "Accessible site",
    "Pets",
  ],
  rental_cottage: [
    "Maximum sleeping occupancy",
    "Step-free access",
    "Accessible washroom",
    "Pets",
  ],
});

/** Display published facts, never interpret missing features as a fit guarantee. */
export function accommodationFitHighlights({ kind, facts = [], rules = [] }) {
  const wanted = specs[kind];
  if (!wanted) throw new Error("Unsupported accommodation kind.");
  const recorded = new Map(
    [...facts, ...rules]
      .filter(
        (item) =>
          typeof item?.label === "string" && typeof item?.value === "string",
      )
      .map((item) => [item.label, item.value.trim()]),
  );
  return wanted.map((label) => {
    const value = recorded.get(label);
    const stated = Boolean(
      value &&
      !["not supplied", "unknown", "n/a"].includes(value.toLowerCase()),
    );
    return Object.freeze({
      label,
      value: stated ? value : "Not published — confirm with the campground",
      stated,
    });
  });
}
