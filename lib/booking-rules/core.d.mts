export interface BookingRulePolicy {
  checkInTime: string;
  checkOutTime: string;
  minimumBookingLeadDays: number;
  maximumBookingLeadDays: number;
  minimumStayNights: number;
  maximumStayNights: number;
  weekendIsoDays: number[];
}

export interface BookingCalendarPeriodInput {
  periodKind: "holiday" | "season";
  code: string;
  displayName: string;
  startsOn: string;
  endsOn: string;
  minimumStayNights: number | null;
  maximumStayNights: number | null;
  notes: string | null;
}

export interface BookingCalendarPeriod extends BookingCalendarPeriodInput {
  id: string;
  isActive: boolean;
  rowVersion: number;
  createdAt?: string;
  archivedAt?: string | null;
}

export interface BookingDateEvaluation {
  eligible: boolean;
  issues: string[];
  nights: number;
  leadDays: number;
  checkInTime: string;
  checkOutTime: string;
  effectiveMinimumStay: number;
  effectiveMaximumStay: number;
  weekendNights: number;
  holidayNames: string[];
  seasonNames: string[];
  appliedPeriodIds: string[];
}

export const defaultBookingRulePolicy: Readonly<BookingRulePolicy>;
export function normalizeDate(value: unknown, label?: string): string;
export function validateBookingPolicyInput(
  input: Partial<BookingRulePolicy>,
): BookingRulePolicy;
export function validateCalendarPeriodInput(
  input: Record<string, unknown>,
): BookingCalendarPeriodInput;
export function evaluateBookingDateRules(input: {
  policy: BookingRulePolicy;
  periods?: BookingCalendarPeriod[];
  arrivalDate: string;
  departureDate: string;
  bookingDate: string;
}): BookingDateEvaluation;
export function dateInTimeZone(timeZone: string, instant?: Date): string;
