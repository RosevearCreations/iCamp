export const DTMF_MAX_DIGITS = 16;
export const DTMF_ENTRY_MAX_DIGITS = 12;

const INPUT_KINDS = new Set([
  "menu",
  "site",
  "reservation",
  "pass",
  "pin",
  "verification",
]);

const SENSITIVE_KINDS = new Set(["pin", "verification"]);

const ENTRY_STATES = Object.freeze({
  site_entry: Object.freeze({
    inputKind: "site",
    action: "lookup.site",
    prompt: "prompt.site",
  }),
  reservation_entry: Object.freeze({
    inputKind: "reservation",
    action: "lookup.reservation",
    prompt: "prompt.reservation",
  }),
  pass_entry: Object.freeze({
    inputKind: "pass",
    action: "lookup.pass",
    prompt: "prompt.pass",
  }),
});

function normalizeInputKind(value) {
  const kind = String(value ?? "menu")
    .trim()
    .toLowerCase();

  if (!INPUT_KINDS.has(kind)) {
    throw new Error("DTMF input kind is invalid.");
  }

  return kind;
}

function stripSubmitTerminator(value) {
  return value.endsWith("#") ? value.slice(0, -1) : value;
}

function promptForState(stateKey) {
  if (stateKey === "main_menu") return "prompt.main";
  return ENTRY_STATES[stateKey]?.prompt ?? "prompt.repeat";
}

function retryTransition({
  stateKey,
  retryCount,
  maxRetries,
  eventType,
  inputKind,
  digitCount,
  sensitive,
}) {
  const nextRetry = retryCount + 1;

  if (nextRetry >= maxRetries) {
    return {
      fromState: stateKey,
      toState: "staff_transfer",
      action: "transfer.staff",
      eventType,
      retryCount: nextRetry,
      sessionState: "transferred",
      inputKind,
      digitCount,
      sensitive,
      transientEntry: null,
    };
  }

  return {
    fromState: stateKey,
    toState: stateKey,
    action: promptForState(stateKey),
    eventType,
    retryCount: nextRetry,
    sessionState: "active",
    inputKind,
    digitCount,
    sensitive,
    transientEntry: null,
  };
}

export function isSensitiveDtmfKind(inputKind) {
  return SENSITIVE_KINDS.has(normalizeInputKind(inputKind));
}

export function maskDtmfDigits(digits) {
  const normalized = String(digits ?? "");
  const digitCount = (normalized.match(/[0-9]/gu) ?? []).length;

  return `[redacted:${digitCount}]`;
}

export function summarizeDtmfInput({ inputKind = "menu", digits = null } = {}) {
  const kind = normalizeInputKind(inputKind);
  const raw = digits === null ? "" : String(digits);
  const numeric = stripSubmitTerminator(raw);
  const digitCount = (numeric.match(/[0-9]/gu) ?? []).length;

  return {
    inputKind: kind,
    digitCount,
    sensitive: SENSITIVE_KINDS.has(kind),
    maskedValue: maskDtmfDigits(raw),
  };
}

export function normalizeDtmfProviderInput({
  eventType,
  inputKind = "menu",
  digits = null,
}) {
  const kind = normalizeInputKind(inputKind);

  if (eventType === "dtmf.timeout") {
    return {
      inputKind: kind,
      digits: null,
      digitCount: 0,
      sensitive: SENSITIVE_KINDS.has(kind),
    };
  }

  if (eventType !== "dtmf.input") {
    throw new Error("Unsupported DTMF provider event type.");
  }

  const raw = String(digits ?? "").trim();

  if (raw.length < 1 || raw.length > DTMF_MAX_DIGITS + 1) {
    throw new Error("DTMF input length is invalid.");
  }

  const isBack = raw === "*";
  const isBareSubmit = raw === "#";
  const numericWithOptionalSubmit = /^[0-9]{1,16}#?$/u.test(raw);

  if (!isBack && !isBareSubmit && !numericWithOptionalSubmit) {
    throw new Error("DTMF input contains unsupported keypad characters.");
  }

  if (SENSITIVE_KINDS.has(kind) && !numericWithOptionalSubmit) {
    throw new Error("Sensitive DTMF input must contain numeric digits only.");
  }

  const numeric = stripSubmitTerminator(raw);

  return {
    inputKind: kind,
    digits: raw,
    digitCount: (numeric.match(/[0-9]/gu) ?? []).length,
    sensitive: SENSITIVE_KINDS.has(kind),
  };
}

