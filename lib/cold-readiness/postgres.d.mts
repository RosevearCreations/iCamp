import type { ReadinessStep } from "./core.mjs";
export type ReadinessPermissions = {
  read: boolean;
  record: boolean;
  policyManage: boolean;
  approve: boolean;
};
export type ReadinessDashboard = {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    lifecycle_state: string;
  };
  templates: {
    id: string;
    version_number: number;
    name: string;
    instructions: string;
    steps: ReadinessStep[];
  }[];
  accommodations: {
    id: string;
    code: string;
    display_name: string;
    accommodation_kind: string;
    lifecycle_state: string;
  }[];
  assignments: {
    id: string;
    accommodation_id: string;
    assignment_kind: string;
    assignment_state: string;
    occupancy_state: string;
    winterization_required: boolean;
  }[];
  assessments: {
    id: string;
    accommodation_id: string;
    assignment_id: string | null;
    template_id: string;
    winter_year: number;
    water_mode: string;
    operating_limits: string;
    created_by_user_id: string;
    started_at: string;
  }[];
  observations: {
    id: string;
    assessment_id: string;
    step_key: string;
    result: string;
    note: string;
    evidence_reference: string | null;
    corrective_work_order_id: string | null;
    actor_user_id: string;
    observed_at: string;
  }[];
  decisions: {
    id: string;
    assessment_id: string;
    decision: string;
    note: string;
    actor_user_id: string;
    decided_at: string;
  }[];
  workOrders: {
    id: string;
    title: string;
    status: string;
    accommodation_id: string | null;
  }[];
  permissions: ReadinessPermissions;
};
export function getReadinessPermissions(
  userId: string,
  campgroundId: string,
): Promise<ReadinessPermissions>;
export function getReadinessDashboard(
  userId: string,
  campgroundId: string,
): Promise<ReadinessDashboard>;
export function publishReadinessTemplate(
  input: Record<string, unknown>,
): Promise<unknown>;
export function startReadinessAssessment(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordReadinessObservation(
  input: Record<string, unknown>,
): Promise<unknown>;
export function reviewReadinessAssessment(
  input: Record<string, unknown>,
): Promise<unknown>;
export function closeReadinessPoolForTests(): Promise<void>;
