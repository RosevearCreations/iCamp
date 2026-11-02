const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function winterUuid(value, label) {
  const text = String(value ?? "").trim();
  if (!uuidPattern.test(text))
    throw new Error(`${label} must be a valid UUID.`);
  return text;
}

function boundedText(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return text;
}

const baseSteps = [
  {
    key: "water-shutoff",
    label: "Water supply isolated and physical shutoff verified",
    required: true,
  },
  {
    key: "water-drain",
    label: "Water lines drained and remaining freeze risks inspected",
    required: true,
  },
];

function stepKey(label) {
  const key = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72)
    .replace(/-+$/gu, "");
  if (!/^[a-z][a-z0-9-]+$/u.test(key))
    throw new Error(
      "Each utility step needs a descriptive letter-based label.",
    );
  return key;
}

export function normalizeWinterTemplate(input) {
  const lines = String(input.extraSteps ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 14)
    throw new Error(
      "A winterization checklist supports up to 14 utility steps.",
    );
  const steps = [
    ...baseSteps,
    ...lines.map((line) => {
      const optional = /^\[optional\]\s*/iu.test(line);
      const label = line.replace(/^\[optional\]\s*/iu, "").trim();
      boundedText(label, "Utility step", 5, 240);
      return {
        key: stepKey(label),
        label,
        required: !optional,
      };
    }),
  ];
  if (new Set(steps.map((step) => step.key)).size !== steps.length)
    throw new Error("Checklist steps must have distinct descriptions.");
  return {
    id: winterUuid(input.id, "Template ID"),
    name: boundedText(input.name, "Checklist name", 5, 160),
    instructions: boundedText(
      input.instructions,
      "Staff instructions",
      12,
      2000,
    ),
    steps,
  };
}

export function normalizeWinterRun(input) {
  const winterYear = Number(input.winterYear);
  if (!Number.isInteger(winterYear) || winterYear < 2020 || winterYear > 2120)
    throw new Error("Select a valid winter season year.");
  return {
    id: winterUuid(input.id, "Run ID"),
    assignmentId: winterUuid(input.assignmentId, "Long-term assignment"),
    templateId: winterUuid(input.templateId, "Checklist version"),
    winterYear,
  };
}

export function normalizeWinterStep(input) {
  const result = String(input.result ?? "");
  if (!["pass", "needs_work", "not_applicable"].includes(result))
    throw new Error("Select a valid winterization step result.");
  const stepKeyValue = String(input.stepKey ?? "").trim();
  if (!/^[a-z][a-z0-9-]{1,79}$/u.test(stepKeyValue))
    throw new Error("Select a valid checklist step.");
  const reference = String(input.evidenceReference ?? "").trim();
  if (result === "pass" && reference.length < 8)
    throw new Error("Completed work needs a source evidence reference.");
  if (reference && reference.length > 400)
    throw new Error("Evidence reference must be at most 400 characters.");
  const workOrderId = String(input.workOrderId ?? "").trim();
  if (result === "needs_work" && !workOrderId)
    throw new Error(
      "Failed steps must link an existing maintenance work order.",
    );
  if (result !== "needs_work" && workOrderId)
    throw new Error("Only failed steps may link corrective work.");
  return {
    id: winterUuid(input.id, "Evidence event ID"),
    runId: winterUuid(input.runId, "Winterization run"),
    stepKey: stepKeyValue,
    result,
    evidenceReference: reference || null,
    workOrderId: workOrderId
      ? winterUuid(workOrderId, "Maintenance work order")
      : null,
    note: boundedText(input.note, "Field evidence note", 12, 2000),
  };
}

export function normalizeWinterReview(input) {
  const decision = String(input.decision ?? "");
  if (!["approved", "rejected"].includes(decision))
    throw new Error("Select an authorized winterization decision.");
  return {
    id: winterUuid(input.id, "Sign-off event ID"),
    runId: winterUuid(input.runId, "Winterization run"),
    decision,
    note: boundedText(input.note, "Sign-off note", 12, 2000),
  };
}

export function winterOperatingYear(date = new Date()) {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() <= 3 ? year - 1 : year;
}
