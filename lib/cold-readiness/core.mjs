import { winterOperatingYear, winterUuid } from "../winterization/core.mjs";

export { winterOperatingYear, winterUuid };

const textField = (value, name, min, max) => {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  return text;
};

const steps = [
  {
    key: "water-freeze-protection",
    label:
      "Water line insulation, approved heating, or confirmed no live water supply",
    required: true,
  },
  {
    key: "heating-power",
    label:
      "Safe heating, power, freeze monitoring and failure contingency inspected",
    required: true,
  },
  {
    key: "sanitation-drainage",
    label:
      "Septic, sewer, drainage and freeze-related sanitation risks inspected",
    required: true,
  },
  {
    key: "winter-access",
    label:
      "Safe winter access, emergency egress and snow/ice procedures checked",
    required: true,
  },
];

function slug(text) {
  const value = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72)
    .replace(/-+$/gu, "");
  if (!/^[a-z][a-z0-9-]+$/u.test(value))
    throw new Error("Custom readiness steps must have descriptive labels.");
  return value;
}

export function normalizeReadinessTemplate(input) {
  const lines = String(input.extraSteps ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 14)
    throw new Error(
      "A winter-readiness policy supports up to 14 additional steps.",
    );
  const all = [
    ...steps,
    ...lines.map((line) => {
      const optional = /^\[optional\]\s*/iu.test(line);
      const label = textField(
        line.replace(/^\[optional\]\s*/iu, ""),
        "Step label",
        5,
        240,
      );
      return { key: slug(label), label, required: !optional };
    }),
  ];
  if (new Set(all.map((item) => item.key)).size !== all.length)
    throw new Error("Readiness checklist steps must be unique.");
  return {
    id: winterUuid(input.id, "Policy ID"),
    name: textField(input.name, "Policy name", 5, 160),
    instructions: textField(
      input.instructions,
      "Policy instructions",
      12,
      2000,
    ),
    steps: all,
  };
}

export function normalizeReadinessAssessment(input) {
  const winterYear = Number(input.winterYear);
  if (!Number.isInteger(winterYear) || winterYear < 2020 || winterYear > 2120)
    throw new Error("Choose a valid winter season year.");
  const waterMode = String(input.waterMode ?? "");
  if (!["none_verified", "insulated", "heated"].includes(waterMode))
    throw new Error(
      "Choose a verified no-water, insulated or heated water configuration.",
    );
  return {
    id: winterUuid(input.id, "Assessment ID"),
    accommodationId: winterUuid(input.accommodationId, "Accommodation"),
    assignmentId: String(input.assignmentId ?? "").trim()
      ? winterUuid(input.assignmentId, "Seasonal assignment")
      : null,
    templateId: winterUuid(input.templateId, "Readiness policy"),
    winterYear,
    waterMode,
    operatingLimits: textField(
      input.operatingLimits,
      "Operating limits",
      12,
      1200,
    ),
  };
}

export function normalizeReadinessObservation(input) {
  const result = String(input.result ?? "");
  if (!["pass", "defect", "not_applicable"].includes(result))
    throw new Error("Choose a valid readiness observation result.");
  const stepKey = String(input.stepKey ?? "").trim();
  if (!/^[a-z][a-z0-9-]{1,79}$/u.test(stepKey))
    throw new Error("Select a valid checklist step.");
  const source = String(input.evidenceReference ?? "").trim();
  if (result === "pass" && source.length < 8)
    throw new Error(
      "Passing cold-weather evidence requires a source reference.",
    );
  if (source && (source.length < 8 || source.length > 400))
    throw new Error("Evidence reference must contain 8–400 characters.");
  const workOrder = String(input.workOrderId ?? "").trim();
  if (result === "defect" && !workOrder)
    throw new Error("Defects must link a canonical corrective work order.");
  if (result !== "defect" && workOrder)
    throw new Error("Only defects may link corrective work orders.");
  return {
    id: winterUuid(input.id, "Observation ID"),
    assessmentId: winterUuid(input.assessmentId, "Assessment"),
    stepKey,
    result,
    evidenceReference: source || null,
    workOrderId: workOrder ? winterUuid(workOrder, "Work order") : null,
    note: textField(input.note, "Observation note", 12, 2000),
  };
}

export function normalizeReadinessDecision(input) {
  const decision = String(input.decision ?? "");
  if (!["approved", "rejected"].includes(decision))
    throw new Error("Choose an approved or rejected readiness decision.");
  return {
    id: winterUuid(input.id, "Decision ID"),
    assessmentId: winterUuid(input.assessmentId, "Assessment"),
    decision,
    note: textField(input.note, "Decision note", 12, 2000),
  };
}
