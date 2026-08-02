import { NextResponse } from "next/server";
import { rugbyDataApiFetch } from "@/lib/rugby-data-api-client";
import {
  buildRugbyUnionPath,
  isValidRugbyUnionPath,
} from "@/lib/rugby-data-api-endpoints";
import { apiErrorResponse } from "@/lib/api-errors";

function readForwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of ["timezone", "difference"]) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

async function readPostBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      if (value == null) continue;
      body[key] = String(value);
    }
    return body;
  }

  const form = await req.formData();
  const body: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") body[key] = value;
  }
  return body;
}

export async function handleRugbyUnionApiRequest(
  req: Request,
  segments: string[] | undefined,
  method: "GET" | "POST",
) {
  const path = buildRugbyUnionPath(segments ?? []);
  if (!isValidRugbyUnionPath(path)) {
    return NextResponse.json({ status: 404, message: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const headers = readForwardHeaders(req);
  const requestToken = req.headers.get("token") ?? undefined;
  const body = method === "POST" ? await readPostBody(req) : undefined;

  try {
    const result = await rugbyDataApiFetch({
      path,
      method,
      query,
      headers,
      body,
      requestToken,
      returnRawBody: true,
      capture: true,
    });

    const responseStatus = result.status || (result.ok ? 200 : 502);
    if (result.rawBody != null) {
      return NextResponse.json(result.rawBody, { status: responseStatus });
    }

    return NextResponse.json(
      {
        status: responseStatus,
        message: result.errorMessage ?? "Upstream request failed",
      },
      { status: responseStatus },
    );
  } catch (e) {
    return apiErrorResponse(e, "Rugby Union API request failed");
  }
}
