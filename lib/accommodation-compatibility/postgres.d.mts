export interface CompatibilityAccommodation {
  id: string;
  campgroundId: string;
  sectionId: string;
  sectionName: string;
  code: string;
  displayName: string;
  accommodationKind: "campsite" | "rental_cottage" | "permanent_unit";
  campsiteType: "tent" | "rv" | "mixed" | null;
  electricalAmperage: number | null;
  waterService: string | null;
  wastewaterService: string | null;
  wifiService: string | null;
  maxRvLengthMeters: number | null;
  maxRvWidthMeters: number | null;
  maxRvHeightMeters: number | null;
  accessibleSite: boolean;
  physicalMaxOccupancy: number | null;
  kitchenType: string | null;
  washroomType: string | null;
  showerType: string | null;
  stepFreeAccess: boolean;
  accessibleWashroom: boolean;
  hasRefrigerator: boolean;
  petsAllowed: boolean;
  maxPets: number;
  detailRowVersion: number;
}

export interface CompatibilityRequest {
  lodgingKind?: string;
  occupants?: number | string;
  visitors?: number | string;
  vehicles?: number | string;
  pets?: number | string;
  rvLengthMeters?: number | string | null;
  rvWidthMeters?: number | string | null;
  rvHeightMeters?: number | string | null;
  electricalAmperage?: number | string;
  needsWaterAtSite?: boolean | string;
  needsWastewaterAtSite?: boolean | string;
  needsWifi?: boolean | string;
  needsStepFreeAccess?: boolean | string;
  needsAccessibleWashroom?: boolean | string;
  requiredFeatures?: string[];
}

export interface CompatibilityResult {
  eligible: boolean;
  issues: string[];
  accommodationId: string;
  accommodationKind: string;
  request: CompatibilityRequest;
  capacity: unknown;
}

export function getCompatibilitySnapshot(
  userId: string,
  campgroundId: string,
): Promise<CompatibilityAccommodation[]>;

export function updateCompatibilityPolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  accommodationId: string;
  expectedRowVersion: number;
  accessibleSite?: boolean;
  petsAllowed?: boolean;
  maxPets?: number;
}): Promise<void>;

export function evaluateBookingCompatibility(input: {
  userId: string;
  campgroundId: string;
  accommodationId: string;
  request: CompatibilityRequest;
}): Promise<CompatibilityResult>;

export function assertServerCompatibleBookingChoice(input: {
  userId: string;
  campgroundId: string;
  accommodationId: string;
  request: CompatibilityRequest;
}): Promise<CompatibilityResult>;

export function closeAccommodationCompatibilityPoolForTests(): Promise<void>;
