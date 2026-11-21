export function originalPool270(): unknown;
export function sourceReadiness270(): Promise<{
  status: string;
  database: { runtimeTargetPinMatches: boolean; [key: string]: unknown };
  adoption270: boolean;
  trafficPaired: boolean;
  commsOutboundReady: boolean;
  providerReadOnlyReady: boolean;
}>;
export function inspectOwnerEnrollment270(): Promise<{
  status: string;
  identifiedOriginalHost: boolean;
  accountFound: boolean;
  accountActive: boolean;
  credentialPresent: boolean;
  recoveryEmailVerified: boolean;
  platformGrantActive: boolean;
  mfaVerified: boolean;
  independentOwnerBinding: boolean;
  canResetWithEmail: boolean;
}>;
export function compareOriginalPayment270(input: {
  userId: string;
  campgroundId: string;
  recoveryId: string;
  paymentId: string;
}): Promise<{ status: string; matched: boolean }>;
export function originalRestoreCertification270(): Promise<{
  status: string;
  originalEvidenceChains?: number;
  externalHostRestorationVerified: boolean;
}>;
