export interface Booking258Window {
  valid: true;
  status: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  nightsLabel: string;
  departureExclusive: true;
  siteHeld: false;
  bookingConfirmed: false;
}
export interface Waitlist258Entry {
  id: string;
  code: string;
  displayName: string;
  arrivalDate: string;
  departureDate: string;
  queuedAt: string;
  state: string;
}
export function listStaffWaitlist258(input: {
  actorUserId: string;
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
}): Promise<{
  status: string;
  window: Booking258Window;
  generatedAt: string;
  sites: Array<{
    accommodationId: string;
    code: string;
    displayName: string;
    available: boolean;
    blockers: string[];
  }>;
  entries: Waitlist258Entry[];
  instrument: {
    schema?: string;
    sourceAppId?: string;
    protocol?: string;
    bookingInventory?: {
      available: number;
      reservedOrHeld: number;
      maintenance: number;
      closed: number;
      total: number;
    } | null;
    integration?: string;
    issues?: string[];
    homeAutomationCommandsAllowed?: false;
    status?: string;
  };
  bookingCreated: false;
  autoPromotion: false;
}>;
export function createStaffWaitlistInterest258(input: {
  actorUserId: string;
  campgroundId: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
  requestKey: string;
}): Promise<{ status: string; id?: string; holdsCreated: 0 }>;
export function recordStaffWaitlistReview258(input: {
  actorUserId: string;
  campgroundId: string;
  waitlistId: string;
  action: string;
}): Promise<{
  status: string;
  holdsCreated: 0;
  guestNotified: false;
}>;
