import type { StoredMapPolygon } from "./geometry.mjs";

export interface MapPolygonRecord {
  id: string;
  organizationId: string;
  campgroundId: string;
  mapImageVersionId: string;
  label: string;
  geometry: StoredMapPolygon;
  layerId: string;
  layerKey: string | null;
  layerDisplayName: string | null;
  layerIconKey: string | null;
  layerSortOrder: number | null;
  layerVisibilityPermissionKey: string | null;
  mapLabel: string;
  mapIconKey: string | null;
  mapLabelVisible: boolean;
  isLocked: boolean;
  isHidden: boolean;
  archivedAt: string | Date | null;
  archivedByUserId: string | null;
  duplicatedFromPolygonId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  rowVersion: number;
}

export function closeMapPolygonPoolForTests(): Promise<void>;

export function listMapPolygons(
  userId: string,
  campgroundId: string,
  mapImageVersionId: string,
): Promise<MapPolygonRecord[]>;

export function saveMapPolygon(input: {
  actorUserId: string;
  campgroundId: string;
  mapImageVersionId: string;
  polygonId?: string | null;
  expectedRowVersion?: number;
  label: string;
  geometry: StoredMapPolygon;
  layerId: string;
  mapLabel: string;
  mapIconKey?: string | null;
  mapLabelVisible: boolean;
}): Promise<MapPolygonRecord>;

export function duplicateMapPolygon(input: {
  actorUserId: string;
  campgroundId: string;
  mapImageVersionId: string;
  polygonId: string;
  expectedRowVersion: number;
}): Promise<MapPolygonRecord>;

export function setMapPolygonState(input: {
  actorUserId: string;
  campgroundId: string;
  mapImageVersionId: string;
  polygonId: string;
  expectedRowVersion: number;
  state: "locked" | "hidden" | "archived";
  enabled: boolean;
}): Promise<MapPolygonRecord>;
