/**
 * Research-backed profile + season-stat updates for Jordan Hendrikse and
 * Steven Kitshoff.
 *
 * 2022 Rugby Championship: Wikipedia rugbyboxes / All.Rugby / bokhist.
 * Kitshoff played all six Tests (three bench, three starts, 0 tries, 320 minutes).
 * Hendrikse did not play — Springbok debut was 22 Jun 2024 vs Wales (bokhist #934).
 * Wikipedia 2022 rugbyboxes name Jaden Hendrikse, not Jordan.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-hendrikse-kitshoff-2022.ts
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
const JORDAN_WIKI = "https://en.wikipedia.org/wiki/Jordan_Hendrikse";
const KITSHOFF_WIKI = "https://en.wikipedia.org/wiki/Steven_Kitshoff";
const JORDAN_IMAGE =
  "https://mobiithumbnails.blob.core.windows.net/thumbnails/live/stratus/c6a65afb-0d31-4e24-a675-46cac6c2b23a/large.png";

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "springboks-hendrikse-kitshoff-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;
const TRC_2022_MATCHES = JSON.parse(
  readFileSync(join(here, "springboks-hendrikse-kitshoff-2022-trc-matches.json"), "utf8"),
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
  imageSource?: "wikimedia" | "existing";
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
      "4490d5a0-707f-47bc-a6ee-32970a478511",
      "05a8d8c5-25f3-4478-a0ec-b55b4b607d40",
      "80258213-2ec3-424c-9dd0-245444772e31",
    ],
    seasonKey: "jordan-hendrikse",
    name: "Jordan Hendrikse",
    fullName: "Jordan Hendrikse",
    wikipediaUrl: JORDAN_WIKI,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=909",
    birthDate: "2001-06-28",
    birthPlace: "King William's Town (Qonce), South Africa",
    heightCm: 188,
    weightKg: 93,
    clubName: "Sharks",
    clubTeamSlug: "natal-sharks",
    positionName: "fly-half",
    positions: ["fly-half", "fullback"],
    school: "Glenwood High School",
    bioSummary:
      "Springbok fly-half (Springbok #934) who has played for the Lions and the Sharks. Brother of scrum-half Jaden Hendrikse. 2 Tests, 1 try and 22 points (bokhist / All.Rugby): debut vs Wales at Twickenham on 22 June 2024 (7 points), then a try and five conversions vs Wales in Cardiff on 23 November 2024. Did not play in the 2022 Rugby Championship. Currie Cup winner with the Sharks in 2024 (last-minute 59-metre penalty in the final). Height/weight 188 cm / 93 kg (All.Rugby); bokhist’s 72 kg listing is not used.",
    caps: 2,
    tries: 1,
    points: 22,
    intlYearsLabel: "2024",
    careerStatus: "active",
    statusOverride: null,
    imageUrl: JORDAN_IMAGE,
    imageAlt: "Jordan Hendrikse",
    imageSource: "existing",
    titles: [
      {
        titleType: "currie_cup",
        title: "Currie Cup champion",
        year: 2024,
        sourceUrl: JORDAN_WIKI,
      },
    ],
  },
  {
    ids: [
      "0b05fcb1-aa63-44ef-84cb-5172f2347c0e",
      "4d853746-b7cc-4c32-a70a-36142f341026",
      "c39307f0-663c-48b8-abd2-927fd386e0df",
    ],
    seasonKey: "steven-kitshoff",
    name: "Steven Kitshoff",
    fullName: "Steven Kitshoff",
    wikipediaUrl: KITSHOFF_WIKI,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=425",
    birthDate: "1992-02-10",
    birthPlace: "Somerset West, South Africa",
    heightCm: 183,
    weightKg: 120,
    clubName: "",
    clubTeamSlug: null,
    positionName: "loosehead prop",
    positions: ["loosehead prop"],
    school: "Paul Roos Gymnasium",
    bioSummary:
      "Former Springbok loosehead prop (Springbok #873) who played for Western Province, the Stormers, Bordeaux-Bègles and Ulster. 83 Tests, 2 tries and 10 points (bokhist / Wikipedia). Rugby World Cup winner in 2019 and 2023 (started both finals). United Rugby Championship winner with the Stormers in 2022 and Currie Cup winner with Western Province in 2012. In the 2022 Rugby Championship he played all six Tests — three from the bench, then three starts — for 0 tries, 0 points and 320 minutes. Retired in February 2025 after a career-ending neck injury sustained in the 2024 Currie Cup.",
    caps: 83,
    tries: 2,
    points: 10,
    intlYearsLabel: "2016–2023",
    careerStatus: "retired",
    statusOverride: null,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Steven_Kitshoff_LQ_2022.jpg",
    imageAlt: "Steven Kitshoff, 2022",
    imageSource: "wikimedia",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2019, sourceUrl: KITSHOFF_WIKI },
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2023, sourceUrl: KITSHOFF_WIKI },
      { titleType: "urc", title: "United Rugby Championship winner", year: 2022, sourceUrl: KITSHOFF_WIKI },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2012, sourceUrl: KITSHOFF_WIKI },
      { titleType: "other", title: "Rugby Championship winner", year: 2019, sourceUrl: KITSHOFF_WIKI },
      {
        titleType: "other",
        title: "British & Irish Lions series winner",
        year: 2021,
        sourceUrl: "https://stormers.co.za/kitshoff-forced-to-call-time-on-illustrious-career/",
      },
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

async function clearUnplayedTrc2024(playerId: string, seasonKey: string) {
  if (seasonKey !== "jordan-hendrikse") return;
  const competition = await resolveCompetition("rugby-championship");
  const season = await resolveSeason(competition.id, 2024);
  if (!season) return;
  const db = getDb();
  const updated = await db
    .update(playerSeasonStats)
    .set({
      appearances: 0,
      tries: 0,
      points: 0,
      minutesPlayed: 0,
      sourceProvider: "wikipedia",
      syncedAt: new Date(),
    })
    .where(
      and(
        eq(playerSeasonStats.playerId, playerId),
        eq(playerSeasonStats.seasonId, season.id),
        eq(playerSeasonStats.teamId, SOUTH_AFRICA_ID),
      ),
    )
    .returning({ id: playerSeasonStats.id });
  if (updated.length) {
    console.log(`  cleared unverified 2024 Rugby Championship SDMS row (${updated.length})`);
  }
}

async function upsertImage(playerId: string, spec: PlayerUpdate) {
  if (!spec.imageUrl || spec.imageSource === "existing") return;
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

async function upsertTrc2022MatchRows(playerId: string, seasonKey: string) {
  const db = getDb();
  let written = 0;
  for (const match of TRC_2022_MATCHES.matches) {
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
  console.log(`  2022 TRC match rows: ${written}`);
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
  await upsertImage(playerId, spec);
  const lines = SEASON_LINES[spec.seasonKey];
  if (!lines?.length) throw new Error(`No season lines for ${spec.seasonKey}`);
  let written = 0;
  for (const line of lines) {
    await upsertSeasonLine(playerId, line);
    written += 1;
  }
  console.log(`  season lines processed: ${written}`);
  await clearUnplayedTrc2024(playerId, spec.seasonKey);
  await upsertTrc2022MatchRows(playerId, spec.seasonKey);
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
