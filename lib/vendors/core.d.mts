export const vendorCategories: readonly string[];
export const vendorEventKinds: readonly string[];
export function vendorUuid(value: unknown, label?: string): string;
export function vendorDate(value: unknown, label: string): string;
export type VendorProfile = {
  id: string;
  displayName: string;
  serviceCategory: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  privateNote: string;
};
export type VendorContract = {
  id: string;
  vendorId: string;
  supersedesContractId: string | null;
  contractReference: string;
  title: string;
  validFrom: string;
  expiresOn: string;
  responseTargetHours: number;
  completionTargetDays: number;
  documentMediaId: string | null;
  privateNote: string;
};
export type VendorRecurring = {
  id: string;
  vendorId: string;
  contractId: string | null;
  supersedesPlanId: string | null;
  serviceLabel: string;
  cadenceDays: number;
  nextDueOn: string;
  privateNote: string;
};
export type VendorRequest = {
  id: string;
  vendorId: string;
  contractId: string | null;
  recurringPlanId: string | null;
  workOrderId: string | null;
  title: string;
  requestDescription: string;
  responseTargetHours: number;
  completionTargetDays: number;
};
export type VendorEvent = {
  id: string;
  requestId: string;
  kind: string;
  sourceReference: string | null;
  note: string;
  evidenceMediaId: string | null;
  reviewsEventId: string | null;
};
export function normalizeVendorProfile(input: unknown): VendorProfile;
export function normalizeVendorContract(input: unknown): VendorContract;
export function normalizeVendorRecurring(input: unknown): VendorRecurring;
export function normalizeVendorRequest(input: unknown): VendorRequest;
export function normalizeVendorEvent(input: unknown): VendorEvent;
export function assessVendorRequest(
  request: VendorRequest & { responseDueAt: string; completionDueAt: string },
  events: Array<VendorEvent & { recordedAt: string }>,
  now?: Date,
): {
  flags: string[];
  closed: boolean;
  hasResponse: boolean;
  pendingInvoices: number;
  status: string;
};
export function assessVendorContract(
  contract: VendorContract,
  contracts: VendorContract[],
  now?: Date,
): { superseded: boolean; daysRemaining: number; flag: string };
export function assessVendorRecurring(
  plan: VendorRecurring,
  plans: VendorRecurring[],
  now?: Date,
): { superseded: boolean; daysUntil: number; flag: string };