export function routeDtmfInput({
  stateKey,
  inputKind = "menu",
  digits = null,
  timedOut = false,
  retryCount = 0,
  maxRetries = 3,
}) {
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    throw new Error("DTMF retry count must be a non-negative integer.");
  }

  if (!Number.isInteger(maxRetries) || maxRetries < 1 || maxRetries > 5) {
    throw new Error("DTMF max retries must be between 1 and 5.");
  }

  const normalized = normalizeDtmfProviderInput({
    eventType: timedOut ? "dtmf.timeout" : "dtmf.input",
    inputKind,
    digits,
  });

  if (timedOut) {
    return retryTransition({
      stateKey,
      retryCount,
      maxRetries,
      eventType: "dtmf.timeout",
      inputKind: normalized.inputKind,
      digitCount: 0,
      sensitive: normalized.sensitive,
    });
  }

  const raw = normalized.digits;

  if (raw === "*") {
    return {
      fromState: stateKey,
      toState: "main_menu",
      action: "prompt.main",
      eventType: "dtmf.back",
      retryCount: 0,
      sessionState: "active",
      inputKind: normalized.inputKind,
      digitCount: 0,
      sensitive: normalized.sensitive,
      transientEntry: null,
    };
  }

  if (stateKey === "main_menu") {
    if (normalized.inputKind !== "menu" || normalized.digitCount !== 1) {
      return retryTransition({
        stateKey,
        retryCount,
        maxRetries,
        eventType: "dtmf.invalid",
        inputKind: normalized.inputKind,
        digitCount: normalized.digitCount,
        sensitive: normalized.sensitive,
      });
    }

    const menu = {
      "0": {
        toState: "main_menu",
        action: "prompt.main",
        eventType: "dtmf.main",
      },
      "1": {
        toState: "site_entry",
        action: "prompt.site",
        eventType: "dtmf.menu.site",
      },
      "2": {
        toState: "reservation_entry",
        action: "prompt.reservation",
        eventType: "dtmf.menu.reservation",
      },
      "3": {
        toState: "pass_entry",
        action: "prompt.pass",
        eventType: "dtmf.menu.pass",
      },
      "8": {
        toState: "main_menu",
        action: "prompt.main",
        eventType: "dtmf.repeat",
      },
      "9": {
        toState: "staff_transfer",
        action: "transfer.staff",
        eventType: "dtmf.staff_transfer",
        terminal: true,
      },
    };

    const selected = menu[stripSubmitTerminator(raw)];

    if (!selected) {
      return retryTransition({
        stateKey,
        retryCount,
        maxRetries,
        eventType: "dtmf.invalid",
        inputKind: normalized.inputKind,
        digitCount: normalized.digitCount,
        sensitive: normalized.sensitive,
      });
    }

    return {
      fromState: stateKey,
      toState: selected.toState,
      action: selected.action,
      eventType: selected.eventType,
      retryCount: 0,
      sessionState: selected.terminal ? "transferred" : "active",
      inputKind: normalized.inputKind,
      digitCount: normalized.digitCount,
      sensitive: normalized.sensitive,
      transientEntry: null,
    };
  }

  const entry = ENTRY_STATES[stateKey];

  if (!entry || normalized.inputKind !== entry.inputKind) {
    return retryTransition({
      stateKey,
      retryCount,
      maxRetries,
      eventType: "dtmf.invalid",
      inputKind: normalized.inputKind,
      digitCount: normalized.digitCount,
      sensitive: normalized.sensitive,
    });
  }

  const value = stripSubmitTerminator(raw);

  if (
    !/^[0-9]+$/u.test(value) ||
    value.length < 1 ||
    value.length > DTMF_ENTRY_MAX_DIGITS
  ) {
    return retryTransition({
      stateKey,
      retryCount,
      maxRetries,
      eventType: "dtmf.invalid",
      inputKind: normalized.inputKind,
      digitCount: normalized.digitCount,
      sensitive: normalized.sensitive,
    });
  }

  return {
    fromState: stateKey,
    toState: "main_menu",
    action: entry.action,
    eventType: `dtmf.${entry.inputKind}.accepted`,
    retryCount: 0,
    sessionState: "active",
    inputKind: normalized.inputKind,
    digitCount: normalized.digitCount,
    sensitive: normalized.sensitive,
    transientEntry: {
      kind: entry.inputKind,
      value,
    },
  };
}
