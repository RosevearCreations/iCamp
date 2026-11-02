import type {
  ArrivalPlan,
  ArrivalPlanInput,
  StaffArrivalReview,
} from "./core.mjs";

export function getOwnArrivalPlanBundle(input: {
  userId: string;
  reservationId: string;
}): Promise<{ plan: ArrivalPlan | null; review: StaffArrivalReview | null }>;

export function saveOwnArrivalPlan(input: {
  userId: string;
  reservationId: string;
  expectedReservationVersion: number;
  expectedPlanVersion: number;
  input: ArrivalPlanInput;
}): Promise<string>;

export interface StaffArrivalReadiness {
  reservationId: string;
  campgroundId: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  reservationVersion: number;
  accommodationCode: string;
  guestName: string;
  bookedVehicleCount: number;
  bookedVisitorCount: number;
  checkInTime: string | null;
  checkedIn: boolean;
  plan: ArrivalPlan | null;
  review: StaffArrivalReview | null;
  reviewCurrent: boolean;
}

export function listStaffArrivalReadiness(input: {
  userId: string;
  campgroundId: string;
}): Promise<StaffArrivalReadiness[]>;

export function saveStaffArrivalReview(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
  expectedPlanVersion: number;
  expectedReservationVersion: number;
  input: { outcome: "reviewed" | "follow_up_needed"; note: string | null };
}): Promise<void>;

export function closeArrivalPlannerPoolForTests(): Promise<void>;
