export interface RuleSetRow {
  id: string;
  code: string;
  title: string;
  rule_category: string;
  facility_id: string | null;
  current_version_id: string | null;
  version_number: number | null;
  content: string | null;
  acknowledgement_required: boolean | null;
  published_at: Date | null;
  acknowledgement_count: number;
}
export interface GuestRuleRow {
  rule_set_id: string;
  code: string;
  title: string;
  rule_category: string;
  facility_id: string | null;
  rule_version_id: string;
  version_number: number;
  content: string;
  acknowledgement_required: boolean;
  published_at: Date;
  acknowledged_at: Date | null;
}
export function getRuleSetDashboard(
  userId: string,
  campgroundId: string,
): Promise<{
  campground: { id: string; name: string; organization_id: string };
  facilities: Array<{ id: string; code: string; display_name: string }>;
  sets: RuleSetRow[];
}>;
export function createCampgroundRuleSet(input: {
  actorUserId: string;
  campgroundId: string;
  code: string;
  title: string;
  category: string;
  facilityId?: string;
}): Promise<{ id: string }>;
export function publishCampgroundRuleVersion(input: {
  actorUserId: string;
  campgroundId: string;
  ruleSetId: string;
  clientPublicationId: string;
  expectedVersion: number;
  content: string;
  acknowledgementRequired: boolean;
}): Promise<{ id: string; version_number: number }>;
export function getGuestRulePublications(input: {
  userId: string;
  reservationId: string;
}): Promise<GuestRuleRow[]>;
export function acknowledgeCurrentCampgroundRule(input: {
  userId: string;
  reservationId: string;
  ruleSetId: string;
  ruleVersionId: string;
}): Promise<{ id: string }>;
export function closeCampgroundRulesPoolForTests(): Promise<void>;
