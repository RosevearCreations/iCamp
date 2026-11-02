export type CamperAssistanceRequest = {
  id: string;
  organizationId: string;
  campgroundId: string;
  reservationId: string;
  accommodationId: string;
  category: string;
  severity: string;
  summary: string;
  details: string | null;
  contactPreference: string;
  sourceChannel: string;
  requestState: string;
  submittedAt: string | null;
  rowVersion: number;
  mediaCount: number;
};

export function closeCamperAssistancePoolForTests(): Promise<void>;
export function createCamperAssistanceRequest(input: {
  userId: string;
  reservationId: string;
  clientRequestId: string;
  sourceChannel?: string;
  input: Record<string, unknown>;
}): Promise<{
  status: "submitted" | "already_submitted";
  request: CamperAssistanceRequest | null;
}>;
export function listCamperAssistanceRequests(input: {
  userId: string;
  reservationId: string;
}): Promise<CamperAssistanceRequest[]>;
export function getCamperAssistanceRequestForMedia(input: {
  userId: string;
  requestId: string;
}): Promise<CamperAssistanceRequest | null>;
export function attachCamperAssistanceMediaEvidence(input: {
  userId: string;
  requestId: string;
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
}): Promise<{ mediaAssetId: string; requestMediaId: string }>;
