export interface PlatformOverview {
  organizations: number;
  campgrounds: number;
  active_users: number;
}

export function getPlatformOverview(
  userId: string,
  assuranceLevel: "aal1" | "aal2",
): Promise<PlatformOverview | null>;
