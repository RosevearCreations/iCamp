export interface MapLayerRecord {
  id: string;
  organizationId: string;
  campgroundId: string;
  key:
    | "booking"
    | "maintenance"
    | "security"
    | "utilities"
    | "amenities"
    | "management";
  displayName: string;
  iconKey: string;
  sortOrder: number;
  visibilityPermissionKey: string;
  isEnabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  rowVersion: number;
}
export function closeMapLayerPoolForTests(): Promise<void>;
export function listMapLayers(
  userId: string,
  campgroundId: string,
): Promise<MapLayerRecord[]>;
export function updateMapLayer(input: {
  actorUserId: string;
  campgroundId: string;
  layerId: string;
  expectedRowVersion: number;
  displayName: string;
  iconKey: string;
  visibilityPermissionKey: string;
  isEnabled: boolean;
}): Promise<MapLayerRecord>;
export function moveMapLayer(input: {
  actorUserId: string;
  campgroundId: string;
  layerId: string;
  expectedRowVersion: number;
  direction: "up" | "down";
}): Promise<MapLayerRecord>;
