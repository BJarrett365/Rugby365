import { NextResponse } from "next/server";
import { previewLiveSportTournament } from "@rugby365/import-sdk";

const DEFAULT_URL =
  "https://www.livesport.com/uk/rugby-union/europe/six-nations/";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceUrl = searchParams.get("url") ?? DEFAULT_URL;
  const seasonLabel = searchParams.get("seasonLabel") ?? undefined;

  try {
    const preview = await previewLiveSportTournament(sourceUrl, { seasonLabel });
    return NextResponse.json({
      kind: preview.kind,
      competitionSlug: preview.meta.competitionSlug,
      competitionName: preview.meta.competitionName,
      seasonLabel: preview.meta.seasonLabel,
      tournamentId: preview.meta.tournamentId,
      sourceUrl: preview.meta.sourceUrl,
      fixtureCount: preview.matches.filter((row) => row.status !== "full_time").length,
      resultCount: preview.matches.filter((row) => row.status === "full_time").length,
      tableRowCount: preview.standings.length,
      matches: preview.matches,
      standings: preview.standings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
