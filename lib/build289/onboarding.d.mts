export function onboardingReadiness289(input: {
  structure: { sections: { lifecycleState: string }[] } | null;
  accommodations: { lifecycleState: string }[] | null;
  maps: { isPublished: boolean; readiness: { ready: boolean } | null }[] | null;
}): {
  key: string;
  title: string;
  state: "RECORDED" | "NEEDS_SETUP" | "UNKNOWN";
}[];

export function prepareTenantPlan289(input: {
  name: unknown;
  region: unknown;
  timezone: unknown;
  season: unknown;
  siteCount: unknown;
}): {
  schema: string;
  name: string;
  region: string;
  timezone: string;
  season: string;
  siteCount: number;
  state: "DRAFT_NOT_PROVISIONED";
  tenantCreated: false;
  billingEnabled: false;
  ownerAssignmentCreated: false;
  reviewRequired: string[];
};
