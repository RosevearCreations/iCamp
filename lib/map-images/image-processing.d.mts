export interface OverheadImageDimensions {
  width: number;
  height: number;
  pixels: number;
}

export interface SanitizedOverheadImage extends OverheadImageDimensions {
  bytes: Uint8Array;
}

export function inspectOverheadImage(
  bytes: Uint8Array | ArrayBuffer | ArrayBufferView,
  contentType: string,
): OverheadImageDimensions;

export function sanitizeOverheadImage(
  bytes: Uint8Array | ArrayBuffer | ArrayBufferView,
  contentType: string,
): SanitizedOverheadImage;
