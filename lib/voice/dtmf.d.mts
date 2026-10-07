export type DtmfInputKind =
  | "menu"
  | "site"
  | "reservation"
  | "pass"
  | "pin"
  | "verification";

export interface NormalizedDtmfInput {
  inputKind: DtmfInputKind;
  digits: string | null;
  digitCount: number;
  sensitive: boolean;
}

export interface DtmfTransitionResult {
  fromState: string;
  toState: string;
  action: string;
  eventType: string;
  retryCount: number;
  sessionState: "active" | "transferred";
  inputKind: DtmfInputKind;
  digitCount: number;
  sensitive: boolean;
  transientEntry: null | {
    kind: "site" | "reservation" | "pass";
    value: string;
  };
}

export const DTMF_MAX_DIGITS: number;
export const DTMF_ENTRY_MAX_DIGITS: number;

export function isSensitiveDtmfKind(inputKind: DtmfInputKind | string): boolean;
export function maskDtmfDigits(digits: string | null): string;
export function summarizeDtmfInput(input?: {
  inputKind?: DtmfInputKind | string;
  digits?: string | null;
}): {
  inputKind: DtmfInputKind;
  digitCount: number;
  sensitive: boolean;
  maskedValue: string;
};
export function normalizeDtmfProviderInput(input: {
  eventType: "dtmf.input" | "dtmf.timeout";
  inputKind?: DtmfInputKind | string;
  digits?: string | null;
}): NormalizedDtmfInput;
export function routeDtmfInput(input: {
  stateKey: string;
  inputKind?: DtmfInputKind | string;
  digits?: string | null;
  timedOut?: boolean;
  retryCount?: number;
  maxRetries?: number;
}): DtmfTransitionResult;
