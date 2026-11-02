export type SecurityIncidentCase = {
  id: string;
  campgroundId: string;
  title: string;
  category: string;
  severity: string;
  operationalSummary: string;
  status: string;
  linkedSignalKind: string | null;
  linkedSignalId: string | null;
  openedByUserId: string;
  assigneeUserId: string | null;
  closureRequestedByUserId: string | null;
  closureRound: number;
  closedByUserId: string | null;
  openedAt: string;
  updatedAt: string;
  closedAt: string | null;
  rowVersion: number;
};
export type SecurityIncidentEvent = {
  id: string;
  eventKind: string;
  actorUserId: string;
  summary: string;
  occurredAt: string;
};
export type SecurityIncidentAttachment = {
  id: string;
  caption: string;
  filename: string;
  byteSize: number;
  lifecycleState: string;
  validationState: string;
  actorUserId: string;
  attachedAt: string;
};
export type SecurityIncidentBoard = {
  cases: SecurityIncidentCase[];
  selected: SecurityIncidentCase | null;
  events: SecurityIncidentEvent[];
  reviews: Array<{
    id: string;
    closureRound: number;
    reviewerUserId: string;
    decision: string;
    rationale: string;
    reviewedAt: string;
  }>;
  attachments: SecurityIncidentAttachment[];
  sensitive: { witnessContext: string; guestContext: string } | null;
  canSeeSensitive: boolean;
};
export function listSecurityIncidentCases(input: {
  actorUserId: string;
  campgroundId: string;
  selectedCaseId?: string | null;
}): Promise<SecurityIncidentBoard>;
export function createSecurityIncidentCase(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  input: {
    title: string;
    category: string;
    severity: string;
    operationalSummary: string;
    linkedSignalKind?: string;
    linkedSignalId?: string;
  };
}): Promise<SecurityIncidentCase>;
export function updateSecurityIncidentCase(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  caseId: string;
  rowVersion: number;
  action: string;
  details: string;
  assigneeUserId?: string | null;
}): Promise<SecurityIncidentCase>;
export function reviewSecurityIncidentClosure(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  caseId: string;
  rowVersion: number;
  decision: string;
  rationale: string;
}): Promise<SecurityIncidentCase>;
export function updateSecurityIncidentSensitive(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  caseId: string;
  rowVersion: number;
  witnessContext: string;
  guestContext: string;
}): Promise<void>;
export function addSecurityIncidentAttachment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  caseId: string;
  rowVersion: number;
  caption: string;
  media: {
    id: string;
    mediaKind: string;
    bucketKey: string;
    objectKey: string;
    originalFilename: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
  };
}): Promise<string>;
export function getSecurityIncidentAttachment(input: {
  actorUserId: string;
  attachmentId: string;
}): Promise<null | {
  campgroundId: string;
  storageProvider: string;
  bucketKey: string;
  objectKey: string;
}>;
export function isSecurityIncidentMedia(
  mediaAssetId: string,
): Promise<string | null>;
export function closeSecurityIncidentPoolForTests(): Promise<void>;
