export interface PrivacyRequest {
  id: string;
  campgroundId: string;
  guestUserId: string;
  requestKind: string;
  subjectArea: string;
  submittedAt: string | null;
  status: string;
  outcomeCode: string;
  reviewedAt: string | null;
  sourceReference: string | null;
  terminal: boolean;
}
export interface ConsentHistory {
  source: "saved_profile" | "linked_communication";
  kind: string;
  channel: string;
  at: string | null;
  saveStayPreferences?: boolean;
  allowStaffProfileLookup?: boolean;
  consentState?: string;
  evidenceSource?: string;
}
export interface PrivacyWorkspace {
  requests: PrivacyRequest[];
  consentHistory: ConsentHistory[];
  truncated: boolean;
  sourceAt: string;
}
export function closeGuestPrivacyPoolForTests(): Promise<void>;
export function submitGuestPrivacyRequest(input: {
  userId: string;
  campgroundId: string;
  input: Record<string, unknown>;
}): Promise<string>;
export function listOwnGuestPrivacy(input: {
  userId: string;
  campgroundId: string;
}): Promise<PrivacyWorkspace>;
export function listOwnPrivacyExportRecords(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  campgroundName: string;
  stays: Array<Record<string, string | number | null>>;
  receipts: Array<Record<string, string | number | null>>;
  truncated: boolean;
}>;
export function recordOwnPrivacyExportReceipt(input: {
  userId: string;
  campgroundId: string;
  sha256: string;
  incomplete: boolean;
}): Promise<void>;
export function listManagedPrivacyRequests(input: {
  userId: string;
  campgroundId: string;
}): Promise<{ requests: PrivacyRequest[]; truncated: boolean }>;
export function reviewGuestPrivacyRequest(input: {
  actorUserId: string;
  campgroundId: string;
  requestId: string;
  input: Record<string, unknown>;
}): Promise<void>;
