export interface CampgroundAuthorization {
  assignmentId: string;
  organizationId: string;
  campgroundId: string;
  roleCodes: string[];
  permissions: string[];
}

export interface AssignedCampground {
  organizationId: string;
  campgroundId: string;
  campgroundName: string;
  campgroundSlug: string;
  roleCodes: string[];
}

export function getCampgroundAuthorization(
  userId: string,
  campgroundId: string,
): Promise<CampgroundAuthorization | null>;

export function hasCampgroundPermission(
  userId: string,
  campgroundId: string,
  permission: string,
): Promise<boolean>;

export function hasAnyCampgroundPermission(
  userId: string,
  permission: string,
): Promise<boolean>;

export function listAssignedCampgrounds(
  userId: string,
): Promise<AssignedCampground[]>;

export function listRoleTemplates(): Promise<
  Array<{
    id: string;
    roleCode: string;
    displayName: string;
    description: string;
    permissions: string[];
  }>
>;

export function createCustomRole(input: {
  actorUserId: string;
  authorizationCampgroundId: string;
  organizationId: string;
  roleCode: string;
  displayName: string;
  description?: string;
  permissions?: string[];
}): Promise<{
  id: string;
  organizationId: string;
  roleCode: string;
  displayName: string;
  description: string;
  permissions: string[];
}>;

export function assignStaffToCampground(input: {
  actorUserId: string;
  targetUserId: string;
  campgroundId: string;
  roleIds: string[];
}): Promise<{ assignmentId: string; roleIds: string[] }>;

export function listVisibleCampgroundsViaRls(userId: string): Promise<
  Array<{
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    timezone: string;
  }>
>;

export function closeAuthorizationPoolForTests(): Promise<void>;
