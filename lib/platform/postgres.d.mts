export interface PlatformOverview {
  organizations: number;
  campgrounds: number;
  active_users: number;
}

export function getPlatformOverview(
  userId: string,
  assuranceLevel: "aal1" | "aal2",
): Promise<PlatformOverview | null>;

export function listPlatformAccounts286(userId: string, assuranceLevel: "aal1" | "aal2"): Promise<{
  username: string | null;
  account_state: string;
  grant_state: string;
  binding_state: string | null;
  owner_slot: string | null;
  mfa_required: boolean;
  mfa_enrolled: boolean;
}[] | null>;
