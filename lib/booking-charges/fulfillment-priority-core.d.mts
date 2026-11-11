import type { DispatchRecord } from "./fulfillment-dispatch-core.mjs";
import type { FulfillmentSlaFollowup } from "./fulfillment-dispatch-postgres.mjs";

export type PriorityClassification = {
  status: "current" | "superseded";
  acknowledgement: string;
  completion: string;
  canAcknowledge: boolean;
};
export type FulfillmentPriority = {
  category: string;
  title: string;
  priorityRank: number;
  ageMinutes: number | null;
  ageBand: string;
  ageSource: string | null;
  nextStep: string;
  isOpen: boolean;
  isException: boolean;
};
export const FULFILLMENT_PRIORITY_FILTERS: Readonly<Record<string, string>>;
export function validateFulfillmentPriorityFilter(
  value?: string | null,
): string;
export function validateFulfillmentPriorityPage(value?: string | null): number;
export function agingBand(minutes: number | null): string;
export function classifyFulfillmentPriority(input: {
  dispatch: DispatchRecord;
  classification: PriorityClassification | null;
  followup?: FulfillmentSlaFollowup | null;
  now?: string;
}): FulfillmentPriority;
export function matchesFulfillmentPriorityFilter(
  priority: FulfillmentPriority,
  filter: string,
): boolean;
export function compareFulfillmentPriority(
  a: { dispatch: DispatchRecord; priority: FulfillmentPriority },
  b: { dispatch: DispatchRecord; priority: FulfillmentPriority },
): number;
export function workerRecoveryGuidance(
  classification: PriorityClassification | null,
): {
  title: string;
  urgent: boolean;
  step: string;
};
