export interface ServicePreset {
  code: string;
  name: string;
  unitLabel: string;
}
export const SERVICE_PRESETS: ReadonlyArray<ServicePreset>;
export function dollarsToCents(value: unknown): number;
export function centsToDollars(value: unknown): string;
export interface ServiceCatalogInput {
  preset?: string;
  code?: string;
  displayName?: string;
  description?: string;
  pricingBasis: string;
  unitLabel?: string;
  minimumQuantity: number | string;
  maximumQuantity: number | string;
  startsOn?: string;
  endsOn?: string;
  priceDollars: string;
  isPublic: boolean;
}
export interface ValidatedServiceCatalogInput {
  code: string;
  displayName: string;
  description: string | null;
  pricingBasis: string;
  unitLabel: string;
  minimumQuantity: number;
  maximumQuantity: number;
  startsOn: string | null;
  endsOn: string | null;
  unitPriceCents: number;
  isPublic: boolean;
}
export function validateServiceCatalogEntry(
  input: ServiceCatalogInput,
): ValidatedServiceCatalogInput;
