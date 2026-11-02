export const stockKinds: readonly string[];
export const countDecisions: readonly string[];
export const posDispositions: readonly string[];
export function stockUuid(input: unknown, label?: string): string;
export function normalizeStockLocation(input: Record<string, unknown>): {
  id: string;
  locationCode: string;
  displayName: string;
};
export function normalizeReorderRule(input: Record<string, unknown>): {
  productId: string;
  expectedVersion: number;
  reorderPoint: number;
  targetQuantity: number;
};
export function normalizeStockOperation(input: Record<string, unknown>): {
  id: string;
  productId: string;
  locationId: string;
  kind: string;
  quantity: number;
  expectedVersion: number;
  targetLocationId: string | null;
  targetVersion: number | null;
  posSessionId: string | null;
  expectedCashCents: number | null;
  sourceReference: string;
  reasonNote: string;
};
export function normalizePosOpen(input: Record<string, unknown>): {
  id: string;
  registerCode: string;
  openingCashCents: number;
};
export function normalizePosClose(input: Record<string, unknown>): {
  sessionId: string;
  expectedVersion: number;
  observedCashCents: number;
  note: string;
};
export function normalizeStockCount(input: Record<string, unknown>): {
  id: string;
  productId: string;
  locationId: string;
  observedQuantity: number;
  sourceReference: string;
  reasonNote: string;
};
export function normalizeCountReview(input: Record<string, unknown>): {
  id: string;
  countId: string;
  adjustmentEventId: string;
  decision: string;
  reasonNote: string;
};
export function normalizePosReview(input: Record<string, unknown>): {
  id: string;
  sessionId: string;
  disposition: string;
  reasonNote: string;
};
export function reorderSuggestions(
  products: Array<{ id: string; name: string }>,
  balances: Array<{
    productId: string;
    rowVersion: number;
    quantityOnHand: number;
  }>,
  rules: Array<{
    productId: string;
    reorderPoint: number;
    targetQuantity: number;
  }>,
): Array<{
  productName: string;
  quantity: number | null;
  suggestedQuantity: number;
  needsOpeningCount: boolean;
  productId: string;
  reorderPoint: number;
  targetQuantity: number;
}>;
