export interface AmenityStatusAsset {
  id: string;
  assetClass: string;
  lifecycleState: string;
  mapObjectId: string | null;
  displayName: string;
  code: string;
  facility?: { facilityType: string } | null;
  mapObjectKind?: string | null;
  sectionName?: string | null;
  operatingState: string;
  rowVersion: number;
}
export interface AmenityStatusWorkOrder {
  id: string;
  assetId: string | null;
  status: string;
  title: string;
  priorityKey: string;
  isPastCompletionTarget?: boolean;
}
export interface AmenityPublication {
  mapObjectId: string;
  code: string;
  kind: string;
  name: string;
  locationPublished: boolean;
  service: {
    isPublished: boolean;
    operatingStatus: string;
    hoursSummary: string;
    accessibilityDetails: string;
    reviewedAt: string | Date | null;
  };
}
export interface AmenityStatusItem {
  id: string;
  name: string;
  code: string;
  kind: string;
  section: string;
  operatingState: string;
  rowVersion: number | null;
  orders: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    overdue: boolean;
  }>;
  publication: AmenityPublication | null;
  conflicting: boolean;
  needsGuestReview: boolean;
  hasAsset: boolean;
  attention: boolean;
}
export const staffOperatingStates: readonly string[];
export const amenityStatusFilters: readonly string[];
export function normalizeAmenityStatusFilters(input?: {
  filter?: string;
  query?: string;
}): { filter: string; query: string };
export function buildStaffAmenityStatusBoard(input: {
  assets?: AmenityStatusAsset[];
  workOrders?: AmenityStatusWorkOrder[];
  publications?: AmenityPublication[];
  filters?: { filter?: string; query?: string };
}): {
  filter: string;
  query: string;
  items: AmenityStatusItem[];
  counts: {
    total: number;
    attention: number;
    maintenance: number;
    guestReview: number;
  };
};
