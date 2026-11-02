export interface AccommodationGalleryImage {
  id: string;
  organizationId: string;
  campgroundId: string;
  accommodationId: string;
  caption: string | null;
  altText: string;
  sortOrder: number;
  isHero: boolean;
  isActive: boolean;
  sourceWidth: number;
  sourceHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  optimizedWidth: number;
  optimizedHeight: number;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  optimizedUrl: string | null;
  rowVersion: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface GalleryMediaInput {
  id: string;
  bucketKey: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  width: number;
  height: number;
}

export function closeGalleryPoolForTests(): Promise<void>;

export function listAccommodationGalleries(
  userId: string,
  campgroundId: string,
): Promise<AccommodationGalleryImage[]>;

export function registerAccommodationGalleryImage(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  organizationId: string;
  campgroundId: string;
  accommodationId: string;
  caption?: string | null;
  altText: string;
  source: GalleryMediaInput;
  thumbnail: GalleryMediaInput;
  optimized: GalleryMediaInput;
}): Promise<string>;

export function updateAccommodationGalleryImage(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  galleryImageId: string;
  expectedRowVersion: number;
  caption?: string | null;
  altText: string;
  sortOrder: number | string;
  makeHero?: boolean;
}): Promise<number>;

export function archiveAccommodationGalleryImage(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  galleryImageId: string;
  expectedRowVersion: number;
}): Promise<void>;
