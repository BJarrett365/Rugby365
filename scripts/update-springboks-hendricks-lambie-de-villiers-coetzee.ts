/**
 * Research-backed profile + season-stat updates for Cornal Hendricks,
 * Patrick Lambie, Jean de Villiers and Marcell Coetzee.
 *
 * 2014 Rugby Championship: Wikipedia / All.Rugby match sheets (appearances were 0
 * in the DB despite correct try/point totals). Lambie did not play the first two
 * Tests (not in the match-day 23 vs Argentina). Club/Test lines 2013–2026:
 * All.Rugby overall tables. Caps: Wikipedia / bokhist / SA Rugby.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-springboks-hendricks-lambie-de-villiers-coetzee.ts
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
  readFileSync(join(here, "springboks-hendricks-lambie-de-villiers-coetzee-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;
const TRC_2014_MATCHES = JSON.parse(
  readFileSync(join(here, "springboks-hendricks-lambie-de-villiers-coetzee-2014-trc-matches.json"), "utf8"),
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
  hendricks: "https://en.wikipedia.org/wiki/Cornal_Hendricks",
  lambie: "https://en.wikipedia.org/wiki/Patrick_Lambie",
  jean: "https://en.wikipedia.org/wiki/Jean_de_Villiers",
  coetzee: "https://en.wikipedia.org/wiki/Marcell_Coetzee",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["2b708a3b-5a25-45e7-9e91-d93318e4ab69", "c3f854e5-6f52-49d5-b651-44e3adb99b10"],
    seasonKey: "cornal-hendricks",
    name: "Cornal Hendricks",
    fullName: "Cornal Hendricks",
    wikipediaUrl: WIKI.hendricks,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=927",
    birthDate: "1988-04-18",
    birthPlace: "Paarl, South Africa",
    heightCm: 188,
    weightKg: 95,
    clubName: "",
    clubTeamSlug: null,
    positionName: "wing",
    positions: ["wing", "centre"],
    school: "Bergrivier High School, Wellington",
    bioSummary:
      "Former Springbok wing and centre (Springbok #855) who played for the Cheetahs, Bulls and Boland. 12 Tests, 5 tries and 25 points (bokhist / SA Rugby / AP). Represented South Africa Sevens from 2011–2014, winning Commonwealth Games gold in Glasgow in 2014. Diagnosed with a heart condition in 2015, he returned with the Bulls in 2019. Died of a heart attack on 14 May 2025 in Pretoria, aged 37. In the 2014 Rugby Championship he started all six Tests on the right wing and scored three tries (15 points, 457 minutes).",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/56/Cornal_Hendricks_2021.jpg",
    imageAlt: "Cornal Hendricks in 2021",
    caps: 12,
    tries: 5,
    points: 25,
    intlYearsLabel: "2014–2015",
    careerStatus: "retired",
    titles: [
      { titleType: "other", title: "Commonwealth Games gold (rugby sevens)", year: 2014, sourceUrl: WIKI.hendricks },
    ],
  },
  {
    ids: ["c1e41073-fc2e-43a6-a5f7-8b18bb08fe36", "df2a9d69-0e3c-4934-8ef1-d805631cbf53"],
    seasonKey: "patrick-lambie",
    name: "Patrick Lambie",
    fullName: "Patrick Jonathan Lambie",
    wikipediaUrl: WIKI.lambie,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=760",
    birthDate: "1990-10-17",
    birthPlace: "Durban, South Africa",
    heightCm: 177,
    weightKg: 87,
    clubName: "",
    clubTeamSlug: null,
    positionName: "fly-half",
    positions: ["fly-half", "fullback", "centre"],
    school: "Michaelhouse",
    bioSummary:
      "Former Springbok fly-half, fullback and centre who played for the Sharks and Racing 92. 56 Tests, 2 tries and 153 points (Wikipedia infobox / bokhist / SA Rugby). Currie Cup winner with the Sharks in 2010 and 2013. Played at the 2011 and 2015 Rugby World Cups, finishing third in 2015 (50th cap in the bronze-final win over Argentina). Retired in January 2019 after repeated concussions. In the 2014 Rugby Championship he appeared in four Tests, all from the bench (did not play the two matches against Argentina), scoring 13 points including a try, conversion and drop-goal at Newlands and the 55-metre penalty that beat New Zealand 27–25 at Ellis Park.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Patrick_Lambie_cropped.jpg",
    imageAlt: "Patrick Lambie",
    caps: 56,
    tries: 2,
    points: 153,
    intlYearsLabel: "2010–2016",
    careerStatus: "retired",
    titles: [
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2010, sourceUrl: WIKI.lambie },
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2013, sourceUrl: WIKI.lambie },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2011, sourceUrl: WIKI.lambie },
      { titleType: "world_cup", title: "Rugby World Cup third place", year: 2015, sourceUrl: WIKI.lambie },
    ],
  },
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
      "Former Springbok captain and inside centre (Springbok #735) who played for Western Province, the Stormers, Munster and Leicester Tigers. 109 Tests, 27 tries and 135 points (Wikipedia infobox / bokhist). Captained South Africa 37 times. Rugby World Cup winner in 2007 (injured after the opening match) and a 2011 and 2015 World Cup squad member; retired from Tests after a fractured jaw against Samoa at the 2015 World Cup, then played two Premiership matches for Leicester before retiring in 2016. In the 2013 Rugby Championship he started all six Tests as captain and scored three tries; in 2014 he again started all six and scored two tries (10 points, 480 minutes).",
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
    ids: ["b40cb26c-e1f1-4fa8-8338-5ed84b538235", "cc75bed3-53dc-437e-b5e0-92186c9f823f"],
    seasonKey: "marcell-coetzee",
    name: "Marcell Coetzee",
    fullName: "Marcell Cornelius Coetzee",
    wikipediaUrl: WIKI.coetzee,
    officialUrl: "https://bokhist.com/PlayerData.aspx?PlayerID=905",
    birthDate: "1991-05-08",
    birthPlace: "Potchefstroom, South Africa",
    heightCm: 193,
    weightKg: 117,
    clubName: "Bulls",
    clubTeamSlug: "blue-bulls",
    positionName: "flanker",
    positions: ["flanker", "number 8"],
    school: "Port Natal High School",
    bioSummary:
      "Springbok flanker and number eight (Springbok #831) who has played for the Sharks, Honda Heat, Ulster, Bulls and Kobelco Kobe Steelers. 31 Tests, 6 tries and 30 points (Wikipedia / bokhist). Currie Cup winner with the Blue Bulls in 2021. Pro14 Players’ Player of the Season in 2020–21 with Ulster. Did not appear at a Rugby World Cup (ACL injury in 2015; ankle injury in 2019). In the 2014 Rugby Championship he played all six Tests (five starts, one from the bench in Salta) and scored two tries (10 points, 429 minutes).",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Marcell_Coetzee_2_2021.jpg",
    imageAlt: "Marcell Coetzee in 2021",
    caps: 31,
    tries: 6,
    points: 30,
    intlYearsLabel: "2012–2022",
    careerStatus: "active",
    titles: [
      { titleType: "currie_cup", title: "Currie Cup champion", year: 2021, sourceUrl: WIKI.coetzee },
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

async function upsertTrc2014MatchRows(playerId: string, seasonKey: string) {
  const db = getDb();
  let written = 0;
  for (const match of TRC_2014_MATCHES.matches) {
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
  console.log(`  2014 TRC match rows: ${written}`);
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
  await upsertTrc2014MatchRows(playerId, spec.seasonKey);
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
