export function accommodationFitHighlights(input: {
  kind: "campsite" | "rental_cottage";
  facts?: ReadonlyArray<{ label: string; value: string }>;
  rules?: ReadonlyArray<{ label: string; value: string }>;
}): ReadonlyArray<Readonly<{ label: string; value: string; stated: boolean }>>;
