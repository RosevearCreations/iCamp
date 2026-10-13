import type {
  BookingCalendarPeriod,
  BookingDateEvaluation,
  BookingRulePolicy,
} from "./core.mjs";

export interface BookingRuleSnapshot {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  policy: BookingRulePolicy & {
    rowVersion: number;
    persisted: boolean;
  };
  periods: BookingCalendarPeriod[];
}

export function closeBookingRulesPoolForTests(): Promise<void>;
export function getBookingRuleSnapshot(
  userId: string,
  campgroundId: string,
): Promise<BookingRuleSnapshot>;
export function saveBookingRulePolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  checkInTime: string;
  checkOutTime: string;
  minimumBookingLeadDays: number;
  maximumBookingLeadDays: number;
  minimumStayNights: number;
  maximumStayNights: number;
  weekendIsoDays: number[];
}): Promise<BookingRulePolicy & { rowVersion: number; persisted: boolean }>;
export function createBookingCalendarPeriod(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  periodKind: string;
  code: string;
  displayName: string;
  startsOn: string;
  endsOn: string;
  minimumStayNights?: number | string | null;
  maximumStayNights?: number | string | null;
  notes?: string | null;
}): Promise<BookingCalendarPeriod>;
export function archiveBookingCalendarPeriod(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  periodId: string;
  expectedRowVersion: number;
}): Promise<BookingCalendarPeriod>;
export function evaluateCampgroundBookingDates(input: {
  userId: string;
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
  bookingDate: string;
}): Promise<BookingDateEvaluation>;
