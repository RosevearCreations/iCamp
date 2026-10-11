export interface MapLayerDefinition {
  readonly key:
    | "booking"
    | "maintenance"
    | "security"
    | "utilities"
    | "amenities"
    | "management";
  readonly displayName: string;
  readonly iconKey: string;
  readonly sortOrder: number;
  readonly visibilityPermissionKey: string;
}
export const mapLayerDefinitions: readonly MapLayerDefinition[];
export const mapLayerIconKeys: readonly string[];
export const mapPolygonIconKeys: readonly string[];
export const mapLayerVisibilityPermissionKeys: readonly string[];
export function validateLayerKey(value: unknown): MapLayerDefinition["key"];
export function validateLayerIconKey(value: unknown): string;
export function validatePolygonIconKey(value: unknown): string | null;
export function validateLayerVisibilityPermissionKey(value: unknown): string;
export function validateLayerDisplayName(value: unknown): string;
export function validateMapLabel(value: unknown): string;
