const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function isSafeRequestId(value: string | null): value is string {
  return Boolean(value && REQUEST_ID_PATTERN.test(value));
}
