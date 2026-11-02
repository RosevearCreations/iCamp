export interface OfficeBookingInventoryItem {
  id: string;
  code: string;
  displayName: string;
  accommodationKind: string;
  campsiteType: string | null;
  serviceLevel: string | null;
  stayProfile: string | null;
  accommodationId: string;
  availabilityRevision: number;
  available: boolean;
  blockers: string[];
}

export interface OfficeBookingOverflowArea {
  id: string;
  code: string;
  displayName: string;
  notes: string | null;
  isActive: boolean;
  rowVersion: number;
  availableCount: number;
  members: OfficeBookingInventoryItem[];
}

export interface OfficeBookingInventory {
  campground: {
    id: string;
    name: string;
  };
  window: {
    arrivalDate: string;
    departureDate: string;
  };
  walkUpInventory: OfficeBookingInventoryItem[];
  overflowAreas: OfficeBookingOverflowArea[];
}

export function closeOfficeBookingPoolForTests(): Promise<void>;

export function listOfficeBookingInventory(input: {
  userId: string;
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
}): Promise<OfficeBookingInventory>;

export function createOverflowArea(input: {
  actorUserId: string;
  campgroundId: string;
  input: {
    code: string;
    displayName: string;
    notes?: string | null;
  };
  reason: string;
}): Promise<{
  id: string;
  code: string;
  displayName: string;
}>;

export function setOverflowAreaMembers(input: {
  actorUserId: string;
  campgroundId: string;
  overflowAreaId: string;
  accommodationIds: string[];
  reason: string;
}): Promise<{
  overflowAreaId: string;
  accommodationIds: string[];
}>;
