/**
 * Research-backed profile + season-stat updates for Morné Steyn, François Steyn,
 * Zane Kirchner and Francois Louw.
 *
 * 2012 Rugby Championship: Wikipedia match sheets cross-checked with bokhist.com
 * (appearances were 0 in the DB despite correct try/point totals).
 * Club/Test lines 2013–2023: All.Rugby overall tables. Caps: Wikipedia / SA Rugby /
 * bokhist (All.Rugby Test totals are incomplete for these careers).
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-steyn-kirchner-louw.ts
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
  readFileSync(join(here, "springboks-steyn-kirchner-louw-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;
const TRC_2012_MATCHES = JSON.parse(
  readFileSync(join(here, "springboks-steyn-kirchner-louw-2012-trc-matches.json"), "utf8"),
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
  morne: "https://en.wikipedia.org/wiki/Morn%C3%A9_Steyn",
  francoisSteyn: "https://en.wikipedia.org/wiki/Fran%C3%A7ois_Steyn",
  kirchner: "https://en.wikipedia.org/wiki/Zane_Kirchner",
  louw: "https://en.wikipedia.org/wiki/Francois_Louw",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["0fdeacc9-96c5-43a4-86d9-8c88abf01b65", "4e691c01-0d0e-4ce5-80d1-0a38dbbfa5d8"],
    seasonKey: "morne-steyn",
    name: "Morné Steyn",
    fullName: "Morné Steyn",
    wikipediaUrl: WIKI.morne,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=738",
    birthDate: "1984-07-11",
    birthPlace: "Cape Town, South Africa",
    heightCm: 184,
    weightKg: 91,
    clubName: "",
    clubTeamSlug: null,
    positionName: "fly-half",
    positions: ["fly-half", "fullback"],
    school: "Hoërskool Sand du Plessis",
    bioSummary:
      "Former Springbok fly-half who retired in 2023 after a second spell with the Bulls. Won Super Rugby with the Bulls (2007, 2009, 2010), three Currie Cups, Top 14 with Stade Français, Super Rugby Unlocked, the 2009 Tri-Nations, and both the 2009 and 2021 British & Irish Lions series as a host-nation player. Top points scorer at the 2011 Rugby World Cup. 68 Tests and 742 points (Wikipedia). In the inaugural 2012 Rugby Championship he started the first four Tests (34 points) and was not selected for the last two.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/27/Morn%C3%A9_Steyn.jpg",
    imageAlt: "Morné Steyn",
    caps: 68,
    tries: 8,
    points: 742,
    intlYearsLabel: "2009–2021",
    careerStatus: "retired",
    titles: [
      { titleType: "other", title: "Super Rugby champion", year: 2007, sourceUrl: WIKI.morne },
      { titleType: "other", title: "Super Rugby champion", year: 2009, sourceUrl: WIKI.morne },
      { titleType: "other", title: "Super Rugby champion", year: 2010, sourceUrl: WIKI.morne },
      { titleType: "other", title: "Tri-Nations champion", year: 2009, sourceUrl: WIKI.morne },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.morne },
      { titleType: "other", title: "Top 14 champion", year: 2015, seasonLabel: "2014–15", sourceUrl: WIKI.morne },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.morne },
    ],
  },
  {
    ids: ["fef80bd0-edc7-4235-bcfd-ae96bd0728f1", "cae05128-153f-4f99-8a6a-b66710e19ebe"],
    seasonKey: "francois-steyn",
    name: "François Steyn",
    fullName: "François Philippus Lodewyk Steyn",
    wikipediaUrl: WIKI.francoisSteyn,
    officialUrl: "https://www.springboks.rugby/",
    birthDate: "1987-05-14",
    birthPlace: "Aliwal North, South Africa",
    heightCm: 191,
    weightKg: 110,
    clubName: "",
    clubTeamSlug: null,
    positionName: "centre",
    positions: ["centre", "fly-half", "fullback", "wing"],
    school: "Grey College",
    bioSummary:
      "Former Springbok utility back (Springbok #783), now head coach of the Free State Cheetahs. Two-time Rugby World Cup winner (2007, 2019) and the youngest player to win a World Cup. Retired in July 2023. SA Rugby recorded 78 Tests, 11 tries and 165 points; Wikipedia lists 168 points. In the 2012 Rugby Championship he started the first four Tests (one try, two penalties — 11 points) and missed the last two.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cc/Steyn_2016_%28cropped%29.JPG",
    imageAlt: "François Steyn in 2016",
    caps: 78,
    tries: 11,
    points: 165,
    intlYearsLabel: "2006–2022",
    careerStatus: "retired",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2007, sourceUrl: WIKI.francoisSteyn },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2008, sourceUrl: WIKI.francoisSteyn },
      { titleType: "other", title: "Tri-Nations champion", year: 2009, sourceUrl: WIKI.francoisSteyn },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.francoisSteyn },
      { titleType: "other", title: "European Challenge Cup champion", year: 2016, seasonLabel: "2015–16", sourceUrl: WIKI.francoisSteyn },
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2019, sourceUrl: WIKI.francoisSteyn },
      { titleType: "other", title: "The Rugby Championship champion", year: 2019, sourceUrl: WIKI.francoisSteyn },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2023, sourceUrl: WIKI.francoisSteyn },
    ],
  },
  {
    ids: ["df4136e5-6b31-42d0-b8c1-f5d44a8c2031", "7bc96dc2-1416-4cb4-97e3-becc612f958b"],
    seasonKey: "zane-kirchner",
    name: "Zane Kirchner",
    fullName: "Zane Kirchner",
    wikipediaUrl: WIKI.kirchner,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=746",
    birthDate: "1984-06-16",
    birthPlace: "George, Western Cape, South Africa",
    heightCm: 184,
    weightKg: 92,
    clubName: "",
    clubTeamSlug: null,
    positionName: "fullback",
    positions: ["fullback", "wing", "centre", "fly-half"],
    school: "PW Botha College, George",
    bioSummary:
      "Retired Springbok fullback (Springbok #804) who played for Griquas, the Blue Bulls/Bulls, Leinster, the Dragons and briefly Bristol. 31 Tests and 25 points (Wikipedia infobox; bokhist 31 Tests). Super Rugby champion in 2009 and 2010, Currie Cup 2009, Pro12 champion with Leinster in 2013–14. In the 2012 Rugby Championship he started all six Tests, scoring tries against Argentina in Cape Town and Australia in Pretoria.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fe/Zane_Kirchner_%28cropped%29.jpg",
    imageAlt: "Zane Kirchner",
    caps: 31,
    tries: 5,
    points: 25,
    intlYearsLabel: "2009–2015",
    careerStatus: "retired",
    titles: [
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2009, sourceUrl: WIKI.kirchner },
      { titleType: "other", title: "Super Rugby champion", year: 2009, sourceUrl: WIKI.kirchner },
      { titleType: "other", title: "Super Rugby champion", year: 2010, sourceUrl: WIKI.kirchner },
      { titleType: "other", title: "Pro12 champion", year: 2014, seasonLabel: "2013–14", sourceUrl: WIKI.kirchner },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.kirchner },
    ],
  },
  {
    ids: ["1013ad45-d939-4a70-aafd-1218e36997f2", "83b35d9f-34cd-42cd-9454-fb32f2887320"],
    seasonKey: "francois-louw",
    name: "Francois Louw",
    fullName: "Francois Louw",
    wikipediaUrl: WIKI.louw,
    officialUrl: "https://www.springboks.rugby/",
    birthDate: "1985-06-15",
    birthPlace: "Cape Town, South Africa",
    heightCm: 190,
    weightKg: 110,
    clubName: "",
    clubTeamSlug: null,
    positionName: "flanker",
    positions: ["flanker", "number eight"],
    school: "Bishops College, Cape Town",
    bioSummary:
      "Former Springbok openside flanker who played for Western Province, the Stormers and Bath. 76 Tests, 10 tries and 50 points (Wikipedia, as of 23 November 2025). Rugby World Cup winner in 2019 and a 2015 World Cup squad member. In the 2012 Rugby Championship he was an unused squad member for the two Argentina Tests, came on against Australia in Perth, then started the last three Tests and scored against Australia in Pretoria.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Francois_Louw.jpg",
    imageAlt: "Francois Louw",
    caps: 76,
    tries: 10,
    points: 50,
    intlYearsLabel: "2010–2019",
    careerStatus: "retired",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.louw },
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2019, sourceUrl: WIKI.louw },
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
            note: "springboks.rugby player-page CDN not used; Commons portrait matched to Wikipedia pageimage",
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
    sourceProvider: line.allRugbySeason === "2012" ? "wikipedia" : SOURCE,
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

async function upsertTrc2012MatchRows(playerId: string, seasonKey: string) {
  const db = getDb();
  let written = 0;
  for (const match of TRC_2012_MATCHES.matches) {
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
  console.log(`  2012 TRC match rows: ${written}`);
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
  await upsertTrc2012MatchRows(playerId, spec.seasonKey);
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
