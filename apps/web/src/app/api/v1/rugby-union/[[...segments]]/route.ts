import { handleRugbyUnionApiRequest } from "@/lib/rugby-data-api-route-handler";

type RouteContext = { params: Promise<{ segments?: string[] }> };

export async function GET(req: Request, context: RouteContext) {
  const { segments } = await context.params;
  return handleRugbyUnionApiRequest(req, segments, "GET");
}

export async function POST(req: Request, context: RouteContext) {
  const { segments } = await context.params;
  return handleRugbyUnionApiRequest(req, segments, "POST");
}
