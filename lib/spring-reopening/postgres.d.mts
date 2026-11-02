import type { SpringStep } from "./core.mjs";
export type SpringPermissions = {
  read: boolean;
  record: boolean;
  policyManage: boolean;
  approve: boolean;
};
export type SpringDashboard = {
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
    steps: SpringStep[];
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
    occupant_display_name: string;
  }[];
  closureEvents: {
    id: string;
    assignment_id: string;
    effective_on: string;
    created_at: string;
  }[];
  inspections: {
    id: string;
    accommodation_id: string;
    assignment_id: string | null;
    winter_close_event_id: string | null;
    template_id: string;
    winter_year: number;
    water_service: string;
    operating_limits: string;
    created_by_user_id: string;
    started_at: string;
  }[];
  observations: {
    id: string;
    inspection_id: string;
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
    inspection_id: string;
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
  permissions: SpringPermissions;
};
export function getSpringReopeningPermissions(
  userId: string,
  campgroundId: string,
): Promise<SpringPermissions>;
export function getSpringReopeningDashboard(
  userId: string,
  campgroundId: string,
): Promise<SpringDashboard>;
export function publishSpringTemplate(
  input: Record<string, unknown>,
): Promise<unknown>;
export function startSpringInspection(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordSpringObservation(
  input: Record<string, unknown>,
): Promise<unknown>;
export function reviewSpringInspection(
  input: Record<string, unknown>,
): Promise<unknown>;
export function closeSpringReopeningPoolForTests(): Promise<void>;
