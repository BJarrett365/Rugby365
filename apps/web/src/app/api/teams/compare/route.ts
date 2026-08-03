import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { compareTeamsBySlug } from "@/lib/team-compare-service";

/** Public team head-to-head compare payload. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const a = searchParams.get("a")?.trim() ?? "";
    const b = searchParams.get("b")?.trim() ?? "";

    if (!a || !b) {
      return NextResponse.json({ error: "Pick two teams (a and b)." }, { status: 400 });
    }
    if (a === b) {
      return NextResponse.json({ error: "Pick two different teams." }, { status: 400 });
    }

    const data = await compareTeamsBySlug(a, b);
    if (!data) {
      return NextResponse.json({ error: "One or both teams were not found." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team comparison");
  }
}
