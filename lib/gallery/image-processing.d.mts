export interface GalleryDimensions {
  width: number;
  height: number;
}

export function inspectGalleryWebpVariant(
  bytesValue: Uint8Array | ArrayBuffer | ArrayBufferView,
  variant: "thumbnail" | "optimized",
): Readonly<GalleryDimensions>;

export function assertMatchingGalleryAspectRatio(
  source: GalleryDimensions,
  variant: GalleryDimensions,
): void;
