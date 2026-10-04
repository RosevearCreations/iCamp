export type LifecycleState = "active" | "inactive" | "archived";

export type RefreshStatus =
  | "idle"
  | "refreshing"
  | "fresh"
  | "stale"
  | "failed";

export interface RecordIdentity {
  id: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  rowVersion: number;
}

export interface OrganizationRecord extends RecordIdentity {
  name: string;
  slug: string;
  lifecycleState: LifecycleState;
}

export interface CampgroundRecord extends RecordIdentity {
  organizationId: string;
  name: string;
  slug: string;
  timezone: string;
  lifecycleState: LifecycleState;
}

export interface CampgroundSectionRecord extends RecordIdentity {
  organizationId: string;
  campgroundId: string;
  name: string;
  code: string;
  sortOrder: number;
  lifecycleState: LifecycleState;
}

export interface CampgroundSubsectionRecord extends RecordIdentity {
  organizationId: string;
  campgroundId: string;
  sectionId: string;
  name: string;
  code: string;
  sortOrder: number;
  lifecycleState: LifecycleState;
}

export interface AdminRefreshStateRecord {
  id: string;
  organizationId: string;
  campgroundId: string | null;
  sectionKey: string;
  sourceKey: string;
  refreshStatus: RefreshStatus;
  lastRequestedAt: string | null;
  lastStartedAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastErrorCode: string | null;
  sourceWatermark: string | null;
  refreshedThrough: string | null;
  staleAfterSeconds: number;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}
