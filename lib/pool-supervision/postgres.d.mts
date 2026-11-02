export type PoolPermissions = {
  read: boolean;
  attest: boolean;
  manage: boolean;
};
export type PoolDashboard = {
  campground: { id: string; organization_id: string; name: string };
  facilities: { id: string; display_name: string; operating_state: string }[];
  policies: {
    id: string;
    asset_id: string;
    version_number: number;
    maximum_bathers: number;
    minimum_unaccompanied_age: number;
    minimum_supervisor_age: number;
    maximum_children_per_supervisor: number;
    minimum_lifeguards: number;
    rule_version_id: string;
    safety_instructions: string;
    published_at: string;
  }[];
  qualifications: {
    id: string;
    staff_user_id: string;
    staff_email: string | null;
    asset_id: string;
    decision: string;
    credential_reference: string;
    expires_at: string | null;
    decision_note: string;
    decided_at: string;
  }[];
  events: {
    id: string;
    asset_id: string;
    kind: string;
    policy_id: string;
    reservation_id: string | null;
    admitted: boolean | null;
    bather_count: number | null;
    underage_count: number | null;
    supervisor_count: number | null;
    lifeguard_count: number | null;
    reason: string;
    actor_user_id: string;
    occurred_at: string;
  }[];
  rules: {
    id: string;
    version_number: number;
    title: string;
    facility_id: string | null;
  }[];
  staff: { user_id: string; email: string }[];
  reservations: { id: string; accommodation_code: string; status: string }[];
  permissions: PoolPermissions;
};
export function getPoolPermissions(
  userId: string,
  campgroundId: string,
): Promise<PoolPermissions>;
export function getPoolDashboard(
  userId: string,
  campgroundId: string,
): Promise<PoolDashboard>;
export function publishPoolPolicy(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordPoolQualification(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordPoolEvent(
  input: Record<string, unknown>,
): Promise<unknown>;
export function closePoolSupervisionForTests(): Promise<void>;
