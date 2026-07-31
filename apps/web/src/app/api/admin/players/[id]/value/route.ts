import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  calculateAndPersistPlayerValue,
  getPlayerValueForPublic,
} from "@/lib/player-value-service";
import type { PlayerValueMediaSnippet } from "@/lib/player-value-media-check";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const value = await getPlayerValueForPublic(id, { calculateIfMissing: false });
    return NextResponse.json({ value });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player value");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      mediaSnippets?: PlayerValueMediaSnippet[];
    };
    const value = await calculateAndPersistPlayerValue(id, {
      mediaSnippets: Array.isArray(body.mediaSnippets) ? body.mediaSnippets : undefined,
    });
    if (!value) return NextResponse.json({ error: "Player not found" }, { status: 404 });
    return NextResponse.json({ value });
  } catch (e) {
    return apiErrorResponse(e, "Failed to calculate player value");
  }
}
