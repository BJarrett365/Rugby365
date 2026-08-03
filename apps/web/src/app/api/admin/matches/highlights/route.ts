import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  listYoutubeHighlightsChannels,
  previewYoutubeHighlightsForChannel,
  syncYoutubeHighlightsForChannel,
} from "@/lib/youtube-highlights-import-service";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      channels: listYoutubeHighlightsChannels(),
      note: "Assigns full-match YouTube highlights onto existing fixtures only. Add more league channels as you find them.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load highlights channels");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      channelKey?: string;
      overwrite?: boolean;
    };
    const channelKey = typeof body.channelKey === "string" ? body.channelKey.trim() : "npc";
    const overwrite = body.overwrite === true;

    if (body.action === "preview") {
      const result = await previewYoutubeHighlightsForChannel({ channelKey, overwrite });
      return NextResponse.json({
        ...result,
        message: `Preview ${result.channelLabel}: ${result.highlightVideos} highlight videos → ${result.matched} fixtures (${result.unmatched} unmatched).`,
      });
    }

    if (body.action === "sync" || !body.action) {
      const result = await syncYoutubeHighlightsForChannel({ channelKey, overwrite });
      return NextResponse.json({
        ...result,
        message: `Assigned ${result.assigned} highlights for ${result.channelLabel} (${result.skippedExisting} kept existing, ${result.unmatched} unmatched).`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to sync YouTube highlights");
  }
}
