export interface FeedbackReview {
  id: string;
  campgroundId: string;
  campgroundName: string;
  campgroundSlug: string;
  reservationId: string;
  guestUserId: string;
  assistanceCaseId: string | null;
  assistanceCaseState: string | null;
  rating: number;
  category: string;
  title: string;
  publicSummary: string;
  privateDetails: string;
  publicRequested: boolean;
  moderationState: string;
  moderationReason: string | null;
  appealPending: boolean;
  appealReason: string | null;
  recoveryStage: string;
  recoveryDueDate: string | null;
  recoveryUpdatedAt: string | null;
  submittedAt: string;
  updatedAt: string;
  rowVersion: number;
  editable: boolean;
  moderationHistory: {
    eventKind: string;
    reason: string;
    occurredAt: string;
  }[];
  recoveryHistory: {
    stage: string;
    summary: string;
    dueDate: string | null;
    occurredAt: string;
  }[];
}
export interface PublicGuestReview {
  id: string;
  rating: number;
  category: string;
  title: string;
  summary: string;
  campgroundName: string;
  campgroundSlug: string;
  submittedAt: string;
}
export function closeFeedbackPoolForTests(): Promise<void>;
export function listFeedbackCampgrounds(): Promise<
  { id: string; name: string; slug: string }[]
>;
export function listPublicGuestReviews(filters?: {
  campgroundSlug?: string;
  category?: string;
  rating?: string;
}): Promise<PublicGuestReview[]>;
export function listFeedbackEligibleStays(input: { userId: string }): Promise<
  {
    id: string;
    campgroundId: string;
    campgroundName: string;
    arrivalDate: string;
    departureDate: string;
    accommodationCode: string;
  }[]
>;
export function listOwnFeedbackCases(input: { userId: string }): Promise<
  {
    id: string;
    reservationId: string;
    caseState: string;
    summary: string;
  }[]
>;
export function listOwnGuestFeedback(input: {
  userId: string;
}): Promise<FeedbackReview[]>;
export function saveGuestFeedback(input: {
  userId: string;
  actorSessionId: string;
  reservationId: string;
  feedbackId?: string;
  expectedRowVersion: number;
  input: {
    rating: unknown;
    category: unknown;
    title: unknown;
    publicSummary: unknown;
    privateDetails: unknown;
    publicRequested: boolean;
    assistanceCaseId: unknown;
  };
}): Promise<string>;
export function withdrawFeedbackPublication(input: {
  userId: string;
  actorSessionId: string;
  feedbackId: string;
}): Promise<void>;
export function appealFeedbackModeration(input: {
  userId: string;
  actorSessionId: string;
  feedbackId: string;
  reason: unknown;
}): Promise<void>;
export function listManagedGuestFeedback(input: {
  userId: string;
  campgroundId: string;
}): Promise<FeedbackReview[]>;
export function moderateGuestFeedback(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  feedbackId: string;
  expectedRowVersion: number;
  input: { decision: unknown; reason: unknown };
}): Promise<void>;
export function recordGuestFeedbackRecovery(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  feedbackId: string;
  expectedRowVersion: number;
  input: { stage: unknown; dueDate: unknown; internalNote: unknown };
}): Promise<void>;
