export interface FulfillmentJob {
  id: string;
  reservationReference: string;
  displayName: string;
  serviceCode: string;
  quantity: number;
  arrivalDate: string;
  departureDate: string;
  serviceDate: string;
  serviceWindow: string;
  jobState: string;
  reservationStatus: string;
  staffNote: string;
  dailyCapacity: number | null;
  rowVersion: number;
  updatedAt: string;
  assignedUserId: string | null;
  assignmentNote: string;
  assignmentVersion: number;
  reviewHistory: Array<{
    state: string;
    note: string;
    reviewedAt: string;
  }>;
}
export interface FulfillmentStaffMember {
  userId: string;
  label: string;
}
export interface FulfillmentStaffLoad {
  assignedUserId: string | null;
  label: string;
  activeJobs: number;
  units: number;
  blockedJobs: number;
}
export function listCampgroundFulfillment(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  campgroundName: string;
  jobs: FulfillmentJob[];
  truncated: boolean;
  canManageStaff: boolean;
  staff: FulfillmentStaffMember[];
  staffTruncated: boolean;
  loads: FulfillmentStaffLoad[];
  loadsTruncated: boolean;
}>;
export function updateCampgroundFulfillment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  jobId: string;
  expectedRowVersion: number;
  nextState: string;
  serviceDate: string;
  serviceWindow: string;
  staffNote: string;
}): Promise<{ state: string; id: string }>;
export function assignCampgroundFulfillment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  jobId: string;
  assignedUserId: string;
  assignmentNote: string;
  expectedAssignmentVersion: number;
  expectedJobVersion: number;
}): Promise<{ id: string; assignedUserId: string | null }>;
export function reviewCampgroundFulfillmentException(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  jobId: string;
  expectedJobVersion: number;
  reviewState: string;
  reviewNote: string;
}): Promise<{ id: string; state: string }>;
export function closeFulfillmentPoolForTests(): Promise<void>;
