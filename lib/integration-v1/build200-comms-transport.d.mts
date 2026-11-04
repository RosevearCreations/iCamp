export function checkPublicCommsHubTransport(fetcher?: typeof fetch): Promise<{
  schema: string;
  target: string;
  transport: string;
  response_code: number | null;
  signed_source_identity: "NOT_ENROLLED";
  independent_source_proof: "MISSING";
  isolated_nonproduction_tenant: "NOT_VERIFIED";
  authenticated_gateway_get: "NOT_ATTEMPTED";
  verified_business_connection: false;
  external_message_sent: false;
  connection_state: "DISCONNECTED / HOLD";
}>;
