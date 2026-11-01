import type {
  RecreationEvent,
  RecreationEventInput,
  RecreationStay,
} from "./core.mjs";

export function closeRecreationPoolForTests(): Promise<void>;
export function listEventCampgrounds(): Promise<
  { id: string; name: string; slug: string }[]
>;
export function listPublicRecreationEvents(filters?: {
  campgroundSlug?: string;
  category?: string;
  search?: string;
}): Promise<RecreationEvent[]>;
export function listManagedRecreationEvents(input: {
  userId: string;
  campgroundId: string;
}): Promise<RecreationEvent[]>;
export interface ManagedRecreationRequest {
  id: string;
  eventId: string;
  reservationId: string;
  partySize: number;
  status: string;
  guestNote: string;
  createdAt: string;
  rowVersion: number;
  eventTitle: string;
  eventDate: string;
}
export function listManagedRecreationRequests(input: {
  userId: string;
  campgroundId: string;
}): Promise<ManagedRecreationRequest[]>;
export function saveRecreationEvent(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  eventId?: string;
  expectedRowVersion: number;
  input: RecreationEventInput;
}): Promise<string>;
export function listGuestRecreationStays(input: {
  userId: string;
}): Promise<RecreationStay[]>;
export interface OwnRecreationRequest {
  id: string;
  eventId: string;
  reservationId: string;
  partySize: number;
  status: string;
  eventTitle: string;
  eventDate: string;
  campgroundName: string;
  createdAt: string;
}
export function getOwnRecreationRequests(input: {
  userId: string;
}): Promise<OwnRecreationRequest[]>;
export function requestRecreationRegistration(input: {
  userId: string;
  actorSessionId: string;
  eventId: string;
  reservationId: string;
  input: { partySize: unknown; guestNote: unknown; clientRequestId: unknown };
}): Promise<string>;
export function withdrawRecreationRequest(input: {
  userId: string;
  actorSessionId: string;
  requestId: string;
}): Promise<void>;
export function reviewRecreationRequest(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  requestId: string;
  decision: string;
}): Promise<void>;
