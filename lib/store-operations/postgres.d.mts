export interface StockProduct {
  id: string;
  sku: string;
  name: string;
  staffReportedStock: number | null;
}
export interface StockLocation {
  id: string;
  locationCode: string;
  displayName: string;
}
export interface StockBalance {
  productId: string;
  locationId: string;
  quantityOnHand: number;
  rowVersion: number;
  updatedAt: string | null;
}
export interface StockRule {
  productId: string;
  reorderPoint: number;
  targetQuantity: number;
  rowVersion: number;
}
export interface StockEvent {
  id: string;
  productId: string;
  locationId: string;
  kind: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  transferGroupId: string | null;
  posSessionId: string | null;
  expectedCashCents: number | null;
  sourceReference: string;
  reasonNote: string;
  actorUserId: string;
  recordedAt: string | null;
}
export interface PosSession {
  id: string;
  registerCode: string;
  status: string;
  openedByUserId: string;
  closedByUserId: string | null;
  openingCashCents: number;
  expectedCashCents: number | null;
  observedCashCents: number | null;
  openedAt: string | null;
  closedAt: string | null;
  rowVersion: number;
  closingNote: string | null;
}
export interface StockCount {
  id: string;
  productId: string;
  locationId: string;
  expectedQuantity: number;
  expectedVersion: number;
  observedQuantity: number;
  sourceReference: string;
  reasonNote: string;
  countedByUserId: string;
  countedAt: string | null;
}
export interface StockCountReview {
  id: string;
  countId: string;
  decision: string;
  reasonNote: string;
  adjustmentEventId: string | null;
  reviewedByUserId: string;
}
export interface PosReview {
  id: string;
  sessionId: string;
  disposition: string;
  reasonNote: string;
  reviewedByUserId: string;
}
export interface StockDashboard {
  campground: { id: string; name: string; timezone: string };
  permissions: { read: boolean; manage: boolean; audit: boolean };
  products: StockProduct[];
  locations: StockLocation[];
  balances: StockBalance[];
  rules: StockRule[];
  events: StockEvent[];
  sessions: PosSession[];
  counts: StockCount[];
  countReviews: StockCountReview[];
  posReviews: PosReview[];
  suggestions: Array<{
    productId: string;
    productName: string;
    reorderPoint: number;
    targetQuantity: number;
    quantity: number | null;
    suggestedQuantity: number;
    needsOpeningCount: boolean;
  }>;
}
export function closeStoreOperationsPoolForTests(): Promise<void>;
export function storeOperationsPermissions(
  actor: string,
  camp: string,
): Promise<{ read: boolean; manage: boolean; audit: boolean }>;
export function getStoreOperationsDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<StockDashboard>;
interface Mutation {
  actorUserId: string;
  actorSessionId: string | null;
  campgroundId: string;
  input: Record<string, unknown>;
}
export function createStockLocation(input: Mutation): Promise<{ id: string }>;
export function setStockReorderRule(input: Mutation): Promise<{ id: string }>;
export function openStorePosSession(input: Mutation): Promise<{ id: string }>;
export function recordStoreStockOperation(
  input: Mutation,
): Promise<{ id: string }>;
export function recordStoreStockCount(input: Mutation): Promise<{ id: string }>;
export function reviewStoreStockCount(input: Mutation): Promise<{ id: string }>;
export function closeStorePosSession(input: Mutation): Promise<{ id: string }>;
export function reviewStorePosSession(input: Mutation): Promise<{ id: string }>;
