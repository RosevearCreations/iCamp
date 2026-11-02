export const storeCategories: readonly string[];
export function storeUuid(value: unknown, label?: string): string;
export function storeDate(value: unknown): string;
export function normalizeStoreProduct(input: {
  sku: unknown;
  name: unknown;
  description: unknown;
  category: unknown;
  stock: unknown;
  isPublished: boolean;
}): {
  sku: string;
  name: string;
  description: string;
  category: string;
  stock: number | null;
  isPublished: boolean;
};
export function storeQuantity(value: unknown, allowRemove?: boolean): number;
export function normalizeStoreDelivery(input: {
  fulfillmentPreference: unknown;
  reservationId: unknown;
  deliveryDate: unknown;
  deliveryNote: unknown;
}): {
  fulfillmentPreference: string;
  reservationId: string | null;
  deliveryDate: string | null;
  deliveryNote: string;
};
export function storeStockLabel(product: {
  staffReportedStock: number | null;
  stockVerifiedAt: string | null;
}): string;
