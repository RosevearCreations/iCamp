export interface MyStaySettingsInput {
  guestRulesSummary: string | null;
  wifiNetworkName: string | null;
  wifiAccessInstructions: string | null;
  assistanceInstructions: string | null;
  storeUrl: string | null;
  rentalsUrl: string | null;
  eventsUrl: string | null;
  localInterestsUrl: string | null;
  assistanceUrl: string | null;
}

export function normalizeMyStayHandoffUrl(
  value: unknown,
  label?: string,
): string | null;

export function normalizeMyStaySettingsInput(
  input?: Record<string, unknown>,
): MyStaySettingsInput;

export function myStayPhase(input: {
  status: string;
  arrivalDate: string;
  departureDate: string;
  localDate: string;
}): string;
