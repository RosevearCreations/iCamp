export interface FulfillmentJob {
  id: string;
  reservationReference: string;
  displayName: string;
  serviceCode: string;
  quantity: number;
  arrivalDate: string;
  departureDate: string;
  serviceDate: string;
  serviceWindow: string;
  jobState: string;
  reservationStatus: string;
  staffNote: string;
  dailyCapacity: number | null;
  rowVersion: number;
  updatedAt: string;
}
export function listCampgroundFulfillment(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  campgroundName: string;
  jobs: FulfillmentJob[];
  truncated: boolean;
}>;
export function updateCampgroundFulfillment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  jobId: string;
  expectedRowVersion: number;
  nextState: string;
  serviceDate: string;
  serviceWindow: string;
  staffNote: string;
}): Promise<{ state: string; id: string }>;
export function closeFulfillmentPoolForTests(): Promise<void>;
