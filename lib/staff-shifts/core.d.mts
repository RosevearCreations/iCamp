export const shiftDepartments: readonly string[];
export const shiftQualifications: readonly string[];
export const sensitiveDepartmentQualifications: Readonly<
  Record<string, string>
>;
export function shiftUuid(value: unknown, label?: string): string;
export function shiftTimestamp(value: unknown, label: string): string;
export type ShiftPlan = {
  id: string;
  staffUserId: string;
  department: string;
  roleLabel: string;
  assignmentNote: string;
  startsAt: string;
  endsAt: string;
};
export type ShiftAvailability = {
  id: string;
  staffUserId: string;
  kind: string;
  clearsEventId: string | null;
  reason: string;
  startsAt: string;
  endsAt: string;
};
export type ShiftQualification = {
  id: string;
  staffUserId: string;
  qualificationKey: string;
  decision: string;
  sourceReference: string;
  validUntil: string | null;
  reviewNote: string;
};
export type ShiftHandoff = {
  id: string;
  fromShiftId: string;
  toShiftId: string | null;
  summary: string;
  outstandingWork: string;
  followUpRequired: boolean;
};
export type ShiftEvent = {
  id: string;
  shiftId: string;
  handoffId: string | null;
  kind: string;
  reason: string;
};
export function normalizeShiftPlan(input: unknown): ShiftPlan;
export function normalizeShiftAvailability(input: unknown): ShiftAvailability;
export function normalizeShiftQualification(input: unknown): ShiftQualification;
export function normalizeShiftHandoff(input: unknown): ShiftHandoff;
export function normalizeShiftEvent(input: unknown): ShiftEvent;
export type ReadinessShift = ShiftPlan & { cancelled?: boolean };
export function assessShiftReadiness(
  shift: ReadinessShift,
  shifts: ReadinessShift[],
  latestQualifications: Array<{
    staffUserId: string;
    qualificationKey: string;
    decision: string;
    validUntil: string | null;
  }>,
  availability: Array<{
    staffUserId: string;
    startsAt: string;
    endsAt: string;
  }>,
  now?: Date,
): {
  flags: string[];
  requiredQualification: string | null;
  weeklyHours: number;
  ready: boolean;
};
