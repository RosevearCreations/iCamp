export type CamperAssistanceCategory =
  | "maintenance"
  | "garbage"
  | "septic"
  | "electrical"
  | "water"
  | "wifi"
  | "noise"
  | "security"
  | "rental"
  | "store"
  | "other";

export type CamperAssistanceSeverity = "routine" | "soon" | "urgent";
export type CamperAssistanceContactPreference =
  | "in_app"
  | "email"
  | "sms"
  | "phone"
  | "none";

export const CAMPER_ASSISTANCE_CATEGORIES: readonly CamperAssistanceCategory[];
export const CAMPER_ASSISTANCE_SEVERITIES: readonly CamperAssistanceSeverity[];
export const CAMPER_ASSISTANCE_CONTACT_PREFERENCES: readonly CamperAssistanceContactPreference[];

export function normalizeCamperAssistanceSource(value?: unknown): string;
export function normalizeCamperAssistanceInput(input?: Record<string, unknown>): {
  category: CamperAssistanceCategory;
  severity: CamperAssistanceSeverity;
  summary: string;
  details: string | null;
  contactPreference: CamperAssistanceContactPreference;
};
export function normalizeCamperAssistanceClientRequestId(value: unknown): string;
export function camperAssistanceFingerprint(input: {
  reservationId: string;
  sourceChannel?: unknown;
  input?: Record<string, unknown>;
}): string;
