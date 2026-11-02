export const publicAmenityKinds: readonly string[];
export interface PublicWayfindingPoint {
  id: string;
  kind: string;
  code: string;
  name: string;
  description: string;
  accessibilityNote: string;
  landmarkHint: string;
  x: number;
  y: number;
}
export function normalizeWayfindingReview(input?: {
  isPublished?: boolean;
  description?: unknown;
  accessibilityNote?: unknown;
  landmarkHint?: unknown;
}): {
  isPublished: boolean;
  description: string;
  accessibilityNote: string;
  landmarkHint: string;
};
export function publicWayfindingPoint(
  row: {
    id: string;
    kind: string;
    code: string;
    name: string;
    description: string;
    accessibilityNote?: string;
    landmarkHint?: string;
    pointGeometry?: unknown;
  },
  sourceWidth: number,
  sourceHeight: number,
): PublicWayfindingPoint | null;
export function filterPublicWayfinding(
  items: PublicWayfindingPoint[],
  filters?: { query?: string; kind?: string },
): PublicWayfindingPoint[];
