import type { StoredMapPoint } from "../map-coordinates/transform.mjs";

export type MapObjectKind =
  | "site"
  | "cottage"
  | "pool"
  | "washroom"
  | "gate"
  | "dock"
  | "road"
  | "building"
  | "asset";

export interface MapObjectBindingRecord {
  id: string;
  geometryKind: "polygon" | "point";
  mapImageVersionId: string;
  layerId: string;
  layerKey: string | null;
  layerDisplayName: string | null;
  layerIconKey: string | null;
  layerVisibilityPermissionKey: string | null;
  polygonId: string | null;
  polygonLabel: string | null;
  pointGeometry: StoredMapPoint | null;
  rowVersion: number;
}

export interface MapObjectRecord {
  id: string;
  organizationId: string;
  campgroundId: string;
  kind: MapObjectKind;
  code: string;
  displayName: string;
  sectionId: string | null;
  sectionName: string | null;
  lifecycleState: "active" | "inactive" | "archived";
  archivedAt: string | Date | null;
  rowVersion: number;
  defaultIconKey: string;
  defaultLayerKey: string;
  binding: MapObjectBindingRecord | null;
}

export function closeMapObjectPoolForTests(): Promise<void>;

export function listMapObjects(
  userId: string,
  campgroundId: string,
  mapImageVersionId: string,
): Promise<MapObjectRecord[]>;

export function createMapObject(input: {
  actorUserId: string;
  campgroundId: string;
  kind: string;
  code: string;
  displayName: string;
  sectionId?: string | null;
}): Promise<MapObjectRecord>;

export function bindMapObjectToPolygon(input: {
  actorUserId: string;
  campgroundId: string;
  mapImageVersionId: string;
  mapObjectId: string;
  polygonId: string;
}): Promise<string>;

export function bindMapObjectToPoint(input: {
  actorUserId: string;
  campgroundId: string;
  mapImageVersionId: string;
  mapObjectId: string;
  layerId: string;
  pointGeometry: StoredMapPoint;
}): Promise<string>;

export function unbindMapObject(input: {
  actorUserId: string;
  campgroundId: string;
  mapObjectId: string;
  expectedRowVersion: number;
}): Promise<void>;
