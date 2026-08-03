import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listPublicPlayersDirectory } from "@/lib/public-players-directory-service";

/** Public player search for compare pickers. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const pageSizeRaw = Number.parseInt(searchParams.get("pageSize") ?? "24", 10);
    const pageSize = Number.isFinite(pageSizeRaw) ? pageSizeRaw : 24;
    const preview = searchParams.get("preview") === "1";

    if (q.length < 2 && !preview) {
      return NextResponse.json({ rows: [], total: 0, query: q });
    }

    const dir = await listPublicPlayersDirectory({
      page: 1,
      pageSize: Math.min(48, Math.max(8, pageSize)),
      q: q || undefined,
    });

    return NextResponse.json({
      rows: dir.rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        positionName: r.positionName,
        clubName: r.clubName,
        imageUrl: r.imageUrl,
      })),
      total: dir.total,
      query: dir.query,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to search players");
  }
}
