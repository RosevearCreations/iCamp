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
export interface Booking258Hold {
  valid: false;
  code: string;
  siteHeld: false;
  bookingConfirmed: false;
  waitlistOffered: false;
}
export interface Booking258InventoryCounts {
  available: number;
  reservedOrHeld: number;
  maintenance: number;
  closed: number;
  total: number;
}
export function reviewBookingWindow(input?: {
  arrivalDate?: string;
  departureDate?: string;
  maxNights?: number;
  nowDate?: string | null;
}): Booking258Window | Booking258Hold;
export function summarizePublicInventory(
  items: ReadonlyArray<{ tone: string; selectable: boolean }>,
  window: Booking258Window | Booking258Hold,
): {
  status: string;
  counts: Booking258InventoryCounts | null;
  generatedAtRequired?: true;
  noInventoryReservation?: true;
  noWaitlistOffer?: true;
};
export function buildICampInstrumentSignal(input: {
  sourceRevision?: string;
  observedAt?: string;
  availability?: {
    status: string;
    counts: Booking258InventoryCounts | null;
  } | null;
  integrationStatus?: string;
  databaseStatus?: string;
}): {
  status?: string;
  schema?: string;
  sourceAppId?: string;
  platformRole?: string;
  protocol?: string;
  backwardCompatible?: string;
  revision?: string;
  observedAt?: string;
  bookingInventory?: Booking258InventoryCounts | null;
  database?: string;
  integration?: string;
  issues?: string[];
  customerDataIncluded?: false;
  crossAppDeliveryAuthorized?: false;
  homeAutomationCommandsAllowed?: false;
  receiverConnected?: false;
};
export function reviewWaitlistInterest(input: {
  campgroundId: string;
  accommodationId: string;
  requestKey: string;
  arrivalDate: string;
  departureDate: string;
  availabilityBlockers: string[] | null | undefined;
}):
  | Booking258Hold
  | {
      valid: true;
      status: string;
      sourceWindow: Booking258Window;
      automaticPromotion: false;
      allocatesInventory: false;
      requiresStaffVerification: true;
      bookingConfirmed: false;
    };
