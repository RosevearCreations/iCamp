import type { StoredMapPolygon } from "./geometry.mjs";

export interface MapPolygonRecord {
  id: string;
  organizationId: string;
  campgroundId: string;
  mapImageVersionId: string;
  label: string;
  geometry: StoredMapPolygon;
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
}): Promise<MapPolygonRecord>;
