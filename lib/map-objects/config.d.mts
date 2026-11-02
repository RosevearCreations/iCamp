export interface MapObjectKindDefinition {
  readonly key:
    | "site"
    | "cottage"
    | "permanent_unit"
    | "pool"
    | "washroom"
    | "gate"
    | "dock"
    | "road"
    | "building"
    | "asset";
  readonly displayName: string;
  readonly defaultIconKey: string;
  readonly defaultLayerKey: string;
}
export const mapObjectKinds: readonly MapObjectKindDefinition[];
export const mapObjectKindKeys: readonly MapObjectKindDefinition["key"][];
export function validateMapObjectKind(
  value: unknown,
): MapObjectKindDefinition["key"];
export function validateMapObjectCode(value: unknown): string;
export function validateMapObjectName(value: unknown): string;
export function mapObjectKindDefinition(
  value: unknown,
): MapObjectKindDefinition | undefined;
