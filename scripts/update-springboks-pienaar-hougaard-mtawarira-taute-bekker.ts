/**
 * Research-backed profile + season-stat updates for five Springboks who appear
 * as empty stubs on Rugby Championship 2012 rankings:
 * Ruan Pienaar, Francois Hougaard, Tendai Mtawarira, Jaco Taute, Andries Bekker.
 *
 * Merges duplicate player rows onto the public rankings slugs, then writes
 * sourced CMS fields, Wikipedia career stints, All.Rugby club season lines
 * (2012–2024 where published), and verified Rugby Championship totals.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-pienaar-hougaard-mtawarira-taute-bekker.ts
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-pienaar-hougaard-mtawarira-taute-bekker.ts
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
import { mergePlayerRecords } from "../apps/web/src/lib/entity-dedup-service";
import { applyPlayerImageAction } from "../apps/web/src/lib/player-image-service";
import { createPlayerTitle } from "../apps/web/src/lib/player-titles-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import {
  fetchCommonsPortraitForPerson,
  fetchWikipediaOriginalImages,
} from "../apps/web/src/lib/wikipedia-page-image";
import { TRC_2012_SPRINGBOK_RANKINGS_PLAYERS } from "../apps/web/src/lib/trc-2012-springboks-rankings-players";

const SOUTH_AFRICA_ID = "b0000000-0000-4000-8000-000000000001";
const SOURCE = "all_rugby";

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "springboks-pienaar-hougaard-mtawarira-taute-bekker-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;
const TRC_2012_MATCHES = JSON.parse(
  readFileSync(join(here, "springboks-pienaar-hougaard-mtawarira-taute-bekker-2012-trc-matches.json"), "utf8"),
) as {
  matches: Array<{
    fixtureSlug: string;
    players: Record<
      string,
      {
        squadRole: "starting" | "substitute";
        jerseyNumber: number;
        positionName: string;
        minutes: number;
        tries: number;
        conversions: number;
        penalties: number;
        points: number;
        clubName?: string;
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
  note?: string;
};

type ClubStint = {
  teamName: string;
  teamSlug?: string;
  yearsLabel: string;
  startYear: number;
  endYear: number | null;
  apps: number | null;
  tries?: number | null;
  points: number | null;
};

type PlayerUpdate = {
  seasonKey: keyof typeof TRC_2012_SPRINGBOK_RANKINGS_PLAYERS;
  wikipediaTitle: string;
  officialUrl: string;
  bioSummary: string;
  imageUrl: string | null;
  imageAlt: string;
  clubStints: ClubStint[];
  titles: Array<{
    titleType: string;
    title: string;
    year: number;
    seasonLabel?: string;
    sourceUrl: string;
  }>;
};

const WIKI = {
  pienaar: "https://en.wikipedia.org/wiki/Ruan_Pienaar",
  hougaard: "https://en.wikipedia.org/wiki/Francois_Hougaard",
  mtawarira: "https://en.wikipedia.org/wiki/Tendai_Mtawarira",
  taute: "https://en.wikipedia.org/wiki/Jaco_Taute",
  bekker: "https://en.wikipedia.org/wiki/Andries_Bekker",
};

const PLAYERS: PlayerUpdate[] = [
  {
    seasonKey: "ruan-pienaar",
    wikipediaTitle: "Ruan Pienaar",
    officialUrl: "https://en.wikipedia.org/wiki/Ruan_Pienaar",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Ruan_Pienaar_2014.jpg",
    imageAlt: "Ruan Pienaar in 2014",
    bioSummary:
      "Retired South African scrum-half/fly-half who played 88 Tests and scored 135 points (Wikipedia infobox). Rugby World Cup winner with the 2007 squad, and a 2011 and 2015 World Cup player. Club career with the Sharks, Ulster, Montpellier and the Cheetahs; Currie Cup winner in 2008, 2019 and 2023. In the inaugural 2012 Rugby Championship he played all six Tests (four starts, two from the bench) and kicked three conversions against Australia in Pretoria.",
    clubStints: [
      { teamName: "Sharks (Currie Cup)", teamSlug: "natal-sharks", yearsLabel: "2004–2010", startYear: 2004, endYear: 2010, apps: 32, points: 261 },
      { teamName: "Sharks", teamSlug: "natal-sharks", yearsLabel: "2005–2010", startYear: 2005, endYear: 2010, apps: 67, points: 240 },
      { teamName: "Ulster", teamSlug: "ulster-vx917e9w", yearsLabel: "2010–2017", startYear: 2010, endYear: 2017, apps: 141, points: 877 },
      { teamName: "Montpellier", teamSlug: "montpellier-g56ey3j7", yearsLabel: "2017–2019", startYear: 2017, endYear: 2019, apps: 28, points: 161 },
      { teamName: "Free State Cheetahs", teamSlug: "free-state-cheetahs", yearsLabel: "2019–2024", startYear: 2019, endYear: 2024, apps: 27, points: 241 },
      { teamName: "Cheetahs", teamSlug: "free-state-cheetahs", yearsLabel: "2020–2024", startYear: 2020, endYear: 2024, apps: 15, points: 91 },
    ],
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2007, sourceUrl: WIKI.pienaar },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2008, sourceUrl: WIKI.pienaar },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.pienaar },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.pienaar },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2019, sourceUrl: WIKI.pienaar },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2023, sourceUrl: WIKI.pienaar },
    ],
  },
  {
    seasonKey: "francois-hougaard",
    wikipediaTitle: "Francois Hougaard",
    officialUrl: "https://en.wikipedia.org/wiki/Francois_Hougaard",
    imageUrl: null,
    imageAlt: "Francois Hougaard",
    bioSummary:
      "South African scrum-half and wing with 46 Tests, five tries and 25 points (Wikipedia infobox, updated 19 September 2017). Super Rugby champion with the Bulls in 2010, Currie Cup winner in 2009, 2011 Rugby World Cup player, and Olympic sevens bronze medallist at Rio 2016. Later played for Worcester Warriors, Wasps and Saracens. In the 2012 Rugby Championship he started all six Tests (scrum-half then wing) without scoring.",
    clubStints: [
      { teamName: "Western Province", teamSlug: "western-province", yearsLabel: "2007", startYear: 2007, endYear: 2007, apps: 3, points: 0 },
      { teamName: "Bulls", teamSlug: "blue-bulls", yearsLabel: "2008–2015", startYear: 2008, endYear: 2015, apps: 88, points: 130 },
      { teamName: "Blue Bulls", teamSlug: "blue-bulls", yearsLabel: "2008–2015", startYear: 2008, endYear: 2015, apps: 48, points: 80 },
      { teamName: "Worcester Warriors", teamSlug: "worcester-warriors", yearsLabel: "2016–2021", startYear: 2016, endYear: 2021, apps: 92, points: 95 },
      { teamName: "Wasps", teamSlug: "wasps", yearsLabel: "2021–2022", startYear: 2021, endYear: 2022, apps: 14, points: 15 },
      { teamName: "Saracens", teamSlug: "saracens-zv9039e5", yearsLabel: "2023", startYear: 2023, endYear: null, apps: 1, points: 5 },
    ],
    titles: [
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2009, sourceUrl: WIKI.hougaard },
      { titleType: "other", title: "Super Rugby champion", year: 2010, sourceUrl: WIKI.hougaard },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.hougaard },
      { titleType: "other", title: "Olympic rugby sevens bronze", year: 2016, sourceUrl: WIKI.hougaard },
    ],
  },
  {
    seasonKey: "tendai-mtawarira",
    wikipediaTitle: "Tendai Mtawarira",
    officialUrl: "https://en.wikipedia.org/wiki/Tendai_Mtawarira",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Tendai_Mtawarira.jpg",
    imageAlt: "Tendai Mtawarira in 2008",
    bioSummary:
      "Retired Springbok loosehead prop, born in Harare, with 117 Tests, two tries and 10 points (Wikipedia infobox). Rugby World Cup winner in 2019 and a 2011 and 2015 World Cup player. Spent his Super Rugby career with the Sharks (159 appearances in the Wikipedia infobox) and finished with Old Glory DC in Major League Rugby. In the 2012 Rugby Championship he started all six Tests.",
    clubStints: [
      { teamName: "Natal Sharks", teamSlug: "natal-sharks", yearsLabel: "2006–2013", startYear: 2006, endYear: 2013, apps: 37, points: 15 },
      { teamName: "Sharks", teamSlug: "natal-sharks", yearsLabel: "2007–2019", startYear: 2007, endYear: 2019, apps: 159, points: 30 },
      { teamName: "Old Glory DC", teamSlug: "old-glory-dc", yearsLabel: "2020", startYear: 2020, endYear: 2020, apps: 2, points: 0 },
    ],
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.mtawarira },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.mtawarira },
      { titleType: "world_cup", title: "Rugby World Cup winner", year: 2019, sourceUrl: WIKI.mtawarira },
    ],
  },
  {
    seasonKey: "jaco-taute",
    wikipediaTitle: "Jaco Taute",
    officialUrl: "https://en.wikipedia.org/wiki/Jaco_Taute",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Jaco_Taute_2017.jpg",
    imageAlt: "Jaco Taute at the Guinness Pro12 in 2016–17",
    bioSummary:
      "Retired South African centre/fullback (Jacob Johannes Taute) with three Springbok caps and no Test points (Wikipedia infobox). Played Super Rugby for the Lions and Stormers, then Munster and Leicester Tigers. In the 2012 Rugby Championship he started only the last two Tests, after Morné Steyn’s injury, and did not score.",
    clubStints: [
      { teamName: "Golden Lions", teamSlug: "gauteng-lions", yearsLabel: "2009–2012", startYear: 2009, endYear: 2012, apps: 31, points: 68 },
      { teamName: "Lions", teamSlug: "gauteng-lions", yearsLabel: "2010–2012", startYear: 2010, endYear: 2012, apps: 31, points: 51 },
      { teamName: "Stormers", teamSlug: "western-province", yearsLabel: "2013–2016", startYear: 2013, endYear: 2016, apps: 23, points: 8 },
      { teamName: "Western Province", teamSlug: "western-province", yearsLabel: "2014–2016", startYear: 2014, endYear: 2016, apps: 23, points: 35 },
      { teamName: "Munster", teamSlug: "munster-m46vomjz", yearsLabel: "2016–2019", startYear: 2016, endYear: 2019, apps: 40, points: 40 },
      { teamName: "Leicester Tigers", teamSlug: "leicester-tigers-g567e9er", yearsLabel: "2019–2022", startYear: 2019, endYear: 2022, apps: 19, points: 0 },
    ],
    titles: [],
  },
  {
    seasonKey: "andries-bekker",
    wikipediaTitle: "Andries Bekker",
    officialUrl: "https://www.sarugby.co.za/",
    imageUrl: null,
    imageAlt: "Andries Bekker",
    bioSummary:
      "Retired Springbok lock (2.08 m) with 29 Tests, one try and five points (Wikipedia infobox / SA Rugby player profile). Super Rugby career with the Stormers (104 appearances, 75 points) and later Kobelco Steelers in Japan, retiring in January 2018. In the 2012 Rugby Championship he played five Tests and was not selected in the Perth 23.",
    clubStints: [
      { teamName: "Western Province", teamSlug: "western-province", yearsLabel: "2004–2012", startYear: 2004, endYear: 2012, apps: 38, points: 60 },
      { teamName: "Stormers", teamSlug: "western-province", yearsLabel: "2005–2013", startYear: 2005, endYear: 2013, apps: 104, points: 75 },
      { teamName: "Kobelco Steelers", teamSlug: "kobelco-steelers", yearsLabel: "2013–2018", startYear: 2013, endYear: 2018, apps: 42, points: 70 },
    ],
    titles: [],
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

async function resolveCanonicalId(seasonKey: PlayerUpdate["seasonKey"]) {
  const catalog = TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[seasonKey];
  const db = getDb();
  const [canonical] = await db.select().from(players).where(eq(players.slug, catalog.canonicalSlug)).limit(1);
  if (!canonical) throw new Error(`Canonical player not found: ${catalog.canonicalSlug}`);

  const duplicateIds: string[] = [];
  for (const slug of catalog.duplicateSlugs) {
    const [dup] = await db.select({ id: players.id }).from(players).where(eq(players.slug, slug)).limit(1);
    if (dup) duplicateIds.push(dup.id);
  }
  if (duplicateIds.length) {
    await mergePlayerRecords(canonical.id, duplicateIds, { displayName: catalog.name });
    console.log(`  merged ${duplicateIds.length} duplicate(s) into ${catalog.canonicalSlug}`);
  }
  return canonical.id;
}

async function upsertSouthAfricaStint(playerId: string, spec: PlayerUpdate) {
  const catalog = TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[spec.seasonKey];
  const db = getDb();
  await db
    .delete(playerCareerStints)
    .where(and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "international")));
  await db.insert(playerCareerStints).values({
    playerId,
    careerType: "international",
    sortOrder: 0,
    teamName: "South Africa",
    teamId: SOUTH_AFRICA_ID,
    yearsLabel: catalog.intlYearsLabel,
    startYear: Number(catalog.intlYearsLabel.slice(0, 4)),
    endYear: catalog.intlYearsLabel.includes("–")
      ? Number(catalog.intlYearsLabel.split("–")[1] || catalog.intlYearsLabel.slice(0, 4))
      : Number(catalog.intlYearsLabel.slice(0, 4)),
    apps: catalog.caps,
    tries: catalog.tries,
    points: catalog.points,
    sourceProvider: "wikipedia",
    sourceUrl: catalog.wikipediaUrl,
    syncedAt: new Date(),
  });
}

async function upsertClubStints(playerId: string, spec: PlayerUpdate) {
  const db = getDb();
  await db
    .delete(playerCareerStints)
    .where(and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "club")));
  let sortOrder = 1;
  for (const stint of spec.clubStints) {
    const teamId = stint.teamSlug ? (await resolveTeam(stint.teamSlug)).id : null;
    await db.insert(playerCareerStints).values({
      playerId,
      careerType: "club",
      sortOrder,
      teamName: stint.teamName,
      teamId,
      yearsLabel: stint.yearsLabel,
      startYear: stint.startYear,
      endYear: stint.endYear,
      apps: stint.apps,
      tries: stint.tries ?? null,
      points: stint.points,
      sourceProvider: "wikipedia",
      sourceUrl: TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[spec.seasonKey].wikipediaUrl,
      syncedAt: new Date(),
    });
    sortOrder += 1;
  }
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

async function upsertImage(playerId: string, spec: PlayerUpdate, imageUrl: string | null) {
  if (!imageUrl) {
    console.log("  image: none verified");
    return;
  }
  const catalog = TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[spec.seasonKey];
  const db = getDb();
  const [existing] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.imageUrl, imageUrl)))
    .limit(1);
  const imageId =
    existing?.id ??
    (
      await db
        .insert(playerImages)
        .values({
          playerId,
          imageUrl,
          canonicalUrl: imageUrl,
          sourceProvider: "wikimedia",
          sourcePageUrl: catalog.wikipediaUrl,
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
            note: "Wikipedia page image for 2012 Rugby Championship rankings profile repair",
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
    sourceProvider: line.source?.startsWith("wikipedia") ? "wikipedia" : SOURCE,
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
      clubName: row.clubName ?? null,
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

async function resolveImageUrl(spec: PlayerUpdate): Promise<string | null> {
  if (spec.imageUrl) return spec.imageUrl;
  if (process.env.SKIP_WIKI === "1") return null;
  const originals = await fetchWikipediaOriginalImages([spec.wikipediaTitle]);
  const fromPage = originals.get(spec.wikipediaTitle) ?? null;
  if (fromPage) return fromPage.split("?")[0] ?? fromPage;
  return fetchCommonsPortraitForPerson(spec.wikipediaTitle);
}

async function updateOneRecord(playerId: string, spec: PlayerUpdate) {
  const catalog = TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[spec.seasonKey];
  if (process.env.SKIP_WIKI !== "1") {
    const wiki = await enrichPlayerFromWikipedia(playerId, catalog.name, {
      fillMissingOnly: false,
      sourceUrl: catalog.wikipediaUrl,
    });
    console.log(`  wikipedia: ${wiki.reason ?? "ok"} ${wiki.wikipediaUrl ?? ""}`);
  }

  const imageUrl = await resolveImageUrl(spec);

  await updatePlayer(playerId, {
    name: catalog.name,
    fullName: catalog.fullName,
    birthDate: catalog.birthDate,
    birthPlace: catalog.birthPlace,
    heightCm: catalog.heightCm,
    weightKg: catalog.weightKg,
    clubName: catalog.clubName,
    clubTeamId: null,
    university: catalog.university ?? null,
    countryName: "South Africa",
    nationCode: "ZA",
    internationalTeamId: SOUTH_AFRICA_ID,
    positionName: catalog.positionName,
    school: catalog.school ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: catalog.careerStatus,
    statusOverride: null,
    preferredFoot: null,
    isPublic: true,
    publishStatus: "published",
    imageUrl,
  });

  const db = getDb();
  await db
    .update(players)
    .set({
      name: catalog.name,
      positions: catalog.positions,
      wikipediaUrl: catalog.wikipediaUrl,
      verifiedInternationalCaps: catalog.caps,
      verifiedInternationalPoints: catalog.points,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, playerId));

  await upsertSouthAfricaStint(playerId, spec);
  await upsertClubStints(playerId, spec);
  await upsertTitles(playerId, spec);
  await upsertImage(playerId, spec, imageUrl);
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
    const catalog = TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[spec.seasonKey];
    console.log(`\n== ${catalog.name} ==`);
    const playerId = await resolveCanonicalId(spec.seasonKey);
    console.log(`  record ${playerId}`);
    await updateOneRecord(playerId, spec);
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
