import { winterUuid } from "../winterization/core.mjs";

export { winterUuid };

function bounded(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return text;
}

export function springWinterYear(date = new Date()) {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() < 8 ? year - 1 : year;
}

export const requiredSpringSteps = [
  {
    key: "water-restoration",
    label:
      "Water supply, pressure/leaks and any required water-quality clearance inspected",
    required: true,
  },
  {
    key: "electrical-heat",
    label: "Electrical, heating, fuel and restored utility safety checked",
    required: true,
  },
  {
    key: "sanitation-drainage",
    label: "Wastewater, septic, drainage and sanitation safely returned to use",
    required: true,
  },
  {
    key: "fire-emergency",
    label: "Smoke/CO alarms, fire safety and emergency egress checked",
    required: true,
  },
  {
    key: "grounds-access",
    label: "Roads, walking paths, trees and emergency vehicle access inspected",
    required: true,
  },
  {
    key: "site-condition",
    label:
      "Site, structures, hazards and housekeeping checked for return to service",
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
    throw new Error("Each spring inspection step needs a descriptive label.");
  return key;
}

export function normalizeSpringTemplate(input) {
  const extra = String(input.extraSteps ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (extra.length > 14)
    throw new Error(
      "A spring reopening checklist supports up to 14 extra steps.",
    );
  const steps = [
    ...requiredSpringSteps,
    ...extra.map((line) => {
      const optional = /^\[optional\]\s*/iu.test(line);
      const label = bounded(
        line.replace(/^\[optional\]\s*/iu, ""),
        "Step label",
        5,
        240,
      );
      return { key: stepKey(label), label, required: !optional };
    }),
  ];
  if (new Set(steps.map(({ key }) => key)).size !== steps.length)
    throw new Error("Spring reopening checklist steps must be unique.");
  return {
    id: winterUuid(input.id, "Template ID"),
    name: bounded(input.name, "Checklist name", 5, 160),
    instructions: bounded(
      input.instructions,
      "Inspection instructions",
      12,
      2000,
    ),
    steps,
  };
}

export function normalizeSpringInspection(input) {
  const winterYear = Number(input.winterYear);
  if (!Number.isInteger(winterYear) || winterYear < 2020 || winterYear > 2120)
    throw new Error("Select a valid winter season for spring reopening.");
  const waterService = String(input.waterService ?? "");
  if (!["restored_verified", "not_provided_verified"].includes(waterService))
    throw new Error(
      "Verify restored water service or that this site has no water service.",
    );
  const assignment = String(input.assignmentId ?? "").trim();
  return {
    id: winterUuid(input.id, "Inspection ID"),
    accommodationId: winterUuid(input.accommodationId, "Accommodation"),
    assignmentId: assignment
      ? winterUuid(assignment, "Long-term assignment")
      : null,
    templateId: winterUuid(input.templateId, "Checklist version"),
    winterYear,
    waterService,
    operatingLimits: bounded(
      input.operatingLimits,
      "Return-to-service limits",
      12,
      1200,
    ),
  };
}

export function normalizeSpringObservation(input) {
  const result = String(input.result ?? "");
  if (!["pass", "defect", "not_applicable"].includes(result))
    throw new Error("Select a valid inspection result.");
  const stepKeyValue = String(input.stepKey ?? "").trim();
  if (!/^[a-z][a-z0-9-]{1,79}$/u.test(stepKeyValue))
    throw new Error("Select a valid spring inspection step.");
  const source = String(input.evidenceReference ?? "").trim();
  if (result === "pass" && source.length < 8)
    throw new Error(
      "Passing spring inspection evidence needs a source reference.",
    );
  if (source && (source.length < 8 || source.length > 400))
    throw new Error("Evidence reference must contain 8–400 characters.");
  const workOrderId = String(input.workOrderId ?? "").trim();
  if (result === "defect" && !workOrderId)
    throw new Error(
      "A spring safety defect must link a maintenance work order.",
    );
  if (result !== "defect" && workOrderId)
    throw new Error("Only defect evidence may link corrective work.");
  return {
    id: winterUuid(input.id, "Observation ID"),
    inspectionId: winterUuid(input.inspectionId, "Inspection"),
    stepKey: stepKeyValue,
    result,
    evidenceReference: source || null,
    workOrderId: workOrderId ? winterUuid(workOrderId, "Work order") : null,
    note: bounded(input.note, "Observed condition note", 12, 2000),
  };
}

export function normalizeSpringDecision(input) {
  const decision = String(input.decision ?? "");
  if (!["approved", "rejected"].includes(decision))
    throw new Error(
      "Select an approved or rejected spring reopening decision.",
    );
  return {
    id: winterUuid(input.id, "Decision ID"),
    inspectionId: winterUuid(input.inspectionId, "Inspection"),
    decision,
    note: bounded(input.note, "Independent review note", 12, 2000),
  };
}
