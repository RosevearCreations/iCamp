export type MediaClassification = "public" | "internal" | "confidential";
export type MediaKind = "image" | "document";

export const MEDIA_CLASSIFICATIONS: readonly MediaClassification[];
export const MEDIA_BUCKETS: Readonly<Record<MediaClassification, string>>;
export const IMAGE_MAX_BYTES: number;
export const DOCUMENT_MAX_BYTES: number;

export type MediaValidationSuccess = {
  ok: true;
  classification: MediaClassification;
  mediaKind: MediaKind;
  contentType: string;
  byteSize: number;
  canonicalExtension: ".jpg" | ".png" | ".webp" | ".gif" | ".pdf";
  bucketKey: string;
};

export type MediaValidationFailure = {
  ok: false;
  code: string;
  message: string;
};

export function mediaBucketForClassification(
  classification: MediaClassification,
): string;

export function validateMediaUpload(input: {
  classification: string;
  filename: string;
  contentType: string;
  byteSize: number;
  headerBytes: Uint8Array | ArrayBuffer | ArrayBufferView;
}): MediaValidationSuccess | MediaValidationFailure;

export function buildMediaObjectKey(input: {
  organizationId: string;
  campgroundId: string;
  assetId: string;
  canonicalExtension: ".jpg" | ".png" | ".webp" | ".gif" | ".pdf";
}): string;
