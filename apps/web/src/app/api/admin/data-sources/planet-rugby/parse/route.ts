import { NextResponse } from "next/server";
import {
  PlanetRugbyMatchPageAdapter,
  isPlanetRugbyFixturesUrl,
  isPlanetRugbyMatchUrl,
  isPlanetRugbyTournamentUrl,
} from "@rugby365/import-sdk";

const adapter = new PlanetRugbyMatchPageAdapter();

const DEFAULT_TOURNAMENT_URL =
  "https://www.planetrugby.com/tournament/premiership/results";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceUrl = searchParams.get("url") ?? DEFAULT_TOURNAMENT_URL;
  const enrichSdms = searchParams.get("enrichSdms") !== "false";
  const seasonLabel = searchParams.get("seasonLabel") ?? undefined;

  try {
    if (isPlanetRugbyMatchUrl(sourceUrl)) {
      const data = await adapter.adaptMatchPage(sourceUrl, { enrichSdms });
      return NextResponse.json(data);
    }
    if (isPlanetRugbyTournamentUrl(sourceUrl)) {
      const data = await adapter.adaptTournamentPage(sourceUrl, { enrichSdms, seasonLabel });
      return NextResponse.json(data);
    }
    if (isPlanetRugbyFixturesUrl(sourceUrl)) {
      const data = await adapter.adaptFixturesPage(sourceUrl);
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Unsupported Planet Rugby URL" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
