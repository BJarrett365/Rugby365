import { NextResponse } from "next/server";
import { listCompetitions } from "@/lib/competition-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

/** Public competition list for pickers (compare, filters, etc.). */
export async function GET() {
  try {
    const rows = await listCompetitions();
    const competitions = rows
      .filter((c) => Boolean(c.slug?.trim()) && Boolean(c.name?.trim()))
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ competitions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list competitions");
  }
}
