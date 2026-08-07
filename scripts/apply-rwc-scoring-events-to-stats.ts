/**
 * Apply match_events scoring (Wikipedia / rugbydatabase) onto fixture_players
 * and player_match_performance_stats for Rugby World Cup seasons.
 *
 * Matches event payload.playerName (often a surname) to squad players on the
 * same fixture + team side.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/apply-rwc-scoring-events-to-stats.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/apply-rwc-scoring-events-to-stats.ts --years=1987,1995
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  matchEvents,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { normalizePlayerName, normalizedEntityKey } from "../apps/web/src/lib/entity-normalize";

const COMPETITION_SLUG = "rugby-world-cup";

/** Try value became 5 points from 1992; RWC 1987–1991 used 4. */
function scoringPoints(year: number | null | undefined): Record<string, number> {
  const tryPts = year != null && year < 1992 ? 4 : 5;
  return {
    try: tryPts,
    conversion: 2,
    penalty: 3,
    drop_goal: 3,
    penalty_try: tryPts + 2,
  };
}

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));

function foldKey(name: string): string {
  return normalizePlayerName(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameParts(name: string): string[] {
  return foldKey(name)
    .split(/[\s.]+/)
    .filter(Boolean);
}

function surnameKey(name: string): string {
  const parts = nameParts(name);
  return parts[parts.length - 1] ?? foldKey(name);
}

function fullKey(name: string): string {
  return foldKey(name);
}

function isPlaceholderName(name: string): boolean {
  const n = name.trim();
  return !n || n === "-" || /to be announced|tbc|tba|unknown/i.test(n);
}

/** Western Samoa (historical) ↔ Samoa, etc. */
function teamAliasKeys(teamName: string): string[] {
  const key = foldKey(teamName);
  const aliases = new Set([key]);
  if (key === "western samoa" || key === "samoa") {
    aliases.add("samoa");
    aliases.add("western samoa");
  }
  if (key === "usa" || key === "united states" || key === "united states of america") {
    aliases.add("united states");
    aliases.add("usa");
  }
  return [...aliases];
}

type SquadCandidate = {
  playerId: string;
  teamId: string;
  name: string;
  fixturePlayerId?: string;
};

function matchPlayer(rawName: string, candidates: SquadCandidate[]): SquadCandidate | null {
  if (isPlaceholderName(rawName) || /penalty try/i.test(rawName)) return null;
  const rawParts = nameParts(rawName);
  if (!rawParts.length) return null;
  const rawSur = rawParts[rawParts.length - 1]!;
  const rawGiven = rawParts.length > 1 ? rawParts[0]! : null;
  const rawInit = rawGiven?.[0] ?? null;

  const usable = candidates.filter((c) => !isPlaceholderName(c.name));
  const byFull = usable.filter((c) => fullKey(c.name) === fullKey(rawName));
  if (byFull.length === 1) return byFull[0]!;

  const bySur = usable.filter((c) => surnameKey(c.name) === rawSur);
  if (bySur.length === 1) return bySur[0]!;

  if (rawInit) {
    const byInit = bySur.filter((c) => {
      const given = nameParts(c.name)[0] ?? "";
      return given.startsWith(rawInit);
    });
    if (byInit.length === 1) return byInit[0]!;
  }

  if (rawGiven && rawGiven.length >= 2) {
    const byStem = bySur.filter((c) => {
      const given = nameParts(c.name)[0] ?? "";
      return given.startsWith(rawGiven) || rawGiven.startsWith(given);
    });
    if (byStem.length === 1) return byStem[0]!;
  }

  // Compound surnames in events ("Del Castillo") vs squad ("Lisandro Arbizu" won't match;
  // this path handles "Williams-Jones" vs event "Williams" when unique enough).
  const compound = usable.filter((c) => {
    const parts = nameParts(c.name);
    return parts.some((p) => p === rawSur) && parts.length > 1;
  });
  if (compound.length === 1 && bySur.length === 0) return compound[0]!;

  return null;
}

async function main() {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup missing");

  const seasons = (await db.select().from(competitionSeasons).where(eq(competitionSeasons.competitionId, competition.id)))
    .filter((s) => s.year != null && s.year <= 2023)
    .filter((s) => !onlyYears?.length || onlyYears.includes(s.year!))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  console.log(`Applying scoring events → stats for ${seasons.map((s) => s.year).join(", ")}`);

  for (const season of seasons) {
    const POINTS = scoringPoints(season.year);
    const seasonFixtures = await db
      .select({
        id: fixtures.id,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        externalMatchId: fixtures.externalMatchId,
      })
      .from(fixtures)
      .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.competitionId, competition.id)));

    // Season-wide roster for fallback when a fixture has empty/TBA lineups.
    const seasonSquadRows = seasonFixtures.length
      ? await db
          .select({
            fixtureId: fixturePlayers.fixtureId,
            playerId: fixturePlayers.playerId,
            teamId: fixturePlayers.teamId,
            id: fixturePlayers.id,
            playerName: players.name,
            teamName: teams.name,
          })
          .from(fixturePlayers)
          .innerJoin(players, eq(fixturePlayers.playerId, players.id))
          .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
          .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
          .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.competitionId, competition.id)))
      : [];

    const seasonByTeamAlias = new Map<string, SquadCandidate[]>();
    for (const row of seasonSquadRows) {
      if (isPlaceholderName(row.playerName)) continue;
      const candidate: SquadCandidate = {
        playerId: row.playerId,
        teamId: row.teamId,
        name: row.playerName,
        fixturePlayerId: row.id,
      };
      for (const alias of teamAliasKeys(row.teamName)) {
        const list = seasonByTeamAlias.get(alias) ?? [];
        if (!list.some((c) => c.playerId === candidate.playerId && c.teamId === candidate.teamId)) {
          list.push(candidate);
        }
        seasonByTeamAlias.set(alias, list);
      }
    }

    const teamNameById = new Map<string, string>();
    for (const row of seasonSquadRows) teamNameById.set(row.teamId, row.teamName);
    // Also load fixture home/away team names for events on empty-squad fixtures.
    const teamIds = [
      ...new Set(
        seasonFixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]).filter(Boolean) as string[],
      ),
    ];
    if (teamIds.length) {
      const teamRows = await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(inArray(teams.id, teamIds));
      for (const t of teamRows) teamNameById.set(t.id, t.name);
    }

    let eventsUsed = 0;
    let playersUpdated = 0;
    let unmatched = 0;
    let attachedToFixture = 0;

    for (const fixture of seasonFixtures) {
      if (!fixture.homeTeamId || !fixture.awayTeamId) continue;

      const [squad, events] = await Promise.all([
        db.select().from(fixturePlayers).where(eq(fixturePlayers.fixtureId, fixture.id)),
        db
          .select()
          .from(matchEvents)
          .where(
            and(
              eq(matchEvents.fixtureId, fixture.id),
              inArray(matchEvents.eventType, ["try", "conversion", "penalty", "drop_goal", "penalty_try"]),
            ),
          ),
      ]);
      if (!events.length) continue;

      type Acc = {
        playerId: string;
        teamId: string;
        tries: number;
        conversions: number;
        penalties: number;
        dropGoals: number;
        points: number;
      };
      const acc = new Map<string, Acc>();

      const playerIds = [...new Set(squad.map((s) => s.playerId))];
      const nameRows = playerIds.length
        ? await db.select({ id: players.id, name: players.name }).from(players).where(inArray(players.id, playerIds))
        : [];
      const nameById = new Map(nameRows.map((r) => [r.id, r.name]));

      const fixtureCandidatesByTeam = new Map<string, SquadCandidate[]>();
      for (const row of squad) {
        const name = nameById.get(row.playerId) ?? "";
        if (isPlaceholderName(name)) continue;
        const list = fixtureCandidatesByTeam.get(row.teamId) ?? [];
        list.push({ playerId: row.playerId, teamId: row.teamId, name, fixturePlayerId: row.id });
        fixtureCandidatesByTeam.set(row.teamId, list);
      }

      for (const event of events) {
        const payload = (event.payload ?? {}) as { playerName?: string; teamSide?: string };
        const playerName = payload.playerName?.trim();
        if (!playerName || /penalty try/i.test(playerName)) {
          unmatched += 1;
          continue;
        }
        const teamId =
          event.teamId ??
          (payload.teamSide === "away" ? fixture.awayTeamId : fixture.homeTeamId);
        if (!teamId) {
          unmatched += 1;
          continue;
        }

        let playerId = event.playerId;
        let matched: SquadCandidate | null = null;

        if (playerId) {
          const onFixture = squad.find((s) => s.playerId === playerId && s.teamId === teamId);
          if (onFixture) {
            matched = {
              playerId,
              teamId,
              name: nameById.get(playerId) ?? "",
              fixturePlayerId: onFixture.id,
            };
          }
        }

        if (!matched) {
          matched = matchPlayer(playerName, fixtureCandidatesByTeam.get(teamId) ?? []);
        }

        // Season-wide / alias roster fallback (covers empty wiki lineups + Samoa/Western Samoa).
        if (!matched) {
          const teamName = teamNameById.get(teamId) ?? "";
          const pool: SquadCandidate[] = [];
          for (const alias of teamAliasKeys(teamName)) {
            for (const c of seasonByTeamAlias.get(alias) ?? []) pool.push(c);
          }
          matched = matchPlayer(playerName, pool);
          if (matched && matched.teamId !== teamId) {
            // Keep scoring under the fixture's team id but use the resolved player.
            matched = { ...matched, teamId };
          }
        }

        if (!matched) {
          unmatched += 1;
          continue;
        }

        playerId = matched.playerId;

        // Ensure the player is on this fixture so scoring can stick to fixture_players.
        let onFixture = squad.find((s) => s.playerId === playerId && s.teamId === teamId);
        if (!onFixture) {
          const [inserted] = await db
            .insert(fixturePlayers)
            .values({
              fixtureId: fixture.id,
              playerId,
              teamId,
              squadRole: "starting",
              tries: 0,
              conversions: 0,
              penalties: 0,
              dropGoals: 0,
              points: 0,
            })
            .onConflictDoNothing({
              target: [fixturePlayers.fixtureId, fixturePlayers.playerId],
            })
            .returning();
          if (inserted) {
            squad.push(inserted);
            onFixture = inserted;
            attachedToFixture += 1;
          } else {
            const [existing] = await db
              .select()
              .from(fixturePlayers)
              .where(
                and(
                  eq(fixturePlayers.fixtureId, fixture.id),
                  eq(fixturePlayers.playerId, playerId),
                  eq(fixturePlayers.teamId, teamId),
                ),
              )
              .limit(1);
            onFixture = existing ?? undefined;
          }
        }
        if (!onFixture) {
          unmatched += 1;
          continue;
        }

        eventsUsed += 1;
        const key = `${playerId}:${teamId}`;
        const cur = acc.get(key) ?? {
          playerId,
          teamId,
          tries: 0,
          conversions: 0,
          penalties: 0,
          dropGoals: 0,
          points: 0,
        };
        const type = event.eventType;
        if (type === "try" || type === "penalty_try") cur.tries += 1;
        else if (type === "conversion") cur.conversions += 1;
        else if (type === "penalty") cur.penalties += 1;
        else if (type === "drop_goal") cur.dropGoals += 1;
        cur.points += POINTS[type] ?? 0;
        acc.set(key, cur);

        if (!event.playerId || event.playerId !== playerId) {
          await db.update(matchEvents).set({ playerId, teamId }).where(eq(matchEvents.id, event.id));
        }
      }

      for (const row of acc.values()) {
        await db
          .update(fixturePlayers)
          .set({
            tries: row.tries,
            conversions: row.conversions,
            penalties: row.penalties,
            dropGoals: row.dropGoals,
            points: row.points,
          })
          .where(
            and(
              eq(fixturePlayers.fixtureId, fixture.id),
              eq(fixturePlayers.playerId, row.playerId),
              eq(fixturePlayers.teamId, row.teamId),
            ),
          );

        playersUpdated += 1;
      }
    }

    console.log(
      `  ${season.year}: fixtures=${seasonFixtures.length} eventsUsed=${eventsUsed} squadScoresUpdated=${playersUpdated} attached=${attachedToFixture} unmatched=${unmatched}`,
    );
  }

  console.log("Done. Run sync:rwc:player-stats next to push scores into leaderboards.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
