/**
 * Research-backed profile + season-stat updates for Herschel Jantjies and
 * Elton Jantjies.
 *
 * 2019 Rugby Championship: Wikipedia / All.Rugby / bokhist match sheets.
 * Herschel's Wikipedia import had tries/points with appearances 0. Elton started
 * only the Australia Test (five conversions) and did not play the last two.
 * Herschel club/Test lines 2019–2026: All.Rugby overall tables. Elton's existing
 * All.Rugby lines are re-applied. Caps: bokhist / Wikipedia.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-herschel-elton-2019.ts
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerCareerStints,
  playerImages,
  playerMatchPerformanceStats,
  playerSeasonStats,
  playerTitles,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { updatePlayer } from "../apps/web/src/lib/entity-admin-service";
import { applyPlayerImageAction } from "../apps/web/src/lib/player-image-service";
import { createPlayerTitle } from "../apps/web/src/lib/player-titles-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";

const SOUTH_AFRICA_ID = "b0000000-0000-4000-8000-000000000001";
const SOURCE = "all_rugby";
const HERSCHEL_WIKI = "https://en.wikipedia.org/wiki/Herschel_Jantjies";
const ELTON_WIKI = "https://en.wikipedia.org/wiki/Elton_Jantjies";

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = {
  ...JSON.parse(readFileSync(join(here, "springboks-herschel-jantjies-season-lines.json"), "utf8")),
  ...JSON.parse(readFileSync(join(here, "springboks-jantjies-season-lines.json"), "utf8")),
} as Record<string, SeasonLine[]>;
const TRC_2019_MATCHES = JSON.parse(
  readFileSync(join(here, "springboks-jantjies-2019-trc-matches.json"), "utf8"),
) as {
  matches: Array<{
    fixtureSlug: string;
    players: Record<
      string,
      {
        squadRole: "starting" | "bench";
        jerseyNumber: number;
        positionName: string;
        minutes: number;
        tries: number;
        conversions: number;
        penalties: number;
        dropGoals: number;
        points: number;
      }
    >;
  }>;
};

type SeasonLine = {
  allRugbySeason: string;
  competitionSlug: string;
  teamSlug: string;
  appearances: number;
  tries: number;
  points: number;
  minutes: number;
  starts?: number;
  seasonYear?: number;
  source?: string;
};

type PlayerUpdate = {
  ids: string[];
  seasonKey: string;
  name: string;
  fullName: string;
  wikipediaUrl: string;
  officialUrl: string;
  birthDate: string;
  birthPlace: string;
  heightCm: number;
  weightKg: number;
  clubName: string;
  clubTeamSlug: string | null;
  positionName: string;
  positions: string[];
  school?: string;
  university?: string | null;
  bioSummary: string;
  caps: number;
  tries: number;
  points: number;
  intlYearsLabel: string;
  careerStatus: "active" | "released" | "retired";
  statusOverride?: string | null;
  imageUrl?: string;
  imageAlt?: string;
  titles: Array<{
    titleType: string;
    title: string;
    year: number;
    seasonLabel?: string;
    sourceUrl: string;
  }>;
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: [
      "df890c82-9f69-47ea-8ef9-1d38d8ce22db",
      "eeb8f48e-fec2-475b-a31a-eda7237a88c4",
      "1c70aa58-6c14-4349-9cb4-86325b5b288b",
      "8351f339-0c4d-4221-92a7-4499507cdd02",
      "95e9a645-1c2b-46b0-88ca-d8b892c840fa",
    ],
    seasonKey: "herschel-jantjies",
    name: "Herschel Jantjies",
    fullName: "Herschel Jerome Jantjies",
    wikipediaUrl: HERSCHEL_WIKI,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=774",
    birthDate: "1996-04-22",
    birthPlace: "Stellenbosch, South Africa",
    heightCm: 167,
    weightKg: 75,
    clubName: "Bayonne",
    clubTeamSlug: "bayonne",
    positionName: "scrum-half",
    positions: ["scrum-half"],
    school: "Paul Roos Gymnasium",
    university: "University of the Western Cape",
    bioSummary:
      "Springbok scrum-half (Springbok #913) who has played for Western Province, the Stormers, Scarlets and Bayonne. 25 Tests, 6 tries and 30 points (bokhist). Rugby World Cup winner in 2019 (six appearances, including the final off the bench; unused replacement in the semi-final vs Wales). In the 2019 Rugby Championship he played all three Tests — starting vs Australia with two tries, then scoring vs New Zealand off the bench — for 3 tries, 15 points and 109 minutes, joint top try-scorer. Rugby Championship winner 2019.",
    caps: 25,
    tries: 6,
    points: 30,
    intlYearsLabel: "2019–2026",
    careerStatus: "active",
    statusOverride: null,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/Herschel_Jantjies_Zebre_2022.jpg",
    imageAlt: "Herschel Jantjies, Stormers vs Zebre, 2022",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2019, sourceUrl: HERSCHEL_WIKI },
      { titleType: "other", title: "Rugby Championship winner", year: 2019, sourceUrl: HERSCHEL_WIKI },
    ],
  },
  {
    ids: ["185e00e1-aa40-44d0-a1ce-3dfba2f52cdd", "bba65ada-f5b2-4e09-a99b-be6aa9ebc3bf"],
    seasonKey: "elton-jantjies",
    name: "Elton Jantjies",
    fullName: "Elton Thomas Jantjies",
    wikipediaUrl: ELTON_WIKI,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=799",
    birthDate: "1990-08-01",
    birthPlace: "Graaff-Reinet, South Africa",
    heightCm: 176,
    weightKg: 84,
    clubName: "",
    clubTeamSlug: null,
    positionName: "fly-half",
    positions: ["fly-half", "centre"],
    school: "Florida / Klerksdorp",
    bioSummary:
      "Springbok fly-half (Springbok #819) who played for the Lions, Stormers, Pau, Red Hurricanes Osaka and Agen. 46 Tests, 2 tries and 331 points (Wikipedia vs-table / bokhist). Currie Cup winner with the Golden Lions in 2011 (man of the match in the final). Rugby World Cup winner in 2019 (started against Namibia and Canada; 14 conversions). In the 2019 Rugby Championship he started only the Australia Test (five conversions, 10 points, 80 minutes) and did not play the last two Tests. Serving a four-year SAIDS doping ban after a June 2023 positive test for clenbuterol (sanction confirmed January 2024).",
    caps: 46,
    tries: 2,
    points: 331,
    intlYearsLabel: "2012–2022",
    careerStatus: "released",
    statusOverride: "suspended",
    titles: [
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2011, sourceUrl: ELTON_WIKI },
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2019, sourceUrl: ELTON_WIKI },
      { titleType: "other", title: "Rugby Championship winner", year: 2019, sourceUrl: ELTON_WIKI },
    ],
  },
];

function seasonYear(line: SeasonLine): number {
  if (line.seasonYear != null) return line.seasonYear;
  const label = line.allRugbySeason.trim();
  const full = label.match(/^(\d{4})/);
  if (full) return Number(full[1]);
  const short = label.match(/^(\d{2})\s*[/\-]/);
  if (short) {
    const yy = Number(short[1]);
    return yy >= 50 ? 1900 + yy : 2000 + yy;
  }
  throw new Error(`Cannot parse year from ${label}`);
}

function sourceProvider(line: SeasonLine): string {
  if (line.source?.includes("wikipedia")) return "wikipedia";
  return SOURCE;
}

async function resolveCompetition(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
  if (!row) throw new Error(`Competition not found: ${slug}`);
  return row;
}

async function resolveTeam(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  if (!row) throw new Error(`Team not found: ${slug}`);
  return row;
}

async function resolveSeason(competitionId: string, year: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competitionId), eq(competitionSeasons.year, year)))
    .limit(1);
  return row ?? null;
}

async function upsertSouthAfricaStint(playerId: string, spec: PlayerUpdate) {
  const db = getDb();
  const existing = await db
    .select()
    .from(playerCareerStints)
    .where(and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "international")));
  await db.delete(playerCareerStints).where(
    and(
      eq(playerCareerStints.playerId, playerId),
      eq(playerCareerStints.careerType, "international"),
      eq(playerCareerStints.teamName, ""),
    ),
  );
  const sa = existing.find((row) => /^south africa$/i.test(row.teamName.trim()));
  const payload = {
    teamName: "South Africa",
    teamId: SOUTH_AFRICA_ID,
    yearsLabel: spec.intlYearsLabel,
    apps: spec.caps,
    tries: spec.tries,
    points: spec.points,
    sourceProvider: SOURCE,
    sourceUrl: spec.officialUrl,
    syncedAt: new Date(),
  };
  if (sa) {
    await db.update(playerCareerStints).set(payload).where(eq(playerCareerStints.id, sa.id));
    return;
  }
  await db.insert(playerCareerStints).values({
    playerId,
    careerType: "international",
    sortOrder: 0,
    ...payload,
  });
}

async function upsertTitles(playerId: string, spec: PlayerUpdate) {
  const db = getDb();
  const existing = await db.select().from(playerTitles).where(eq(playerTitles.playerId, playerId));
  for (const title of spec.titles) {
    const already = existing.some(
      (row) => row.title === title.title && row.year === title.year && row.titleType === title.titleType,
    );
    if (already) continue;
    await createPlayerTitle({
      playerId,
      titleType: title.titleType,
      title: title.title,
      year: title.year,
      seasonLabel: title.seasonLabel ?? null,
      sourceUrl: title.sourceUrl,
    });
  }
}

async function upsertSeasonLine(playerId: string, line: SeasonLine) {
  const db = getDb();
  const competition = await resolveCompetition(line.competitionSlug);
  const team = await resolveTeam(line.teamSlug);
  const year = seasonYear(line);
  const season = await resolveSeason(competition.id, year);
  if (!season) {
    console.warn(`  skip missing season ${line.competitionSlug} ${year} (${line.allRugbySeason})`);
    return;
  }

  const [existing] = await db
    .select()
    .from(playerSeasonStats)
    .where(
      and(
        eq(playerSeasonStats.playerId, playerId),
        eq(playerSeasonStats.seasonId, season.id),
        eq(playerSeasonStats.teamId, team.id),
      ),
    )
    .limit(1);

  const values = {
    appearances: line.appearances,
    tries: line.tries,
    points: line.points,
    minutesPlayed: line.minutes,
    competitionId: competition.id,
    sourceProvider: sourceProvider(line),
    syncedAt: new Date(),
  };

  if (existing) {
    await db.update(playerSeasonStats).set(values).where(eq(playerSeasonStats.id, existing.id));
    return;
  }
  await db.insert(playerSeasonStats).values({
    playerId,
    seasonId: season.id,
    teamId: team.id,
    ...values,
  });
}

async function upsertImage(playerId: string, spec: PlayerUpdate) {
  if (!spec.imageUrl) return;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.imageUrl, spec.imageUrl)))
    .limit(1);
  const imageId =
    existing?.id ??
    (
      await db
        .insert(playerImages)
        .values({
          playerId,
          imageUrl: spec.imageUrl,
          canonicalUrl: spec.imageUrl,
          sourceProvider: "wikimedia",
          sourcePageUrl: spec.wikipediaUrl,
          altText: spec.imageAlt ?? spec.name,
          caption: spec.imageAlt ?? spec.name,
          credit: "Wikimedia Commons",
          licence: "cc",
          imageType: "headshot",
          role: "gallery",
          confidence: "high",
          confidenceScore: 90,
          status: "candidate",
          isPublic: false,
          matchContext: {
            source: "wikimedia-commons",
            note: "Commons portrait matched to Wikipedia page image",
          },
        })
        .returning({ id: playerImages.id })
    )[0]!.id;
  await applyPlayerImageAction(playerId, imageId, "set_primary");
}

async function upsertTrc2019MatchRows(playerId: string, seasonKey: string) {
  const db = getDb();
  let written = 0;
  for (const match of TRC_2019_MATCHES.matches) {
    const row = match.players[seasonKey];
    if (!row) continue;
    const [fixture] = await db.select().from(fixtures).where(eq(fixtures.slug, match.fixtureSlug)).limit(1);
    if (!fixture) {
      console.warn(`  skip missing fixture ${match.fixtureSlug}`);
      continue;
    }

    const [existing] = await db
      .select({ id: fixturePlayers.id })
      .from(fixturePlayers)
      .where(and(eq(fixturePlayers.fixtureId, fixture.id), eq(fixturePlayers.playerId, playerId)))
      .limit(1);
    const squadValues = {
      teamId: SOUTH_AFRICA_ID,
      jerseyNumber: row.jerseyNumber,
      squadRole: row.squadRole,
      positionName: row.positionName,
      tries: row.tries,
      conversions: row.conversions,
      penalties: row.penalties,
      dropGoals: row.dropGoals ?? 0,
      points: row.points,
    };
    if (existing) {
      await db.update(fixturePlayers).set(squadValues).where(eq(fixturePlayers.id, existing.id));
    } else {
      await db.insert(fixturePlayers).values({
        fixtureId: fixture.id,
        playerId,
        ...squadValues,
      });
    }

    const [perf] = await db
      .select({ id: playerMatchPerformanceStats.id })
      .from(playerMatchPerformanceStats)
      .where(
        and(eq(playerMatchPerformanceStats.fixtureId, fixture.id), eq(playerMatchPerformanceStats.playerId, playerId)),
      )
      .limit(1);
    const perfValues = {
      teamId: SOUTH_AFRICA_ID,
      seasonId: fixture.seasonId,
      competitionId: fixture.competitionId,
      minutesPlayed: row.minutes,
      tries: row.tries,
      points: row.points,
      sourceProvider: "wikipedia",
      syncedAt: new Date(),
    };
    if (perf) {
      await db.update(playerMatchPerformanceStats).set(perfValues).where(eq(playerMatchPerformanceStats.id, perf.id));
    } else {
      await db.insert(playerMatchPerformanceStats).values({
        fixtureId: fixture.id,
        playerId,
        ...perfValues,
      });
    }
    written += 1;
  }
  console.log(`  2019 TRC match rows: ${written}`);
}

async function updateOneRecord(playerId: string, spec: PlayerUpdate) {
  if (process.env.SKIP_WIKI !== "1") {
    const wiki = await enrichPlayerFromWikipedia(playerId, spec.name, {
      fillMissingOnly: false,
      sourceUrl: spec.wikipediaUrl,
    });
    console.log(`  wikipedia: ${wiki.reason ?? "ok"} ${wiki.wikipediaUrl ?? ""}`);
  }

  const clubTeamId = spec.clubTeamSlug ? (await resolveTeam(spec.clubTeamSlug)).id : null;
  await updatePlayer(playerId, {
    name: spec.name,
    fullName: spec.fullName,
    birthDate: spec.birthDate,
    birthPlace: spec.birthPlace,
    heightCm: spec.heightCm,
    weightKg: spec.weightKg,
    clubName: spec.clubName,
    clubTeamId,
    university: spec.university ?? null,
    countryName: "South Africa",
    nationCode: "ZA",
    internationalTeamId: SOUTH_AFRICA_ID,
    positionName: spec.positionName,
    school: spec.school ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: spec.careerStatus,
    statusOverride: spec.statusOverride ?? null,
    preferredFoot: null,
    isPublic: true,
    publishStatus: "published",
    ...(spec.imageUrl ? { imageUrl: spec.imageUrl } : {}),
  });

  const db = getDb();
  await db
    .update(players)
    .set({
      name: spec.name,
      positions: spec.positions,
      wikipediaUrl: spec.wikipediaUrl,
      verifiedInternationalCaps: spec.caps,
      verifiedInternationalPoints: spec.points,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, playerId));

  await upsertSouthAfricaStint(playerId, spec);
  await upsertTitles(playerId, spec);
  if (spec.imageUrl) await upsertImage(playerId, spec);
  const lines = SEASON_LINES[spec.seasonKey];
  if (!lines?.length) throw new Error(`No season lines for ${spec.seasonKey}`);
  let written = 0;
  for (const line of lines) {
    await upsertSeasonLine(playerId, line);
    written += 1;
  }
  console.log(`  season lines processed: ${written}`);
  await upsertTrc2019MatchRows(playerId, spec.seasonKey);
}

async function main() {
  for (const spec of PLAYERS) {
    console.log(`\n== ${spec.name} ==`);
    for (const id of spec.ids) {
      console.log(`  record ${id}`);
      await updateOneRecord(id, spec);
    }
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
