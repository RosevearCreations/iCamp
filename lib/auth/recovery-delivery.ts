export interface RecoveryDeliveryRequest {
  email: string;
  token: string;
}

export interface RecoveryDeliveryAdapter {
  deliverPasswordRecovery(
    request: RecoveryDeliveryRequest,
  ): Promise<{ accepted: boolean }>;
}

export const noOpRecoveryDelivery: RecoveryDeliveryAdapter = {
  async deliverPasswordRecovery() {
    // Build 004 deliberately does not log or expose the raw token.
    // Build 009 connects a real communications adapter.
    return { accepted: false };
  },
};
