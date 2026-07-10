import { NextResponse } from "next/server";
import { competitionSeasons } from "@rugby365/db";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { importPremiershipTransfers, PREMIERSHIP_TRANSFERS_WIKI_URL } from "@/lib/premiership-transfers-import-service";
import {
  DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
  PREMIERSHIP_TRANSFER_SOURCES,
} from "@/lib/premiership-transfer-constants";
import { resolvePremiershipSeason } from "@/lib/transfer-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      seasonLabel?: string;
      dryRun?: boolean;
      forcePlayerIds?: Record<string, string>;
    };

    const result = await importPremiershipTransfers({
      url: body.url ?? PREMIERSHIP_TRANSFERS_WIKI_URL,
      seasonLabel: body.seasonLabel ?? DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
      dryRun: body.dryRun ?? false,
      forcePlayerIds: body.forcePlayerIds,
    });

    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to import Premiership transfers");
  }
}

export async function GET() {
  const { competition } = await resolvePremiershipSeason();
  const db = getDb();
  const seasons = await db
    .select({ id: competitionSeasons.id, label: competitionSeasons.label })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id));

  return NextResponse.json({
    defaultUrl: PREMIERSHIP_TRANSFERS_WIKI_URL,
    defaultSeasonLabel: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
    seasonLabel: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
    sources: PREMIERSHIP_TRANSFER_SOURCES,
    competitionId: competition.id,
    seasons,
  });
}
