import type {
  VendorContract,
  VendorEvent,
  VendorProfile,
  VendorRecurring,
  VendorRequest,
} from "./core.mjs";
export type VendorPermissions = {
  read: boolean;
  manage: boolean;
  invoiceReview: boolean;
};
export interface VendorDashboard {
  asOf: string;
  campground: { id: string; name: string; timezone: string };
  permissions: VendorPermissions;
  vendors: Array<VendorProfile & { createdAt: string }>;
  contracts: Array<
    VendorContract & {
      createdAt: string;
      readiness: { superseded: boolean; daysRemaining: number; flag: string };
    }
  >;
  recurringPlans: Array<
    VendorRecurring & {
      createdAt: string;
      readiness: { superseded: boolean; daysUntil: number; flag: string };
    }
  >;
  requests: Array<
    VendorRequest & {
      requestedAt: string;
      responseDueAt: string;
      completionDueAt: string;
      readiness: {
        flags: string[];
        closed: boolean;
        hasResponse: boolean;
        pendingInvoices: number;
        status: string;
      };
    }
  >;
  events: Array<VendorEvent & { actorUserId: string; recordedAt: string }>;
  documents: Array<{ id: string; label: string }>;
  workOrders: Array<{ id: string; label: string; status: string }>;
}
export function closeVendorPoolForTests(): Promise<void>;
export function getVendorPermissions(
  actor: string,
  camp: string,
): Promise<VendorPermissions>;
export function getVendorDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<VendorDashboard>;
export function registerVendor(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function registerVendorContract(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function registerVendorRecurring(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function registerVendorRequest(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function recordVendorEvent(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
