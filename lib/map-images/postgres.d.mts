export interface CampgroundMapImageVersion {
  id: string;
  organizationId: string;
  campgroundId: string;
  mediaAssetId: string;
  versionNumber: number;
  label: string;
  notes: string | null;
  sourceWidth: number;
  sourceHeight: number;
  sourceContentType: string;
  sourceByteSize: number;
  sourceChecksumSha256: string;
  isActive: boolean;
  isPublished: boolean;
  createdByUserId: string | null;
  publishedByUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  publishedAt: Date | string | null;
  rowVersion: number;
  originalFilename: string;
  mediaLifecycleState: string;
}

export function listMapImageVersions(
  userId: string,
  campgroundId: string,
): Promise<CampgroundMapImageVersion[]>;

export function registerOverheadMapVersion(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  mediaAssetId: string;
  storageProvider: string;
  bucketKey: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  width: number;
  height: number;
  label: string;
  notes?: string | null;
  reason: string;
}): Promise<CampgroundMapImageVersion>;

export function setActiveMapVersion(input: {
  actorUserId: string;
  campgroundId: string;
  mapVersionId: string;
  expectedRowVersion: number;
}): Promise<CampgroundMapImageVersion>;

export function publishMapVersion(input: {
  actorUserId: string;
  campgroundId: string;
  mapVersionId: string;
  expectedRowVersion: number;
  reason: string;
}): Promise<CampgroundMapImageVersion>;

export function closeMapImagePoolForTests(): Promise<void>;
