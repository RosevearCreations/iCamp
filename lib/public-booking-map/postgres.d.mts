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
