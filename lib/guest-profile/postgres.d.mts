export interface GuestProfile {
  id: string;
  organizationId: string;
  campgroundId: string;
  userAccountId: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredContactChannel: "email" | "sms" | "phone" | "none";
  saveStayPreferences: boolean;
  allowStaffProfileLookup: boolean;
  profileState: string;
  privacyUpdatedAt: string | null;
  rowVersion: number;
}

export interface GuestProfileDetail {
  profile: GuestProfile;
  rvs: Array<{
    id: string;
    nickname: string;
    rvKind: string;
    make: string | null;
    model: string | null;
    modelYear: number | null;
    lengthFeet: number | null;
    slideOutCount: number;
    electricalServiceAmps: number | null;
    notes: string | null;
    rowVersion: number;
  }>;
  vehicles: Array<{
    id: string;
    nickname: string;
    vehicleKind: string;
    make: string | null;
    model: string | null;
    color: string | null;
    modelYear: number | null;
    notes: string | null;
    rowVersion: number;
  }>;
  pets: Array<{
    id: string;
    name: string;
    species: string;
    breed: string | null;
    weightKg: number | null;
    notes: string | null;
    rowVersion: number;
  }>;
  stays: Array<{
    id: string;
    status: string;
    arrivalDate: string | null;
    departureDate: string | null;
    sourceChannel: string;
    accommodationCode: string;
    accommodationName: string;
    confirmationNumber: string | null;
    totalCents: number;
    currencyCode: string;
  }>;
  receipts: Array<{
    id: string;
    reservationId: string;
    receiptNumber: string;
    paymentPurpose: string;
    currencyCode: string;
    amountCents: number;
    issuedAt: string | null;
  }>;
  seasonalAssignments: Array<{
    id: string;
    assignmentKind: string;
    assignmentState: string;
    occupancyState: string;
    startsOn: string | null;
    endsOn: string | null;
    chargeAmountCents: number | null;
    currencyCode: string;
    accommodationCode: string;
    accommodationName: string;
  }>;
  events: Array<{
    id: string;
    eventKind: string;
    sourceChannel: string;
    summary: string;
    metadata: Record<string, unknown>;
    occurredAt: string | null;
  }>;
  canManage: boolean;
  owner: boolean;
}

export function closeGuestProfilePoolForTests(): Promise<void>;

export function listOwnGuestProfileScopes(input: { userId: string }): Promise<
  Array<{
    campgroundId: string;
    campgroundName: string;
    profileId: string | null;
    profileState: string | null;
  }>
>;

export function listGuestProfileDesk(input: {
  userId: string;
  campgroundId: string;
}): Promise<
  Array<
    GuestProfile & {
      rvCount: number;
      vehicleCount: number;
      petCount: number;
      stayCount: number;
    }
  >
>;

export function getGuestProfileDetail(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
}): Promise<GuestProfileDetail>;

export function getOwnGuestProfileDetail(input: {
  userId: string;
  campgroundId: string;
}): Promise<GuestProfileDetail | null>;

export function saveOwnGuestProfile(input: {
  userId: string;
  campgroundId: string;
  input: Record<string, unknown>;
  expectedRowVersion?: number | null;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<GuestProfile>;

export function saveStaffGuestProfile(input: {
  actorUserId: string;
  campgroundId: string;
  profileId?: string | null;
  accountEmail?: string | null;
  input: Record<string, unknown>;
  expectedRowVersion?: number | null;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<GuestProfile>;

export function saveGuestRvProfile(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
  input: Record<string, unknown>;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<string>;

export function saveGuestVehicleProfile(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
  input: Record<string, unknown>;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<string>;

export function saveGuestPetProfile(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
  input: Record<string, unknown>;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<string>;

export function archiveGuestSavedItem(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
  itemId: string;
  itemKind: "rv" | "vehicle" | "pet";
  expectedRowVersion: number;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<boolean>;

export function linkGuestProfileToReservation(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
  reservationId: string;
  sourceChannel?: "staff" | "ivr" | "sms" | "system";
}): Promise<boolean>;

export function linkGuestProfileToSeasonalAssignment(input: {
  actorUserId: string;
  campgroundId: string;
  profileId: string;
  assignmentId: string;
  sourceChannel?: "staff" | "ivr" | "sms" | "system";
}): Promise<boolean>;
