const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function bounded(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max) {
    throw new Error(
      label + " must be between " + min + " and " + max + " characters.",
    );
  }
  return text;
}

export function normalizeOfficeBookingIntake(input = null) {
  if (input == null) return null;

  const bookingMode = String(input.bookingMode ?? "office")
    .trim()
    .toLowerCase();
  if (!["office", "walk_up", "overflow"].includes(bookingMode)) {
    throw new Error("Booking mode is invalid.");
  }

  const rawAreaId = String(input.overflowAreaId ?? "").trim();
  const overflowAreaId = rawAreaId || null;
  if (bookingMode === "overflow") {
    if (!overflowAreaId || !UUID_PATTERN.test(overflowAreaId)) {
      throw new Error("An overflow area is required for overflow booking.");
    }
  } else if (overflowAreaId) {
    throw new Error("Overflow area is only valid for overflow booking.");
  }

  const rawNote = String(input.officeNote ?? "").trim();
  if (rawNote.length > 1000) {
    throw new Error("Office note must be 1000 characters or fewer.");
  }

  return {
    bookingMode,
    overflowAreaId,
    officeNote: rawNote || null,
  };
}

export function normalizeOverflowAreaInput(input = {}) {
  const code = bounded(input.code, "Overflow area code", 1, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/u.test(code)) {
    throw new Error(
      "Overflow area code may contain lowercase letters, numbers, hyphens and underscores.",
    );
  }

  const displayName = bounded(input.displayName, "Overflow area name", 2, 120);
  const rawNotes = String(input.notes ?? "").trim();
  if (rawNotes.length > 1000) {
    throw new Error("Overflow area notes must be 1000 characters or fewer.");
  }

  return { code, displayName, notes: rawNotes || null };
}

export function normalizeOverflowAreaMemberIds(values = []) {
  const source = Array.isArray(values) ? values : [values];
  const ids = [];
  const seen = new Set();
  for (const value of source) {
    const id = String(value ?? "").trim();
    if (!id) continue;
    if (!UUID_PATTERN.test(id)) {
      throw new Error("Overflow area accommodation is invalid.");
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  if (ids.length > 500) {
    throw new Error("Overflow area membership is too large.");
  }
  return ids;
}
