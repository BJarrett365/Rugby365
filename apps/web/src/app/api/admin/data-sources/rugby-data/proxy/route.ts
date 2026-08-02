import { NextResponse } from "next/server";
import {
  handleRugbyUnionApiRequest,
  isValidRugbyUnionPath,
} from "@/lib/rugby-data-api-route-handler";
import {
  RUGBY_DATA_API_BASE_PATH,
  RUGBY_DATA_API_ENDPOINTS,
} from "@/lib/rugby-data-api-endpoints";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path || !isValidRugbyUnionPath(path)) {
    return NextResponse.json(
      {
        error: `Invalid path. Must start with ${RUGBY_DATA_API_BASE_PATH}/`,
        endpoints: RUGBY_DATA_API_ENDPOINTS.map((endpoint) => ({
          id: endpoint.id,
          name: endpoint.name,
          group: endpoint.group,
          method: endpoint.method,
          samplePath: endpoint.samplePath,
          sampleQuery: endpoint.sampleQuery,
        })),
      },
      { status: 400 },
    );
  }

  const segments = path.slice(`${RUGBY_DATA_API_BASE_PATH}/`.length).split("/").filter(Boolean);
  const proxyUrl = new URL(req.url);
  proxyUrl.searchParams.delete("path");
  const forwarded = new Request(proxyUrl.toString(), {
    method: "GET",
    headers: req.headers,
  });
  return handleRugbyUnionApiRequest(forwarded, segments, "GET");
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path || !isValidRugbyUnionPath(path)) {
    return NextResponse.json(
      { error: `Invalid path. Must start with ${RUGBY_DATA_API_BASE_PATH}/` },
      { status: 400 },
    );
  }

  const segments = path.slice(`${RUGBY_DATA_API_BASE_PATH}/`.length).split("/").filter(Boolean);
  const proxyUrl = new URL(req.url);
  proxyUrl.searchParams.delete("path");
  const body = await req.arrayBuffer();
  const forwarded = new Request(proxyUrl.toString(), {
    method: "POST",
    headers: req.headers,
    body,
  });
  return handleRugbyUnionApiRequest(forwarded, segments, "POST");
}
