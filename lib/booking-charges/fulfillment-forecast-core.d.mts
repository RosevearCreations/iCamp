export const FULFILLMENT_FORECAST_HORIZON_DAYS: number;
export const FULFILLMENT_FORECAST_WINDOW_NAMES: ReadonlyArray<string>;
export const FULFILLMENT_FORECAST_LABELS: Readonly<Record<string, string>>;
export function validateFulfillmentPlanningSettings(input: {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  eveningStart: string;
  eveningEnd: string;
  maxUnitsPerStaffWindow: string | number | null;
  expectedRowVersion: number;
}): {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  eveningStart: string;
  eveningEnd: string;
  maxUnitsPerStaffWindow: number | null;
  expectedRowVersion: number;
};
export function classifyFulfillmentForecast(input: {
  assignedUserId: string | null;
  activeStaff: boolean;
  serviceWindow: string;
  windowsConfigured: boolean;
  declaredUnavailable: boolean;
  hasCoveringShift: boolean;
  hasOverlappingShift: boolean;
  units: number;
  maxUnitsPerStaffWindow: number | null;
}): string;
