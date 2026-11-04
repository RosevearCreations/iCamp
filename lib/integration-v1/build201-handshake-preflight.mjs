import {
  CONTRACT as SHELL_CONTRACT,
  PATHS as SHELL_PATHS,
} from "./ql335-shell.mjs";

const SOURCE_ID = "icamp";
const REPOSITORY = "RosevearCreations/iCamp";
const TRUST_GATES = Object.freeze([
  "SOURCE_MANIFEST_SIGNATURE",
  "INDEPENDENT_SIGNER_CUSTODY",
  "HUB_PEER_ISSUER_ENROLLMENT",
  "APPROVED_NONPRODUCTION_TENANT",
  "SIGNED_NONREPLAYED_GET_RECEIPT",
  "INDEPENDENT_OWNER_TEST_ACCEPTANCE",
]);

/**
 * This preflight reads only local public manifest/config assertions. It cannot
 * see or attest to private Hub registry records and must never return READY.
 */
export function build201HandshakePreflight({
  manifest,
  environment = "unknown",
  legacyGatewayConfigured = false,
} = {}) {
  const validSource =
    manifest?.schema === "rosevear.integration.discovery.v1" &&
    manifest?.source_id === SOURCE_ID &&
    manifest?.repository === REPOSITORY;
  const hasClaimedSignature =
    validSource &&
    manifest.signature?.algorithm === "Ed25519" &&
    typeof manifest.signature?.key_id === "string" &&
    manifest.signature.key_id.length > 0 &&
    typeof manifest.signature?.value === "string" &&
    manifest.signature.value.length > 0;
  const sourceHasExplicitHttpsOrigin =
    validSource &&
    typeof manifest.transport?.origin === "string" &&
    /^https:\/\/[a-z0-9.-]+$/i.test(manifest.transport.origin);
  const production = environment === "production";
  return Object.freeze({
    schema: "icamp.build201.trusted-handshake-preflight.v1",
    source_id: SOURCE_ID,
    intended_peer: "rosevear-comms-hub",
    source_owned_shell_contract: SHELL_CONTRACT,
    source_owned_shell_paths: SHELL_PATHS,
    source_owned_shell_status:
      "ENDPOINTS_PRESENT_NO_INDEPENDENT_TEST_AUTHORITY",
    reviewed_manifest_schema: validSource ? "EXPECTED" : "MISMATCH_OR_MISSING",
    public_transport_origin: sourceHasExplicitHttpsOrigin
      ? "SOURCE_DECLARED_NOT_INDEPENDENTLY_VERIFIED"
      : "MISSING_OR_INVALID",
    claimed_signature: hasClaimedSignature
      ? "PRESENT_NOT_INDEPENDENTLY_VERIFIED"
      : "MISSING",
    independent_source_signer: "NOT_VERIFIED",
    trusted_hub_peer_issuer: "NOT_VERIFIED_IN_ICAMP",
    authorized_test_tenant: "NOT_VERIFIED",
    signed_replay_protected_get: "NOT_ATTEMPTED",
    legacy_ai_data_platform_gateway: legacyGatewayConfigured
      ? "SEPARATE_TEST_GATEWAY_CONFIGURED_NOT_COMMS_HUB"
      : "DISABLED",
    deployment_boundary: production
      ? "PRODUCTION_PRIVATE_GATE_DISABLED"
      : "NONPRODUCTION_SCOPE_NOT_AUTHORIZED",
    pending_gates: TRUST_GATES,
    connection_state: "DISCONNECTED / HOLD",
    ready_for_authenticated_peer_test: false,
    private_connection_active: false,
    public_launch_authorized: false,
    operator_action:
      "Supply original source signer evidence, independent custody, Hub peer enrollment and owner-scoped isolated TEST approval before any private handshake.",
    no_external_requests_or_writes: true,
  });
}
