const REDACTED = "[REDACTED]";

const sensitiveKeyPattern =
  /(authorization|cookie|password|passwd|secret|token|api[-_]?key|pin|card|cvv|session)/i;

export function redactDiagnosticValue(key: string, value: unknown): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return REDACTED;
  }

  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }

  return value;
}

export function sanitizeDiagnosticRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      redactDiagnosticValue(key, value),
    ]),
  );
}
