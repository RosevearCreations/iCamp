export type ContactTask = {
  id: string;
  channel: string;
  kind: string;
  purpose: string;
  assignedRole: string;
  at: string;
  state: string;
  lastActionAt: string | null;
};
export function listInboundContactOrigins(input: {
  actorUserId: string;
  campgroundId: string;
}): Promise<
  Array<{ id: string; channel: string; eventType: string; at: string }>
>;
export function createContactFromOriginal(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  providerEventId: string;
  contactKind: string;
  assignedRole?: string;
}): Promise<{
  status: string;
  id?: string;
  remoteDelivery: false;
}>;
export function listContactTasks(input: {
  actorUserId: string;
  campgroundId: string;
}): Promise<{
  status: string;
  tasks: ContactTask[];
  holds: Array<{
    id: string;
    target: string;
    state: string;
    protocol: string;
    at: string;
  }>;
  personalDataShared: false;
  outboundSent: false;
}>;
export function recordContactAction(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  inboxId: string;
  action: string;
}): Promise<{
  status: string;
  remoteDelivery: false;
}>;
export function checkContactFollowup(input: {
  actorUserId: string;
  campgroundId: string;
  inboxId: string;
}): Promise<{
  status: string;
  externalMessageSent?: false;
  receiverConnected: false;
}>;
