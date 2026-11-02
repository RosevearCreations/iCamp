export type EnforcementPermissions = {
  warning: boolean;
  request: boolean;
  review: boolean;
};
export type EnforcementCase = {
  id: string;
  case_kind: "warning" | "suspension";
  case_state:
    "warning_recorded" | "pending_review" | "active" | "denied" | "reinstated";
  reservation_id: string;
  guest_user_id: string;
  scope_type: string;
  facility_name: string | null;
  zone_name: string | null;
  feature_code: string | null;
  reason_summary: string;
  rule_version_number: number | null;
  accommodation_code: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  row_version: number;
  events: {
    id: string;
    event_kind: string;
    event_note: string;
    actor_user_id: string;
    occurred_at: string;
  }[];
};
export function getEnforcementPermissions(
  userId: string,
  campgroundId: string,
): Promise<EnforcementPermissions>;
export function getEnforcementDashboard(
  userId: string,
  campgroundId: string,
): Promise<{
  campground: { id: string; organization_id: string; name: string };
  reservations: {
    id: string;
    guest_user_id: string;
    accommodation_code: string;
    status: string;
    arrival_date: string;
    departure_date: string;
  }[];
  facilities: { id: string; code: string; display_name: string }[];
  zones: { id: string; zone_code: string; display_name: string }[];
  rules: { id: string; code: string; title: string; version_number: number }[];
  cases: EnforcementCase[];
}>;
export function recordEnforcementCase(input: {
  actorUserId: string;
  campgroundId: string;
  caseId: string;
  reservationId: string;
  ruleVersionId?: string;
  kind: string;
  scopeType: string;
  facilityId?: string;
  accessZoneId?: string;
  feature?: string;
  reason: string;
}): Promise<EnforcementCase>;
export function decideEnforcementCase(input: {
  actorUserId: string;
  campgroundId: string;
  caseId: string;
  expectedVersion: number;
  decision: string;
  note: string;
}): Promise<EnforcementCase>;
export function getGuestActiveSuspensions(input: {
  userId: string;
  reservationId: string;
}): Promise<
  {
    id: string;
    scope_type: string;
    feature_code: string | null;
    facility_name: string | null;
    zone_name: string | null;
    reason_summary: string;
    updated_at: string;
  }[]
>;
export function closeEnforcementPoolForTests(): Promise<void>;
