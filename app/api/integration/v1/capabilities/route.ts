import { handleIntegrationReadiness } from "@/lib/integration-v1/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return handleIntegrationReadiness(
    request,
    "/api/integration/v1/capabilities",
  );
}
