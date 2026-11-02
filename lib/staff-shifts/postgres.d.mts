import type {
  ShiftAvailability,
  ShiftEvent,
  ShiftHandoff,
  ShiftPlan,
  ShiftQualification,
} from "./core.mjs";
export type StaffShiftPermissions = {
  self: boolean;
  manage: boolean;
  verify: boolean;
};
export interface StaffShiftDashboard {
  asOf: string;
  campground: { id: string; name: string; timezone: string };
  permissions: StaffShiftPermissions;
  roster: Array<{ id: string; label: string }>;
  shifts: Array<
    ShiftPlan & {
      createdAt: string;
      cancelled: boolean;
      readiness: {
        flags: string[];
        requiredQualification: string | null;
        weeklyHours: number;
        ready: boolean;
      };
    }
  >;
  availability: Array<ShiftAvailability & { recordedAt: string }>;
  qualifications: Array<ShiftQualification & { reviewedAt: string }>;
  handoffs: Array<
    ShiftHandoff & { recordedAt: string; recordedByUserId: string }
  >;
  events: Array<ShiftEvent & { actorUserId: string; recordedAt: string }>;
  handoffReadiness: Array<{
    handoffId: string;
    acknowledged: boolean;
    requiresReview: boolean;
  }>;
}
export function closeStaffShiftPoolForTests(): Promise<void>;
export function getStaffShiftPermissions(
  userId: string,
  campgroundId: string,
): Promise<StaffShiftPermissions>;
export function getStaffShiftDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<StaffShiftDashboard>;
export function createStaffShift(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function recordStaffAvailability(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function recordStaffQualification(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function recordStaffHandoff(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
export function recordStaffShiftEvent(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: unknown;
}): Promise<{ id: string }>;
