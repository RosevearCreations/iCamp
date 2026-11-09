export interface CampgroundServiceEntry {
  id: string;
  code: string;
  displayName: string;
  description: string;
  chargeKind: string;
  applicationMode: string;
  scopeKind: string;
  pricingBasis: string;
  unitLabel: string;
  unitPriceCents: number;
  percentageBasisPoints: number | null;
  currencyCode: string;
  minimumQuantity: number;
  maximumQuantity: number;
  dailyCapacity: number | null;
  startsOn: string | null;
  endsOn: string | null;
  isPublic: boolean;
  isActive: boolean;
  rowVersion: number;
  editable: boolean;
}
export function listCampgroundServiceCatalogue(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  campgroundName: string;
  entries: CampgroundServiceEntry[];
  truncated: boolean;
}>;
export function createCampgroundService(
  input: Record<string, unknown> & {
    actorUserId: string;
    campgroundId: string;
  },
): Promise<CampgroundServiceEntry>;
export function updateCampgroundService(
  input: Record<string, unknown> & {
    actorUserId: string;
    campgroundId: string;
    chargeId: string;
    expectedRowVersion: number;
  },
): Promise<CampgroundServiceEntry>;
export function archiveCampgroundService(input: {
  actorUserId: string;
  actorSessionId?: string;
  campgroundId: string;
  chargeId: string;
  expectedRowVersion: number;
}): Promise<CampgroundServiceEntry>;
export function closeCatalogPoolForTests(): Promise<void>;
