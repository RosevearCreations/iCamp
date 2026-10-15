const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/u;
const CHANNELS = new Set(["email", "sms", "phone", "none"]);
const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms", "import", "system"]);
const RV_KINDS = new Set([
  "motorhome",
  "travel_trailer",
  "fifth_wheel",
  "pop_up",
  "truck_camper",
  "other",
]);
const VEHICLE_KINDS = new Set([
  "car",
  "truck",
  "suv",
  "van",
  "motorcycle",
  "tow_vehicle",
  "other",
]);
const PET_SPECIES = new Set(["dog", "cat", "bird", "other"]);

function requiredText(value, label, minimum, maximum) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(
      label +
        " must be between " +
        minimum +
        " and " +
        maximum +
        " characters.",
    );
  }
  return normalized;
}

function optionalText(value, maximum) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > maximum) {
    throw new Error("Saved detail is too long.");
  }
  return normalized;
}

function optionalNumber(value, label, minimum, maximum) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(label + " is outside the supported range.");
  }
  return Math.round(number * 100) / 100;
}

function optionalInteger(value, label, minimum, maximum) {
  const number = optionalNumber(value, label, minimum, maximum);
  if (number === null) return null;
  if (!Number.isInteger(number)) {
    throw new Error(label + " must be a whole number.");
  }
  return number;
}

function yes(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return (
    value === true ||
    value === "true" ||
    value === "1" ||
    value === "on" ||
    value === "yes"
  );
}

export function normalizeGuestSourceChannel(value = "web") {
  const normalized = String(value).trim().toLowerCase();
  if (!SOURCE_CHANNELS.has(normalized)) {
    throw new Error("Guest profile source channel is invalid.");
  }
  return normalized;
}

export function normalizeGuestProfileInput(input = {}) {
  const email = optionalText(input.contactEmail, 254)?.toLowerCase() ?? null;
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new Error("A valid contact email is required.");
  }
  const phone = optionalText(input.contactPhone, 40);
  if (phone && phone.length < 7) {
    throw new Error("Contact phone must be at least 7 characters.");
  }
  const preferredContactChannel = String(
    input.preferredContactChannel ?? "email",
  )
    .trim()
    .toLowerCase();
  if (!CHANNELS.has(preferredContactChannel)) {
    throw new Error("Preferred contact channel is invalid.");
  }

  return {
    firstName: requiredText(input.firstName, "First name", 1, 80),
    lastName: requiredText(input.lastName, "Last name", 1, 80),
    preferredName: optionalText(input.preferredName, 80),
    contactEmail: email,
    contactPhone: phone,
    preferredContactChannel,
    saveStayPreferences: yes(input.saveStayPreferences, true),
    allowStaffProfileLookup: yes(input.allowStaffProfileLookup, true),
  };
}

export function normalizeGuestRvInput(input = {}) {
  const rvKind = String(input.rvKind ?? "").trim();
  if (!RV_KINDS.has(rvKind)) throw new Error("RV type is invalid.");
  const amps = optionalInteger(input.electricalServiceAmps, "Electrical service", 15, 50);
  if (amps !== null && ![15, 30, 50].includes(amps)) {
    throw new Error("Electrical service must be 15, 30 or 50 amps.");
  }
  return {
    nickname: requiredText(input.nickname, "RV nickname", 1, 80),
    rvKind,
    make: optionalText(input.make, 80),
    model: optionalText(input.model, 80),
    modelYear: optionalInteger(input.modelYear, "Model year", 1900, 2200),
    lengthFeet: optionalNumber(input.lengthFeet, "RV length", 1, 120),
    slideOutCount: optionalInteger(input.slideOutCount ?? 0, "Slide-out count", 0, 12) ?? 0,
    electricalServiceAmps: amps,
    notes: optionalText(input.notes, 1000),
  };
}

export function normalizeGuestVehicleInput(input = {}) {
  const vehicleKind = String(input.vehicleKind ?? "").trim();
  if (!VEHICLE_KINDS.has(vehicleKind)) {
    throw new Error("Vehicle type is invalid.");
  }
  return {
    nickname: requiredText(input.nickname, "Vehicle nickname", 1, 80),
    vehicleKind,
    make: optionalText(input.make, 80),
    model: optionalText(input.model, 80),
    color: optionalText(input.color, 60),
    modelYear: optionalInteger(input.modelYear, "Model year", 1900, 2200),
    notes: optionalText(input.notes, 1000),
  };
}

export function normalizeGuestPetInput(input = {}) {
  const species = String(input.species ?? "").trim();
  if (!PET_SPECIES.has(species)) throw new Error("Pet species is invalid.");
  return {
    name: requiredText(input.name, "Pet name", 1, 80),
    species,
    breed: optionalText(input.breed, 80),
    weightKg: optionalNumber(input.weightKg, "Pet weight", 0.1, 250),
    notes: optionalText(input.notes, 1000),
  };
}

export function normalizeSavedItemKind(value) {
  const normalized = String(value ?? "").trim();
  if (!["rv", "vehicle", "pet"].includes(normalized)) {
    throw new Error("Saved stay item kind is invalid.");
  }
  return normalized;
}
