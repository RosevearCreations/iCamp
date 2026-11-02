import type { MaintenancePriorityKey } from "./core.mjs";

export interface MaintenanceCategory {
  id: string;
  organizationId: string;
  campgroundId: string;
  code: string;
  name: string;
  description: string | null;
  isStandard: boolean;
  isActive: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePriorityPolicy {
  id: string;
  organizationId: string;
  campgroundId: string;
  priorityKey: MaintenancePriorityKey;
  targetResponseMinutes: number;
  targetCompletionMinutes: number;
  instructions: string | null;
  rowVersion: number;
  updatedAt: string;
}

export interface MaintenanceTaxonomySnapshot {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  categories: MaintenanceCategory[];
  priorities: MaintenancePriorityPolicy[];
}

export function closeMaintenanceTaxonomyPoolForTests(): Promise<void>;

export function getMaintenanceTaxonomySnapshot(
  userId: string,
  campgroundId: string,
): Promise<MaintenanceTaxonomySnapshot>;

export function createMaintenanceCategory(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  code: string;
  name: string;
  description?: string | null;
}): Promise<MaintenanceCategory>;

export function setMaintenanceCategoryActive(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  categoryId: string;
  isActive: boolean;
  expectedRowVersion: number;
}): Promise<MaintenanceCategory>;

export function updateMaintenancePriorityPolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  priorityKey: string;
  targetResponseMinutes: number;
  targetCompletionMinutes: number;
  instructions?: string | null;
  expectedRowVersion: number;
}): Promise<MaintenancePriorityPolicy>;
