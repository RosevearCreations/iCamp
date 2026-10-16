import type { MyStaySettingsInput } from "./core.mjs";

export interface MyStayListItem {
  id: string;
  status: string;
  phase: string;
  arrivalDate: string;
  departureDate: string;
  campgroundLocalDate: string;
  campgroundName: string;
  campgroundSlug: string;
  accommodationCode: string;
  accommodationName: string;
  accommodationKind: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

export interface MyStayPortalSettings extends MyStaySettingsInput {
  persisted: boolean;
  rowVersion: number;
}

export interface MyStayReceipt {
  id: string;
  receiptNumber: string;
  paymentPurpose: string;
  currencyCode: string;
  amountCents: number;
  issuedAt: string | null;
}

export interface MyStayDetail {
  reservation: {
    id: string;
    status: string;
    phase: string;
    rowVersion: number;
    arrivalDate: string;
    departureDate: string;
    campgroundLocalDate: string;
    campground: {
      id: string;
      name: string;
      slug: string;
      timezone: string;
    };
    accommodation: {
      id: string;
      code: string;
      displayName: string;
      kind: string;
      statusState: string;
      mapObjectId: string | null;
    };
  };
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  party: {
    occupants: number;
    visitors: number;
    pets: number;
    vehicles: number;
  };
  rules: {
    currentCheckInTime: string | null;
    currentCheckOutTime: string | null;
    bookingSnapshot: unknown;
    bookingAcknowledgedAt: string | null;
    checkInAcknowledgedAt: string | null;
    guestSummary: string | null;
  };
  wifi: {
    service: string | null;
    networkName: string | null;
    accessInstructions: string | null;
  };
  campsite: {
    campsiteType: string;
    serviceLevel: string;
    isWaterfront: boolean;
    electricalAmperage: number;
    waterService: string;
    wastewaterService: string;
    surfaceType: string;
    pullThrough: boolean;
    shadeLevel: string;
    hasFireRing: boolean;
    hasPicnicTable: boolean;
  } | null;
  cottage: {
    cottageStyle: string;
    bedroomCount: number;
    bedCount: number;
    maxOccupancy: number;
    kitchenType: string;
    washroomType: string;
    showerType: string;
    heatingType: string;
    coolingType: string;
    hasRefrigerator: boolean;
    hasCooktop: boolean;
    hasOven: boolean;
    hasMicrowave: boolean;
    stepFreeAccess: boolean;
    accessibleWashroom: boolean;
    viewType: string;
  } | null;
  payment: {
    currencyCode: string;
    expectedPayableCents: number;
    capturedCents: number;
    outstandingCents: number;
    balanceDueDate: string | null;
    financialReviewRequired: boolean;
    financialReviewReason: string | null;
  };
  checkIn: {
    id: string;
    checkedInAt: string | null;
    credentialHandoffState: string;
  } | null;
  checkOut: {
    id: string;
    checkedOutAt: string | null;
    financialHandoffState: string;
    outstandingBalanceCents: number;
    rentalReturnState: string;
    keyReturnState: string;
    credentialReturnState: string;
    turnoverState: string;
  } | null;
  documents: {
    confirmationNumber: string | null;
    invoiceNumber: string | null;
    receipts: MyStayReceipt[];
  };
  portal: MyStayPortalSettings;
}

export function closeMyStayPoolForTests(): Promise<void>;

export function listMyStays(input: {
  userId: string;
}): Promise<MyStayListItem[]>;

export function getMyStayDetail(input: {
  userId: string;
  reservationId: string;
}): Promise<MyStayDetail | null>;

export function getMyStaySettingsForStaff(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  campground: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
  };
  settings: MyStayPortalSettings;
}>;

export function saveMyStaySettings(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  input: Record<string, unknown>;
}): Promise<MyStayPortalSettings>;
