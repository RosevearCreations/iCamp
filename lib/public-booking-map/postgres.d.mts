export interface PublicBookingMapCampground {
  id: string;
  name: string;
  slug: string;
}

export interface PublicBookingMapItem {
  accommodationId: string;
  code: string;
  displayName: string;
  accommodationKind: string;
  statusState: string;
  availabilityRevision: number;
  blockers: string[];
  discovery: {
    campsiteType: string | null;
    serviceLevel: string | null;
    isWaterfront: boolean | null;
    electricalAmperage: number | null;
    waterService: string | null;
    wifiService: string | null;
    maxRvLengthMeters: number | null;
    pullThrough: boolean | null;
    hasFireRing: boolean | null;
    hasPicnicTable: boolean | null;
    accessibleSite: boolean | null;
    maxOccupancy: number | null;
    bedroomCount: number | null;
    stepFreeAccess: boolean | null;
    accessibleWashroom: boolean | null;
    kitchenType: string | null;
    petsAllowed: boolean | null;
    maxPets: number | null;
    photoCount: number;
    describedPhotoCount: number;
  };
  geometry: {
    schemaVersion: number;
    closed: boolean;
    vertices: Array<{ image: { x: number; y: number } }>;
  };
  tone: "green" | "grey" | "yellow" | "red";
  label: string;
  selectable: boolean;
}

export function listPublishedBookingCampgrounds(): Promise<
  PublicBookingMapCampground[]
>;
export function isPublishedCampgroundMapMedia(
  mediaAssetId: string,
): Promise<boolean>;
export function getPublicBookingMapSnapshot(input: {
  campgroundSlug: string;
  arrivalDate: string;
  departureDate: string;
  kind?: string;
  availability?: string;
}): Promise<{
  campground: PublicBookingMapCampground;
  map: {
    id: string;
    mediaAssetId: string;
    versionNumber: number;
    label: string;
    sourceWidth: number;
    sourceHeight: number;
    publishedAt: string | Date | null;
  };
  arrivalDate: string;
  departureDate: string;
  kind: string;
  availability: string;
  generatedAt: string;
  items: PublicBookingMapItem[];
}>;
export function closePublicBookingMapPoolForTests(): Promise<void>;
