import type { WinterStep } from "./core.mjs";

export type WinterizationPermissions = {
  read: boolean;
  record: boolean;
  templateManage: boolean;
  signoff: boolean;
};
export type WinterizationDashboard = {
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
    steps: WinterStep[];
  }[];
  assignments: {
    id: string;
    code: string;
    display_name: string;
    occupant_display_name: string;
    assignment_kind: string;
    assignment_state: string;
    occupancy_state: string;
    winterization_required: boolean;
  }[];
  runs: {
    id: string;
    assignment_id: string;
    template_id: string;
    winter_year: number;
    created_by_user_id: string;
    started_at: string;
  }[];
  steps: {
    id: string;
    run_id: string;
    step_key: string;
    result: string;
    note: string;
    evidence_reference: string | null;
    work_order_id: string | null;
    actor_user_id: string;
    recorded_at: string;
  }[];
  reviews: {
    id: string;
    run_id: string;
    decision: string;
    note: string;
    actor_user_id: string;
    reviewed_at: string;
  }[];
  workOrders: {
    id: string;
    title: string;
    status: string;
    accommodation_id: string | null;
  }[];
  permissions: WinterizationPermissions;
};
export function getWinterizationPermissions(
  userId: string,
  campgroundId: string,
): Promise<WinterizationPermissions>;
export function getWinterizationDashboard(
  userId: string,
  campgroundId: string,
): Promise<WinterizationDashboard>;
export function createWinterizationTemplate(
  input: Record<string, unknown>,
): Promise<unknown>;
export function startWinterizationRun(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordWinterizationStep(
  input: Record<string, unknown>,
): Promise<unknown>;
export function reviewWinterizationRun(
  input: Record<string, unknown>,
): Promise<unknown>;
export function closeWinterizationPoolForTests(): Promise<void>;
