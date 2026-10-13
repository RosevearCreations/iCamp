export interface OperationalAsset {
  id: string;
  organizationId: string;
  campgroundId: string;
  sectionId: string | null;
  sectionName: string | null;
  mapObjectId: string | null;
  mapObjectKind: string | null;
  mapBound: boolean;
  assetClass: "facility" | "equipment";
  code: string;
  displayName: string;
  lifecycleState: string;
  operatingState: string;
  statusRevision: number;
  notes: string;
  rowVersion: number;
  facility: null | {
    facilityType: string;
    guestVisibility: string;
    rowVersion: number;
  };
  equipment: null | {
    equipmentType: string;
    make: string;
    model: string;
    serialNumber: string;
    ownershipType: string;
    meterKind: string;
    meterValue: number | null;
    storageLocation: string;
    rowVersion: number;
  };
}
export interface OperationalMapObject {
  id: string;
  objectKind: string;
  code: string;
  displayName: string;
  sectionId: string | null;
  sectionName: string | null;
  mapBound: boolean;
}
export function listOperationalAssets(
  userId: string,
  campgroundId: string,
): Promise<OperationalAsset[]>;
export function listOperationalMapObjects(
  userId: string,
  campgroundId: string,
): Promise<OperationalMapObject[]>;
export function createOperationalAsset(
  input: Record<string, unknown>,
): Promise<string>;
export function updateOperationalAsset(
  input: Record<string, unknown>,
): Promise<{ rowVersion: number; statusRevision: number }>;
export function closeOperationalAssetPoolForTests(): Promise<void>;
