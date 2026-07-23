import { eq } from "drizzle-orm";
import { competitionSeasons, fixtures } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { parseSeasonStartYear } from "@/lib/season-label-utils";
import {
  fixtureBelongsToSeason,
  seasonKindFromCompetitionType,
} from "@/lib/fixture-season-resolve";
import { getCompetitionById } from "@/lib/competition-admin-service";
import { isLiveFixtureStatus } from "@/lib/table-lab/live-table-service";

const POLL_MS = 12_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get("competitionId");
  const seasonId = searchParams.get("seasonId");
  if (!competitionId || !seasonId) {
    return new Response("competitionId and seasonId are required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let lastFingerprint = "";
  let tick = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: { type: string; changed?: boolean }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const poll = async () => {
        const db = getDb();
        const [season] = await db
          .select()
          .from(competitionSeasons)
          .where(eq(competitionSeasons.id, seasonId))
          .limit(1);
        const startYear = season?.year ?? parseSeasonStartYear(season?.label ?? "");
        const competition = await getCompetitionById(competitionId);
        const seasonKind = seasonKindFromCompetitionType(competition?.competitionType);
        const rows = await db
          .select({
            id: fixtures.id,
            kickoffAt: fixtures.kickoffAt,
            status: fixtures.status,
            homeScore: fixtures.homeScore,
            awayScore: fixtures.awayScore,
            matchMinute: fixtures.matchMinute,
            period: fixtures.period,
            seasonId: fixtures.seasonId,
          })
          .from(fixtures)
          .where(eq(fixtures.competitionId, competitionId));

        const liveRows = rows.filter((row) => {
          if (!isLiveFixtureStatus(row.status)) return false;
          if (startYear == null || !season) return true;
          return fixtureBelongsToSeason({
            fixtureSeasonId: row.seasonId,
            kickoffAt: row.kickoffAt,
            seasonId: season.id,
            seasonYear: startYear,
            seasonKind,
          });
        });

        const fingerprint = liveRows
          .map(
            (row) =>
              `${row.id}:${row.homeScore}-${row.awayScore}:${row.matchMinute}:${row.period}:${row.status}`,
          )
          .sort()
          .join("|");

        tick += 1;
        const changed = fingerprint !== lastFingerprint;
        if (changed) lastFingerprint = fingerprint;
        send({ type: "refresh", changed: changed || tick === 1 });
      };

      try {
        await poll();
      } catch {
        controller.close();
        return;
      }

      const interval = setInterval(async () => {
        try {
          await poll();
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, POLL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
