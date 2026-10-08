export type LifecycleState = "active" | "inactive";

export interface SectionSettings {
  operatingMode: "standard" | "quiet" | "restricted";
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  staffNote: string;
}

export interface CampgroundStructure {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    timezone: string;
    lifecycleState: string;
    rowVersion: number;
  };
  sections: Array<{
    id: string;
    organizationId: string;
    campgroundId: string;
    name: string;
    code: string;
    sortOrder: number;
    lifecycleState: string;
    settings: SectionSettings;
    rowVersion: number;
    subsections: Array<{
      id: string;
      sectionId: string;
      name: string;
      code: string;
      sortOrder: number;
      lifecycleState: string;
      rowVersion: number;
    }>;
  }>;
}

export function normalizeSectionSettings(value?: Partial<SectionSettings>): SectionSettings;
export function listCampgroundStructure(
  userId: string,
  campgroundId: string,
): Promise<CampgroundStructure | null>;
export function updateCampgroundConfiguration(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  name: string;
  timezone: string;
  lifecycleState: LifecycleState;
}): Promise<{ rowVersion: number }>;
export function createSection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  name: string;
  code: string;
  sortOrder: number;
  lifecycleState?: LifecycleState;
  settings?: Partial<SectionSettings>;
}): Promise<unknown>;
export function updateSection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  sectionId: string;
  expectedRowVersion: number;
  name: string;
  code: string;
  sortOrder: number;
  lifecycleState: LifecycleState;
  settings?: Partial<SectionSettings>;
}): Promise<unknown>;
export function createSubsection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  sectionId: string;
  name: string;
  code: string;
  sortOrder: number;
  lifecycleState?: LifecycleState;
}): Promise<unknown>;
export function updateSubsection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  subsectionId: string;
  expectedRowVersion: number;
  name: string;
  code: string;
  sortOrder: number;
  lifecycleState: LifecycleState;
}): Promise<unknown>;
export function closeCampgroundStructurePoolForTests(): Promise<void>;
