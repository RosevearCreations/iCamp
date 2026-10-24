export type EmergencyPermissions = {
  read: boolean;
  draft: boolean;
  record: boolean;
  approve: boolean;
};
export type EmergencyNoticeDashboard = {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    lifecycle_state: string;
  };
  sections: { id: string; name: string; code: string }[];
  accommodations: { id: string; code: string; display_name: string }[];
  plans: {
    id: string;
    audience: string;
    section_id: string | null;
    accommodation_id: string | null;
    severity: string;
    title: string;
    message: string;
    onsite_instructions: string;
    created_by_user_id: string;
    created_at: string;
  }[];
  events: {
    id: string;
    notice_id: string;
    kind: string;
    method: string | null;
    evidence_reference: string | null;
    note: string;
    actor_user_id: string;
    occurred_at: string;
  }[];
  permissions: EmergencyPermissions;
};
export function getEmergencyNoticePermissions(
  userId: string,
  campgroundId: string,
): Promise<EmergencyPermissions>;
export function getEmergencyNoticeDashboard(
  userId: string,
  campgroundId: string,
): Promise<EmergencyNoticeDashboard>;
export function createEmergencyNotice(
  input: Record<string, unknown>,
): Promise<unknown>;
export function recordEmergencyNoticeDecision(
  input: Record<string, unknown>,
): Promise<unknown>;
export function closeEmergencyNoticePoolForTests(): Promise<void>;
