import "server-only";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixturePlayers, fixtures, players } from "@rugby365/db";
import { fetchWikipediaSeasonPage } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { parseRwcSquadClubs } from "./rwc-squad-club-parse";
import { indexSquadPlayerNames, matchSquadPlayerIds } from "./rwc-squad-player-match";

export const RWC_SQUAD_CLUB_YEARS = [1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023] as const;

const CACHE_ROOT = join(process.cwd(), "docs/scraped/wikipedia/rugby-world-cup-squads");

export type RwcSquadClubImportResult = {
  year: number;
  parsed: number;
  matched: number;
  updated: number;
  unmatched: number;
};

function cachePath(year: number) {
  return join(CACHE_ROOT, `${year}.wikitext.json`);
}

export async function fetchRwcSquadsWikitext(
  year: number,
  options: { refresh?: boolean } = {},
): Promise<string> {
  const path = cachePath(year);
  if (!options.refresh && existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, "utf8")) as { wikitext?: string };
    if (cached.wikitext) return cached.wikitext;
  }
  const page = await fetchWikipediaSeasonPage(`${year} Rugby World Cup squads`);
  mkdirSync(CACHE_ROOT, { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        year,
        pageTitle: page.pageTitle,
        wikipediaUrl: page.wikipediaUrl,
        scrapedAt: new Date().toISOString(),
        wikitext: page.wikitext,
      },
      null,
      2,
    )}\n`,
  );
  return page.wikitext;
}

export async function importRwcSquadClubsForYear(
  year: number,
  options: { refresh?: boolean; dryRun?: boolean } = {},
): Promise<RwcSquadClubImportResult> {
  const wikitext = await fetchRwcSquadsWikitext(year, { refresh: options.refresh });
  const parsed = parseRwcSquadClubs(wikitext);
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup competition missing");
  const [season] = await db
    .select({ id: competitionSeasons.id })
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
    .limit(1);
  if (!season) {
    return { year, parsed: parsed.length, matched: 0, updated: 0, unmatched: parsed.length };
  }

  const squad = await db.execute(sql`
    SELECT DISTINCT p.id, p.name, p.club_name AS "clubName", p.country_name AS "countryName"
    FROM players p
    WHERE p.id IN (
      SELECT fp.player_id
      FROM fixture_players fp
      JOIN fixtures f ON f.id = fp.fixture_id
      WHERE f.competition_id = ${competition.id} AND f.season_id = ${season.id}
      UNION
      SELECT pmr.player_id
      FROM player_match_ratings pmr
      WHERE pmr.competition_id = ${competition.id} AND pmr.season_id = ${season.id}
    )
  `);

  const byKey = indexSquadPlayerNames(squad as Array<{ id: string; name: string }>);

  const playerIdsByClub = new Map<string, Set<string>>();
  const countryByPlayer = new Map<string, string>();
  let matched = 0;
  let unmatched = 0;
  for (const row of parsed) {
    const ids = matchSquadPlayerIds(row.playerName, byKey);
    if (!ids.length) {
      unmatched += 1;
      continue;
    }
    matched += 1;
    for (const playerId of ids) {
      const set = playerIdsByClub.get(row.clubName) ?? new Set();
      set.add(playerId);
      playerIdsByClub.set(row.clubName, set);
      if (row.countryName && !countryByPlayer.has(playerId)) {
        countryByPlayer.set(playerId, row.countryName);
      }
    }
  }

  if (options.dryRun) {
    return { year, parsed: parsed.length, matched, updated: 0, unmatched };
  }

  let updated = 0;
  for (const [clubName, ids] of playerIdsByClub) {
    const idList = [...ids];
    if (!idList.length) continue;
    const seasonFixtures = await db
      .select({ id: fixtures.id })
      .from(fixtures)
      .where(and(eq(fixtures.competitionId, competition.id), eq(fixtures.seasonId, season.id)));
    const fixtureIds = seasonFixtures.map((f) => f.id);
    if (!fixtureIds.length) continue;
    const written = await db
      .update(fixturePlayers)
      .set({ clubName })
      .where(and(inArray(fixturePlayers.fixtureId, fixtureIds), inArray(fixturePlayers.playerId, idList)))
      .returning({ id: fixturePlayers.id });
    updated += written.length;
  }

  for (const [playerId, countryName] of countryByPlayer) {
    await db
      .update(players)
      .set({ countryName })
      .where(
        and(
          eq(players.id, playerId),
          or(sql`${players.countryName} is null`, sql`${players.countryName} ilike 'unknown%'`),
        ),
      );
  }
  for (const [clubName, ids] of playerIdsByClub) {
    await db
      .update(players)
      .set({ clubName })
      .where(
        and(
          inArray(players.id, [...ids]),
          or(sql`${players.clubName} is null`, sql`${players.clubName} ilike 'unknown%'`, sql`length(trim(${players.clubName})) = 0`),
        ),
      );
  }

  return { year, parsed: parsed.length, matched, updated, unmatched };
}
