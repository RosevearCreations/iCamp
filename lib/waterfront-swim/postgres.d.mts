export type WaterfrontPermissions = {
  read: boolean;
  monitor: boolean;
  manage: boolean;
};
export type WaterfrontDashboard = {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    timezone: string;
  };
  facilities: { id: string; display_name: string; operating_state: string }[];
  zones: {
    id: string;
    asset_id: string;
    zone_code: string;
    zone_name: string;
    version_number: number;
    boundary_description: string;
    operating_days: number[];
    opens_at: string;
    closes_at: string;
    maximum_swimmers: number;
    minimum_unaccompanied_age: number;
    minimum_supervisor_age: number;
    maximum_children_per_supervisor: number;
    rule_version_id: string;
    hazard_instructions: string;
    published_at: string;
  }[];
  training: {
    id: string;
    asset_id: string;
    staff_user_id: string;
    staff_email: string | null;
    decision: string;
    training_reference: string;
    expires_at: string | null;
    note: string;
    decided_at: string;
  }[];
  events: {
    id: string;
    asset_id: string;
    zone_code: string;
    zone_version_id: string;
    kind: string;
    reservation_id: string | null;
    swimmer_count: number | null;
    underage_count: number | null;
    supervisor_count: number | null;
    admitted: boolean | null;
    ages_verified: boolean | null;
    hazard_type: string | null;
    hazard_level: string | null;
    evidence_reference: string | null;
    note: string;
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
  permissions: WaterfrontPermissions;
};
export function getWaterfrontPermissions(
  userId: string,
  campgroundId: string,
): Promise<WaterfrontPermissions>;
export function getWaterfrontDashboard(
  userId: string,
  campgroundId: string,
): Promise<WaterfrontDashboard>;
export function publishWaterfrontZone(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordWaterfrontTraining(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordWaterfrontEvent(
  input: Record<string, unknown>,
): Promise<unknown>;
export function closeWaterfrontPoolForTests(): Promise<void>;
