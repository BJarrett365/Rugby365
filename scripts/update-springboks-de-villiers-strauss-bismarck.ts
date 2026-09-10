/**
 * Research-backed profile + season-stat updates for Jean de Villiers,
 * Adriaan Strauss and Bismarck du Plessis.
 *
 * 2013 Rugby Championship: Wikipedia match sheets (appearances were 0 in the DB
 * despite correct try/point totals). All three took the field in all six Tests.
 * Club/Test lines 2013–2023: All.Rugby overall tables. Caps: Wikipedia / bokhist.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-de-villiers-strauss-bismarck.ts
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

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "springboks-de-villiers-strauss-bismarck-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;
const TRC_2013_MATCHES = JSON.parse(
  readFileSync(join(here, "springboks-de-villiers-strauss-bismarck-2013-trc-matches.json"), "utf8"),
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
  bioSummary: string;
  imageUrl: string;
  imageAlt: string;
  caps: number;
  tries: number;
  points: number;
  intlYearsLabel: string;
  careerStatus: "active" | "released" | "retired";
  statusOverride?: string | null;
  titles: Array<{
    titleType: string;
    title: string;
    year: number;
    seasonLabel?: string;
    sourceUrl: string;
  }>;
};

const WIKI = {
  jean: "https://en.wikipedia.org/wiki/Jean_de_Villiers",
  strauss: "https://en.wikipedia.org/wiki/Adriaan_Strauss",
  bismarck: "https://en.wikipedia.org/wiki/Bismarck_du_Plessis",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: [
      "0a68777b-b4fc-4998-87d1-33e1ec71d406",
      "149553a2-80dc-405a-bd60-456853211065",
      "3b4743b3-b0d5-4c69-90a0-9e7546620172",
    ],
    seasonKey: "jean-de-villiers",
    name: "Jean de Villiers",
    fullName: "Jean de Villiers",
    wikipediaUrl: WIKI.jean,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=676",
    birthDate: "1981-02-24",
    birthPlace: "Paarl, South Africa",
    heightCm: 190,
    weightKg: 103,
    clubName: "",
    clubTeamSlug: null,
    positionName: "centre",
    positions: ["centre", "wing"],
    school: "Paarl Gimnasium",
    bioSummary:
      "Former Springbok captain and inside centre (Springbok #735) who played for Western Province, the Stormers, Munster and Leicester Tigers. 109 Tests, 27 tries and 135 points (Wikipedia infobox / bokhist). Captained South Africa 37 times. Rugby World Cup winner in 2007 (injured after the opening match) and a 2011 and 2015 World Cup squad member; retired from Tests after a fractured jaw against Samoa at the 2015 World Cup, then played two Premiership matches for Leicester before retiring in 2016. In the 2013 Rugby Championship he started all six Tests as captain and scored three tries (15 points).",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/26/Jean_de_Villiers_2012_Springboks.jpg",
    imageAlt: "Jean de Villiers with South Africa in 2012",
    caps: 109,
    tries: 27,
    points: 135,
    intlYearsLabel: "2002–2015",
    careerStatus: "retired",
    titles: [
      { titleType: "other", title: "Tri-Nations champion", year: 2004, sourceUrl: WIKI.jean },
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2007, sourceUrl: WIKI.jean },
      { titleType: "other", title: "Tri-Nations champion", year: 2009, sourceUrl: WIKI.jean },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.jean },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.jean },
    ],
  },
  {
    ids: ["0057aad5-965e-4aa5-9a24-ecfef8c2ecfb", "d593a625-5873-470c-b02e-8281917e5aa8"],
    seasonKey: "adriaan-strauss",
    name: "Adriaan Strauss",
    fullName: "Jan Adriaan Strauss",
    wikipediaUrl: WIKI.strauss,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=742",
    birthDate: "1985-11-18",
    birthPlace: "Bloemfontein, South Africa",
    heightCm: 185,
    weightKg: 113,
    clubName: "",
    clubTeamSlug: null,
    positionName: "hooker",
    positions: ["hooker"],
    school: "Grey College, Bloemfontein",
    bioSummary:
      "Former Springbok hooker and 2016 captain (56th Springbok captain) who played for the Blue Bulls, Cheetahs, Free State Cheetahs and Bulls. 66 Tests and 6 tries / 30 points (Wikipedia infobox; bokhist 66 Tests, 6 tries). Currie Cup winner with the Cheetahs in 2006. Played at the 2015 Rugby World Cup. Retired from Tests in November 2016 and from all rugby after the 2018 Super Rugby season. In the 2013 Rugby Championship he played all six Tests (three starts, three from the bench) and scored two tries.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/27/Adriaan_Strauss_2011.jpg",
    imageAlt: "Adriaan Strauss in 2011",
    caps: 66,
    tries: 6,
    points: 30,
    intlYearsLabel: "2008–2016",
    careerStatus: "retired",
    titles: [
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2006, sourceUrl: WIKI.strauss },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.strauss },
    ],
  },
  {
    ids: ["6e23a4f5-0d26-4feb-b07b-f68e2abe98d1", "a4c9751d-a493-4af7-b819-f64574563ca2"],
    seasonKey: "bismarck-du-plessis",
    name: "Bismarck du Plessis",
    fullName: "Bismarck Wilhelm du Plessis",
    wikipediaUrl: WIKI.bismarck,
    officialUrl: "https://en.wikipedia.org/wiki/Bismarck_du_Plessis",
    birthDate: "1984-05-22",
    birthPlace: "Bethlehem, South Africa",
    heightCm: 188,
    weightKg: 114,
    clubName: "",
    clubTeamSlug: null,
    positionName: "hooker",
    positions: ["hooker"],
    school: "Grey College, Bloemfontein",
    bioSummary:
      "Former Springbok hooker (brother of Jannie du Plessis) who played for the Free State Cheetahs, Sharks, Montpellier and the Bulls. 79 Tests, 11 tries and 55 points (Wikipedia infobox). Rugby World Cup winner in 2007 and a 2011 and 2015 World Cup squad member. European Challenge Cup winner with Montpellier in 2016 and 2021. Retired in 2023. In the 2013 Rugby Championship he played all six Tests (three starts, three from the bench), scored two tries, and was sent off at Eden Park after a second yellow card (later struck from his record by World Rugby).",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c2/Bismarck_du_Plessis.jpg",
    imageAlt: "Bismarck du Plessis",
    caps: 79,
    tries: 11,
    points: 55,
    intlYearsLabel: "2007–2015",
    careerStatus: "retired",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2007, sourceUrl: WIKI.bismarck },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.bismarck },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.bismarck },
      {
        titleType: "other",
        title: "European Challenge Cup champion",
        year: 2016,
        seasonLabel: "2015–16",
        sourceUrl: WIKI.bismarck,
      },
      {
        titleType: "other",
        title: "European Challenge Cup champion",
        year: 2021,
        seasonLabel: "2020–21",
        sourceUrl: WIKI.bismarck,
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

async function upsertImage(playerId: string, spec: PlayerUpdate) {
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
          altText: spec.imageAlt,
          caption: spec.imageAlt,
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
            note: "Commons portrait matched to Wikipedia pageimage",
          },
        })
        .returning({ id: playerImages.id })
    )[0]!.id;
  await applyPlayerImageAction(playerId, imageId, "set_primary");
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

async function upsertTrc2013MatchRows(playerId: string, seasonKey: string) {
  const db = getDb();
  let written = 0;
  for (const match of TRC_2013_MATCHES.matches) {
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
      dropGoals: 0,
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
  console.log(`  2013 TRC match rows: ${written}`);
}

async function updateOneRecord(playerId: string, spec: PlayerUpdate) {
  if (process.env.SKIP_WIKI !== "1") {
    const wiki = await enrichPlayerFromWikipedia(playerId, spec.name, {
      fillMissingOnly: false,
      sourceUrl: spec.wikipediaUrl,
    });
    console.log(`  wikipedia: ${wiki.reason ?? "ok"} ${wiki.wikipediaUrl ?? ""}`);
  }

  await updatePlayer(playerId, {
    name: spec.name,
    fullName: spec.fullName,
    birthDate: spec.birthDate,
    birthPlace: spec.birthPlace,
    heightCm: spec.heightCm,
    weightKg: spec.weightKg,
    clubName: spec.clubName,
    clubTeamId: null,
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
    imageUrl: spec.imageUrl,
  });

  const db = getDb();
  await db
    .update(players)
    .set({
      name: spec.name,
      positions: spec.positions,
      wikipediaUrl: spec.wikipediaUrl,
      verifiedInternationalCaps: spec.caps,
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
  await upsertTrc2013MatchRows(playerId, spec.seasonKey);
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
