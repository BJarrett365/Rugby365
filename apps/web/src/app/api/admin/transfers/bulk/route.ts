import { NextResponse } from "next/server";
import { bulkDeleteTransfers } from "@/lib/transfer-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const result = await bulkDeleteTransfers(ids);
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to bulk delete transfers");
  }
}
