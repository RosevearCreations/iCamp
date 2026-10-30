export interface AgreementSnapshot {
  readonly schema: "icamp.agreement.review-preview.v1";
  readonly version: string;
  readonly content_sha256: string;
  readonly state: string;
  readonly revision: number;
  readonly actors: Readonly<Record<string, string>>;
  readonly history: readonly {
    readonly action: string;
    readonly actor: string;
    readonly revision: number;
  }[];
  readonly independently_verified: false;
  readonly legally_approved: false;
  readonly published: false;
  readonly persisted: false;
}
export function createAgreementReview(input: {
  version: string;
  contentSha256: string;
}): AgreementSnapshot;
export function previewAgreementDecision(
  previous: AgreementSnapshot,
  decision: {
    action: "submit" | "review" | "approve" | "request_changes" | "reject";
    actor: string;
    expectedRevision: number;
  },
): AgreementSnapshot;
