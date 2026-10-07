export const DEFAULT_IVR_MAX_RETRIES = 3;
export const DEFAULT_IVR_SESSION_SECONDS = 15 * 60;

const entryState = (prompt) =>
  Object.freeze({
    repeat: Object.freeze({ toState: null, action: prompt }),
    back: Object.freeze({ toState: "main_menu", action: "prompt.main" }),
    main_menu: Object.freeze({
      toState: "main_menu",
      action: "prompt.main",
    }),
    staff_transfer: Object.freeze({
      toState: "staff_transfer",
      action: "transfer.staff",
      terminal: true,
    }),
    goodbye: Object.freeze({
      toState: "goodbye",
      action: "hangup",
      terminal: true,
    }),
    timeout: Object.freeze({ toState: null, action: prompt, retry: true }),
    hangup: Object.freeze({
      toState: "goodbye",
      action: "hangup",
      terminal: true,
    }),
  });

export const DEFAULT_IVR_DEFINITION = Object.freeze({
  main_menu: Object.freeze({
    repeat: Object.freeze({ toState: "main_menu", action: "prompt.main" }),
    staff_transfer: Object.freeze({
      toState: "staff_transfer",
      action: "transfer.staff",
      terminal: true,
    }),
    goodbye: Object.freeze({
      toState: "goodbye",
      action: "hangup",
      terminal: true,
    }),
    timeout: Object.freeze({
      toState: "main_menu",
      action: "prompt.main",
      retry: true,
    }),
    hangup: Object.freeze({
      toState: "goodbye",
      action: "hangup",
      terminal: true,
    }),
  }),
  site_entry: entryState("prompt.site"),
  reservation_entry: entryState("prompt.reservation"),
  pass_entry: entryState("prompt.pass"),
});

export function transitionIvrState({
  stateKey,
  eventType,
  retryCount = 0,
  maxRetries = DEFAULT_IVR_MAX_RETRIES,
  definition = DEFAULT_IVR_DEFINITION,
}) {
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    throw new Error("IVR retry count must be a non-negative integer.");
  }

  if (!Number.isInteger(maxRetries) || maxRetries < 1 || maxRetries > 5) {
    throw new Error("IVR max retries must be between 1 and 5.");
  }

  const state = definition[stateKey];

  if (!state) {
    throw new Error("Unknown IVR state.");
  }

  const transition = state[eventType];

  if (!transition) {
    return {
      fromState: stateKey,
      toState: stateKey,
      action: "prompt.repeat",
      eventType: "invalid",
      retryCount,
      sessionState: "active",
    };
  }

  if (transition.retry) {
    const nextRetry = retryCount + 1;

    if (nextRetry >= maxRetries) {
      return {
        fromState: stateKey,
        toState: "staff_transfer",
        action: "transfer.staff",
        eventType,
        retryCount: nextRetry,
        sessionState: "transferred",
      };
    }

    return {
      fromState: stateKey,
      toState: transition.toState ?? stateKey,
      action: transition.action,
      eventType,
      retryCount: nextRetry,
      sessionState: "active",
    };
  }

  return {
    fromState: stateKey,
    toState: transition.toState,
    action: transition.action,
    eventType,
    retryCount,
    sessionState:
      transition.toState === "staff_transfer"
        ? "transferred"
        : transition.terminal
          ? "completed"
          : "active",
  };
}
