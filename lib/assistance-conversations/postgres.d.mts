export interface AssistanceAttachment {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
}
export function closeAssistanceConversationPoolForTests(): Promise<void>;
export function postOwnAssistanceReply(input: {
  userId: string;
  actorSessionId?: string | null;
  requestId: string;
  input: Record<string, unknown>;
}): Promise<{ recorded: boolean }>;
export function listOwnAssistanceAttachments(input: {
  userId: string;
  requestId: string;
}): Promise<AssistanceAttachment[]>;
export function listOwnAssistanceAttachmentsForStay(input: {
  userId: string;
  reservationId: string;
}): Promise<Array<AssistanceAttachment & { requestId: string }>>;
export function ownsAssistanceMedia(input: {
  userId: string;
  mediaId: string;
}): Promise<boolean>;
export function listStaffAssistanceAttachments(input: {
  userId: string;
  campgroundId: string;
}): Promise<Array<AssistanceAttachment & { caseId: string }>>;
