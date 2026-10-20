export const maintenancePriorityKeys = Object.freeze([
  "emergency",
  "urgent",
  "normal",
  "preventive",
]);

export const standardMaintenanceCategories = Object.freeze([
  { code: "garbage", name: "Garbage & Waste" },
  { code: "fire", name: "Fire & Life Safety" },
  { code: "septic", name: "Septic & Wastewater" },
  { code: "water", name: "Water Systems" },
  { code: "electrical", name: "Electrical" },
  { code: "grounds", name: "Grounds" },
  { code: "building", name: "Buildings & Facilities" },
]);

const priorityOrder = new Map(
  maintenancePriorityKeys.map((key, index) => [key, index]),
);

function cleanText(value, label, minimum, maximum) {
  const text = String(value ?? "").trim();
  if (text.length < minimum || text.length > maximum) {
    throw new Error(
      `${label} must be between ${minimum} and ${maximum} characters.`,
    );
  }
  return text;
}

function optionalText(value, label, maximum) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`);
  }
  return text;
}

function integerTarget(value, label, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(
      `${label} must be a whole number between 1 and ${maximum} minutes.`,
    );
  }
  return number;
}

export function validateMaintenanceCategoryInput(input) {
  const rawCode = String(input?.code ?? "")
    .trim()
    .toLowerCase();
  const code = rawCode.replace(/[\s-]+/gu, "_");
  if (!/^[a-z][a-z0-9_]{1,49}$/u.test(code)) {
    throw new Error(
      "Category code must start with a letter and use only letters, numbers and underscores.",
    );
  }

  return {
    code,
    name: cleanText(input?.name, "Category name", 2, 80),
    description: optionalText(input?.description, "Category description", 500),
  };
}

export function validateMaintenancePriorityTarget(input) {
  const priorityKey = String(input?.priorityKey ?? "")
    .trim()
    .toLowerCase();
  if (!maintenancePriorityKeys.includes(priorityKey)) {
    throw new Error("Choose a valid maintenance priority.");
  }

  const targetResponseMinutes = integerTarget(
    input?.targetResponseMinutes,
    "Response target",
    43_200,
  );
  const targetCompletionMinutes = integerTarget(
    input?.targetCompletionMinutes,
    "Completion target",
    525_600,
  );
  if (targetCompletionMinutes < targetResponseMinutes) {
    throw new Error(
      "Completion target cannot be shorter than the response target.",
    );
  }

  return {
    priorityKey,
    targetResponseMinutes,
    targetCompletionMinutes,
    instructions: optionalText(
      input?.instructions,
      "Priority instructions",
      500,
    ),
  };
}

export function sortMaintenancePriorities(policies) {
  return [...policies].sort(
    (left, right) =>
      (priorityOrder.get(left.priorityKey) ?? 99) -
      (priorityOrder.get(right.priorityKey) ?? 99),
  );
}

export function formatTargetMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return "not configured";
  if (minutes % 10_080 === 0) {
    const weeks = minutes / 10_080;
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (minutes % 1_440 === 0) {
    const days = minutes / 1_440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}
