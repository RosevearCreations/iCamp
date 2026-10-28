import {
  handleIntegrationReadiness,
  handleIntegrationMethodDenied,
} from "@/lib/integration-v1/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return handleIntegrationReadiness(
    request,
    "/api/integration/v1/capabilities",
  );
}
export function POST(request: Request) {
  return handleIntegrationMethodDenied(
    request,
    "/api/integration/v1/capabilities",
  );
}
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
export const OPTIONS = POST;
