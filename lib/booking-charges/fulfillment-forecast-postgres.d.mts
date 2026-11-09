export interface FulfillmentPlanningSettings {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  eveningStart: string;
  eveningEnd: string;
  maxUnitsPerStaffWindow: number | null;
  rowVersion: number;
}

export interface FulfillmentForecastRow {
  serviceDate: string;
  serviceWindow: string;
  assignedUserId: string | null;
  units: number;
  jobs: number;
  maxUnitsPerStaffWindow: number | null;
  status: string;
}

export function getCampgroundFulfillmentForecast(input: {
  userId: string;
  campgroundId: string;
  activeStaffIds?: string[];
}): Promise<{
  canForecast: boolean;
  timezone: string | null;
  settings: FulfillmentPlanningSettings | null;
  rows: FulfillmentForecastRow[];
  truncated: boolean;
  horizonDays: number;
}>;

export function updateCampgroundFulfillmentPlanningSettings(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  eveningStart: string;
  eveningEnd: string;
  maxUnitsPerStaffWindow: string;
  expectedRowVersion: number;
}): Promise<{ rowVersion: number }>;

export function closeForecastPoolForTests(): Promise<void>;
