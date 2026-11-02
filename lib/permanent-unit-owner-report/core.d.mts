export interface OwnerAssignment {
  campgroundId: string;
  campgroundName: string;
  organizationId: string;
  roleCodes: string[];
  allowed: boolean;
}
export interface OwnerWeek {
  week: string;
  consents: number;
  holds: number;
  clears: number;
  createdTasks: number;
  closedTasks: number;
}
export interface OwnerCampgroundReport {
  campgroundId: string;
  organizationId: string;
  name: string;
  currentHolds: number;
  openTasks: number;
  overdueTasks: number;
  recurrentConsents: number;
  newConsents: number;
  newHolds: number;
  clearedHolds: number;
  createdTasks: number;
  closedTasks: number;
  recurrenceReviews: number;
  weeks: OwnerWeek[];
}
export function normalizeWindow(value: unknown): 7 | 30 | 90;
export function authorizedOwnerCampgrounds<T extends OwnerAssignment>(
  assignments: T[],
): T[];
export function summarizeOwnerPortfolio(
  campgrounds: OwnerCampgroundReport[],
): Record<string, number>;
export function aggregateWeeklyActivity(
  campgrounds: OwnerCampgroundReport[],
  weeks: string[],
): OwnerWeek[];
