export const MESSAGE_TEXT_MAX_CHARS = 1600;
export const MESSAGE_COMMAND_MAX_DIGITS = 12;
export const MESSAGE_MMS_MAX_ATTACHMENTS = 10;

const SAFE_NAVIGATION_ACTIONS = new Set([
  "prompt.main",
  "prompt.site",
  "prompt.reservation",
  "prompt.pass",
  "prompt.help",
  "transfer.staff",
]);

const NUMBERED_MENU = Object.freeze({
  0: Object.freeze({ kind: "menu.main", action: "prompt.main" }),
  1: Object.freeze({ kind: "menu.site", action: "prompt.site" }),
  2: Object.freeze({
    kind: "menu.reservation",
    action: "prompt.reservation",
  }),
  3: Object.freeze({ kind: "menu.pass", action: "prompt.pass" }),
  8: Object.freeze({ kind: "menu.repeat", action: "prompt.main" }),
  9: Object.freeze({ kind: "staff.transfer", action: "transfer.staff" }),
});

const KEYWORDS = Object.freeze({
  MENU: Object.freeze({ kind: "menu.main", action: "prompt.main" }),
  HOME: Object.freeze({ kind: "menu.main", action: "prompt.main" }),
  SITE: Object.freeze({ kind: "menu.site", action: "prompt.site" }),
  RESERVATION: Object.freeze({
    kind: "menu.reservation",
    action: "prompt.reservation",
  }),
  BOOKING: Object.freeze({
    kind: "menu.reservation",
    action: "prompt.reservation",
  }),
  PASS: Object.freeze({ kind: "menu.pass", action: "prompt.pass" }),
  HELP: Object.freeze({ kind: "help", action: "prompt.help" }),
  STAFF: Object.freeze({ kind: "staff.transfer", action: "transfer.staff" }),
  AGENT: Object.freeze({ kind: "staff.transfer", action: "transfer.staff" }),
});

function normalizeText(value) {
  const text = String(value ?? "").trim();

  if (text.length < 1 || text.length > MESSAGE_TEXT_MAX_CHARS) {
    throw new Error("Message text length is invalid.");
  }

  return text;
}

function structuredCommand(text) {
  const match = /^(SITE|RESERVATION|BOOKING|PASS)\s+([0-9]{1,12})$/iu.exec(
    text,
  );

  if (!match) return null;

  const command = match[1].toUpperCase();
  const value = match[2];
  const kind =
    command === "SITE"
      ? "lookup.site"
      : command === "PASS"
        ? "lookup.pass"
        : "lookup.reservation";

  return {
    kind,
    source: "structured",
    action: kind,
    value,
    status: "parsed",
    requiresValidation: true,
  };
}

function naturalLanguageProposal(text) {
  const patterns = [
    {
      kind: "lookup.site",
      regex: /\bsite\s*(?:number|no\.?|#)?\s*([0-9]{1,12})\b/iu,
    },
    {
      kind: "lookup.reservation",
      regex:
        /\b(?:reservation|booking)\s*(?:number|no\.?|#)?\s*([0-9]{1,12})\b/iu,
    },
    {
      kind: "lookup.pass",
      regex: /\bpass\s*(?:number|no\.?|#)?\s*([0-9]{1,12})\b/iu,
    },
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);

    if (match) {
      return {
        kind: pattern.kind,
        source: "natural_language",
        action: pattern.kind,
        value: match[1],
        status: "proposed",
        requiresValidation: true,
      };
    }
  }

  if (/\b(?:staff|agent|person|human)\b/iu.test(text)) {
    return {
      kind: "staff.transfer",
      source: "natural_language",
      action: "transfer.staff",
      value: null,
      status: "proposed",
      requiresValidation: true,
    };
  }

  return null;
}

export function parseMessagingCommand(value) {
  const text = normalizeText(value);
  const upper = text.toUpperCase();

  if (NUMBERED_MENU[text]) {
    const command = NUMBERED_MENU[text];
    return {
      ...command,
      source: "numbered",
      value: null,
      status: "parsed",
      requiresValidation: false,
    };
  }

  if (KEYWORDS[upper]) {
    const command = KEYWORDS[upper];
    return {
      ...command,
      source: "keyword",
      value: null,
      status: "parsed",
      requiresValidation: false,
    };
  }

  const structured = structuredCommand(text);
  if (structured) return structured;

  const proposal = naturalLanguageProposal(text);
  if (proposal) return proposal;

  return {
    kind: "free_text",
    source: "none",
    action: "prompt.help",
    value: null,
    status: "unrecognized",
    requiresValidation: true,
  };
}

export function validateMessagingCommand(command) {
  if (!command || typeof command !== "object") {
    throw new Error("Messaging command is invalid.");
  }

  if (command.source === "natural_language" || command.kind === "free_text") {
    return {
      accepted: false,
      state: "validation_required",
      action: "prompt.help",
    };
  }

  if (String(command.kind).startsWith("lookup.")) {
    return {
      accepted: false,
      state: "verification_required",
      action: command.action,
    };
  }

  if (!SAFE_NAVIGATION_ACTIONS.has(command.action)) {
    return {
      accepted: false,
      state: "rejected",
      action: "prompt.help",
    };
  }

  return {
    accepted: true,
    state: "navigation",
    action: command.action,
  };
}

export function summarizeMessageForTelemetry({
  text,
  attachmentCount = 0,
  command = null,
} = {}) {
  const normalized = normalizeText(text);

  if (
    !Number.isInteger(attachmentCount) ||
    attachmentCount < 0 ||
    attachmentCount > MESSAGE_MMS_MAX_ATTACHMENTS
  ) {
    throw new Error("Message attachment count is invalid.");
  }

  return {
    textLength: normalized.length,
    attachmentCount,
    commandKind: command?.kind ?? null,
    commandSource: command?.source ?? null,
    rawTextExcluded: true,
  };
}
