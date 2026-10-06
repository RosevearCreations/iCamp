export interface MediaAsset {
  id: string;
  organizationId: string;
  campgroundId: string;
  classification: "public" | "internal" | "confidential";
  mediaKind: "image" | "document";
  storageProvider: string;
  bucketKey: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string | null;
  validationState: "pending" | "validated" | "rejected";
  lifecycleState: "pending" | "active" | "quarantined" | "archived" | "deleted";
  createdByUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  activatedAt: Date | string | null;
  archivedAt: Date | string | null;
  deletedAt: Date | string | null;
  rowVersion: number;
}

export function closeMediaPoolForTests(): Promise<void>;

export function registerMediaAsset(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  classification: MediaAsset["classification"];
  mediaKind: MediaAsset["mediaKind"];
  storageProvider?: string;
  bucketKey: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  checksumSha256?: string | null;
  reason: string;
}): Promise<MediaAsset>;

export function transitionMediaAsset(input: {
  actorUserId: string;
  mediaAssetId: string;
  toState: MediaAsset["lifecycleState"];
  reason: string;
}): Promise<MediaAsset>;

export function getMediaAccessDescriptor(mediaAssetId: string): Promise<null | {
  id: string;
  campgroundId: string;
  classification: MediaAsset["classification"];
  storageProvider: string;
  bucketKey: string;
  objectKey: string;
  contentType: string;
  lifecycleState: MediaAsset["lifecycleState"];
}>;

export function getMediaStorageHealth(): Promise<{
  status: "healthy" | "attention";
  registered: number;
  active: number;
  quarantined: number;
  byClassification: {
    public: number;
    internal: number;
    confidential: number;
  };
}>;
