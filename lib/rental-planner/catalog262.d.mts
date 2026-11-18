export interface RentalTemplate262 {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly kind: "equipment" | "facility";
  readonly assetType: string;
  readonly examples: string;
  readonly guidance: string;
}
export const RENTAL_CATEGORIES262: readonly RentalTemplate262[];
export function rentalTemplates262(kind: string, assetType: string): RentalTemplate262[];
export function findRentalTemplate262(id: string): RentalTemplate262 | null;
