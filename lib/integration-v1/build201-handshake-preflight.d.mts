export interface Build201HandshakePreflight {
  schema: string;
  source_id: string;
  intended_peer: string;
  source_owned_shell_contract: string;
  source_owned_shell_paths: readonly string[];
  source_owned_shell_status: "ENDPOINTS_PRESENT_NO_INDEPENDENT_TEST_AUTHORITY";
  reviewed_manifest_schema: string;
  public_transport_origin: string;
  claimed_signature: string;
  independent_source_signer: "NOT_VERIFIED";
  trusted_hub_peer_issuer: "NOT_VERIFIED_IN_ICAMP";
  authorized_test_tenant: "NOT_VERIFIED";
  signed_replay_protected_get: "NOT_ATTEMPTED";
  legacy_ai_data_platform_gateway: string;
  deployment_boundary: string;
  pending_gates: readonly string[];
  connection_state: "DISCONNECTED / HOLD";
  ready_for_authenticated_peer_test: false;
  private_connection_active: false;
  public_launch_authorized: false;
  operator_action: string;
  no_external_requests_or_writes: true;
}
export function build201HandshakePreflight(input?: {
  manifest?: {
    schema?: string;
    source_id?: string;
    repository?: string;
    signature?: {
      algorithm?: string;
      key_id?: string | null;
      value?: string | null;
      state?: string;
    };
    transport?: { origin?: string | null };
  };
  environment?: string;
  legacyGatewayConfigured?: boolean;
}): Build201HandshakePreflight;
