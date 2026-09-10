/**
 * Research-backed profile updates for Santiago Carreras, Juan Cruz Mallía,
 * Bautista Delguy and Julián Montoya.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/update-argentina-pumas-profiles.ts
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { and, eq } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  playerCareerStints,
  playerImages,
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

const ARGENTINA_ID = "56a0fc7e-cc65-47ec-893a-25339b103082";
const SOURCE = "all_rugby";

type SeasonLine = {
  allRugbySeason: "2023-24" | "2024-25" | "2025-26";
  competitionSlug: string;
  teamSlug: string;
  appearances: number;
  tries: number;
  points: number;
  minutes: number;
};

type PlayerUpdate = {
  ids: string[];
  name: string;
  fullName: string;
  wikipediaUrl: string;
  birthDate: string;
  birthPlace: string;
  heightCm: number;
  weightKg: number;
  clubName: string;
  clubTeamId: string;
  positionName: string;
  positions: string[];
  school?: string;
  university?: string;
  relatives?: string;
  bioSummary: string;
  imageUrl: string;
  imageAlt: string;
  caps: number;
  tries: number;
  points: number;
  intlYearsLabel: string;
  titles: Array<{
    titleType: string;
    title: string;
    year: number;
    seasonLabel?: string;
    sourceUrl: string;
  }>;
  seasonLines: SeasonLine[];
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["3f4142e8-a674-4e0c-b066-40ec917db6b6"],
    name: "Santiago Carreras",
    fullName: "Santiago Carreras",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Santiago_Carreras",
    birthDate: "1998-03-30",
    birthPlace: "Córdoba, Argentina",
    heightCm: 183,
    weightKg: 87,
    clubName: "Bath",
    clubTeamId: "3e960a0c-badf-4bac-88b1-510c433db028",
    positionName: "fly-half",
    positions: ["fly-half", "fullback", "wing"],
    relatives: "Cousin of Mateo Carreras",
    bioSummary:
      "Argentine fly-half and fullback who moved to Bath from Gloucester in 2025. Capped by Los Pumas at the 2019 and 2023 Rugby World Cups.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/CARRERAS-S-7.png",
    imageAlt: "Santiago Carreras, Argentina headshot",
    caps: 69,
    tries: 9,
    points: 221,
    intlYearsLabel: "2019–present",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2019,
        sourceUrl: "https://en.wikipedia.org/wiki/Santiago_Carreras",
      },
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2023,
        sourceUrl: "https://en.wikipedia.org/wiki/Santiago_Carreras",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2023-24", competitionSlug: "premiership", teamSlug: "gloucester-do6lo6yl", appearances: 10, tries: 3, points: 56, minutes: 790 },
      { allRugbySeason: "2023-24", competitionSlug: "challenge-cup", teamSlug: "gloucester-do6lo6yl", appearances: 5, tries: 0, points: 51, minutes: 400 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 4, tries: 2, points: 19, minutes: 247 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-world-cup", teamSlug: "argentina-g567pe6e", appearances: 7, tries: 2, points: 14, minutes: 386 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 6, tries: 0, points: 36, minutes: 338 },
      { allRugbySeason: "2024-25", competitionSlug: "premiership", teamSlug: "gloucester-do6lo6yl", appearances: 14, tries: 6, points: 124, minutes: 1058 },
      { allRugbySeason: "2024-25", competitionSlug: "challenge-cup", teamSlug: "gloucester-do6lo6yl", appearances: 4, tries: 1, points: 29, minutes: 314 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 2, tries: 0, points: 0, minutes: 52 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 9, minutes: 226 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 6, tries: 0, points: 72, minutes: 384 },
      { allRugbySeason: "2025-26", competitionSlug: "premiership", teamSlug: "bath-5d9yp9og", appearances: 15, tries: 5, points: 53, minutes: 969 },
      { allRugbySeason: "2025-26", competitionSlug: "rugby-champions-cup", teamSlug: "bath-5d9yp9og", appearances: 7, tries: 1, points: 5, minutes: 394 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 30, minutes: 146 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 1, points: 5, minutes: 230 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 1, tries: 0, points: 5, minutes: 80 },
    ],
  },
  {
    ids: ["a321e18f-6300-4f47-88db-6214abe08683", "8408a9ea-c508-4b57-9d91-9980353473ee"],
    name: "Juan Cruz Mallía",
    fullName: "Juan Cruz Mallía",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Juan_Cruz_Mall%C3%ADa",
    birthDate: "1996-09-11",
    birthPlace: "Córdoba, Argentina",
    heightCm: 182,
    weightKg: 92,
    clubName: "Stade Toulousain",
    clubTeamId: "8cd892b2-06a5-4bec-a444-776234542add",
    positionName: "fullback",
    positions: ["fullback", "wing", "fly-half", "centre"],
    university: "National University of Córdoba",
    bioSummary:
      "Argentine fullback for Stade Toulousain and Los Pumas. Dual Rugby World Cup squad member (2019, 2023) and a multiple Top 14 and Champions Cup winner with Toulouse.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/MALLIA-2.png",
    imageAlt: "Juan Cruz Mallía, Argentina headshot",
    caps: 52,
    tries: 8,
    points: 46,
    intlYearsLabel: "2018–present",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2019,
        sourceUrl: "https://en.wikipedia.org/wiki/Juan_Cruz_Mall%C3%ADa",
      },
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2023,
        sourceUrl: "https://en.wikipedia.org/wiki/Juan_Cruz_Mall%C3%ADa",
      },
      {
        titleType: "top_14",
        title: "Top 14 winner",
        year: 2021,
        seasonLabel: "2020–21",
        sourceUrl: "https://all.rugby/player/juan-cruz-mallia",
      },
      {
        titleType: "top_14",
        title: "Top 14 winner",
        year: 2023,
        seasonLabel: "2022–23",
        sourceUrl: "https://all.rugby/player/juan-cruz-mallia",
      },
      {
        titleType: "top_14",
        title: "Top 14 winner",
        year: 2024,
        seasonLabel: "2023–24",
        sourceUrl: "https://all.rugby/player/juan-cruz-mallia",
      },
      {
        titleType: "top_14",
        title: "Top 14 winner",
        year: 2025,
        seasonLabel: "2024–25",
        sourceUrl: "https://all.rugby/player/juan-cruz-mallia",
      },
      {
        titleType: "champions_cup",
        title: "Champions Cup winner",
        year: 2021,
        sourceUrl: "https://all.rugby/player/juan-cruz-mallia",
      },
      {
        titleType: "champions_cup",
        title: "Champions Cup winner",
        year: 2024,
        sourceUrl: "https://all.rugby/player/juan-cruz-mallia",
      },
      {
        titleType: "other",
        title: "Currie Cup First Division winner (Jaguares XV)",
        year: 2019,
        sourceUrl: "https://en.wikipedia.org/wiki/Juan_Cruz_Mall%C3%ADa",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2023-24", competitionSlug: "top-14", teamSlug: "stade-toulousain-016odw95", appearances: 15, tries: 6, points: 86, minutes: 1014 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-champions-cup", teamSlug: "stade-toulousain-016odw95", appearances: 6, tries: 4, points: 20, minutes: 485 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 1, tries: 1, points: 5, minutes: 43 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-world-cup", teamSlug: "argentina-g567pe6e", appearances: 7, tries: 0, points: 0, minutes: 504 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 6, tries: 3, points: 15, minutes: 444 },
      { allRugbySeason: "2024-25", competitionSlug: "top-14", teamSlug: "stade-toulousain-016odw95", appearances: 16, tries: 8, points: 115, minutes: 1226 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-champions-cup", teamSlug: "stade-toulousain-016odw95", appearances: 7, tries: 0, points: 8, minutes: 320 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 2, points: 10, minutes: 240 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 6, tries: 0, points: 6, minutes: 480 },
      { allRugbySeason: "2025-26", competitionSlug: "top-14", teamSlug: "stade-toulousain-016odw95", appearances: 2, tries: 3, points: 15, minutes: 155 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 0, minutes: 179 },
    ],
  },
  {
    ids: ["9776d6c4-edcc-46ee-aaba-06119b09dcc1"],
    name: "Bautista Delguy",
    fullName: "Bautista Delguy",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Bautista_Delguy",
    birthDate: "1997-04-22",
    birthPlace: "Remedios de Escalada, Argentina",
    heightCm: 183,
    weightKg: 85,
    clubName: "Clermont",
    clubTeamId: "34ab8194-66e0-4d86-96c9-900bc5fce04d",
    positionName: "wing",
    positions: ["wing", "fullback"],
    bioSummary:
      "Argentine wing for ASM Clermont Auvergne and Los Pumas. Played at the 2019 Rugby World Cup; not selected for the 2023 tournament.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/DELGUY-1.png",
    imageAlt: "Bautista Delguy, Argentina headshot",
    caps: 42,
    tries: 11,
    points: 55,
    intlYearsLabel: "2018–present",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2019,
        sourceUrl: "https://en.wikipedia.org/wiki/Bautista_Delguy",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2023-24", competitionSlug: "top-14", teamSlug: "clermont-zd93m5jv", appearances: 18, tries: 11, points: 55, minutes: 1379 },
      { allRugbySeason: "2023-24", competitionSlug: "challenge-cup", teamSlug: "clermont-zd93m5jv", appearances: 6, tries: 3, points: 15, minutes: 470 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-xv", appearances: 2, tries: 1, points: 5, minutes: 160 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 2, tries: 0, points: 0, minutes: 136 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 0, minutes: 128 },
      { allRugbySeason: "2024-25", competitionSlug: "top-14", teamSlug: "clermont-zd93m5jv", appearances: 18, tries: 4, points: 20, minutes: 1427 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-champions-cup", teamSlug: "clermont-zd93m5jv", appearances: 3, tries: 0, points: 0, minutes: 186 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 1, points: 5, minutes: 187 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 4, tries: 3, points: 15, minutes: 311 },
      { allRugbySeason: "2025-26", competitionSlug: "top-14", teamSlug: "clermont-zd93m5jv", appearances: 19, tries: 5, points: 25, minutes: 1445 },
      { allRugbySeason: "2025-26", competitionSlug: "rugby-champions-cup", teamSlug: "clermont-zd93m5jv", appearances: 2, tries: 0, points: 0, minutes: 140 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 2, tries: 1, points: 5, minutes: 160 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 0, minutes: 195 },
    ],
  },
  {
    ids: ["9164d5dd-cf26-4c70-a3d3-32f285ccad1a"],
    name: "Julián Montoya",
    fullName: "Julián Montoya",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Juli%C3%A1n_Montoya",
    birthDate: "1993-10-29",
    birthPlace: "Buenos Aires, Argentina",
    heightCm: 183,
    weightKg: 113,
    clubName: "Section Paloise",
    clubTeamId: "9b492a9f-5dcd-4628-a93b-04aa985add38",
    positionName: "hooker",
    positions: ["hooker"],
    school: "Colegio Cardenal Newman",
    bioSummary:
      "Argentina captain and hooker, now at Section Paloise after five seasons with Leicester Tigers. Played at the 2015, 2019 and 2023 Rugby World Cups and won the 2022 Premiership with Leicester.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/MONTOYA-3.png",
    imageAlt: "Julián Montoya, Argentina headshot",
    caps: 117,
    tries: 14,
    points: 70,
    intlYearsLabel: "2014–present",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2015,
        sourceUrl: "https://en.wikipedia.org/wiki/Juli%C3%A1n_Montoya",
      },
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2019,
        sourceUrl: "https://en.wikipedia.org/wiki/Juli%C3%A1n_Montoya",
      },
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2023,
        sourceUrl: "https://en.wikipedia.org/wiki/Juli%C3%A1n_Montoya",
      },
      {
        titleType: "premiership",
        title: "Premiership winner",
        year: 2022,
        seasonLabel: "2021–22",
        sourceUrl: "https://en.wikipedia.org/wiki/Juli%C3%A1n_Montoya",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2023-24", competitionSlug: "premiership", teamSlug: "leicester-tigers-g567e9er", appearances: 11, tries: 3, points: 15, minutes: 738 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-champions-cup", teamSlug: "leicester-tigers-g567e9er", appearances: 4, tries: 0, points: 0, minutes: 301 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 1, points: 5, minutes: 160 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-world-cup", teamSlug: "argentina-g567pe6e", appearances: 6, tries: 0, points: 0, minutes: 401 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 5, tries: 1, points: 5, minutes: 341 },
      { allRugbySeason: "2024-25", competitionSlug: "premiership", teamSlug: "leicester-tigers-g567e9er", appearances: 16, tries: 1, points: 5, minutes: 1081 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-champions-cup", teamSlug: "leicester-tigers-g567e9er", appearances: 3, tries: 2, points: 10, minutes: 189 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 0, minutes: 162 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "argentina-g567pe6e", appearances: 4, tries: 1, points: 5, minutes: 296 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "argentina-g567pe6e", appearances: 6, tries: 1, points: 5, minutes: 418 },
      { allRugbySeason: "2025-26", competitionSlug: "top-14", teamSlug: "section-paloise-zv90536e", appearances: 15, tries: 6, points: 30, minutes: 777 },
      { allRugbySeason: "2025-26", competitionSlug: "rugby-champions-cup", teamSlug: "section-paloise-zv90536e", appearances: 1, tries: 0, points: 0, minutes: 29 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 1, points: 5, minutes: 204 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "argentina-g567pe6e", appearances: 3, tries: 0, points: 0, minutes: 215 },
    ],
  },
];

function seasonYear(label: SeasonLine["allRugbySeason"], competitionSlug: string): number {
  const start = Number(label.slice(0, 4));
  if (competitionSlug === "nations-championship") return 2026;
  if (competitionSlug === "end-of-year-internationals") return start;
  return start;
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
  if (!row) throw new Error(`Season ${year} not found for competition ${competitionId}`);
  return row;
}

async function upsertArgentinaStint(playerId: string, spec: PlayerUpdate) {
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
  const argentina = existing.find((row) => /argentina/i.test(row.teamName) && !/xv|sevens|jaguars|u20/i.test(row.teamName));
  if (argentina) {
    await db
      .update(playerCareerStints)
      .set({
        teamName: "Argentina",
        teamId: ARGENTINA_ID,
        yearsLabel: spec.intlYearsLabel,
        apps: spec.caps,
        tries: spec.tries,
        points: spec.points,
        sourceProvider: SOURCE,
        sourceUrl: "https://all.rugby",
        syncedAt: new Date(),
      })
      .where(eq(playerCareerStints.id, argentina.id));
    return;
  }
  await db.insert(playerCareerStints).values({
    playerId,
    careerType: "international",
    yearsLabel: spec.intlYearsLabel,
    teamName: "Argentina",
    teamId: ARGENTINA_ID,
    apps: spec.caps,
    tries: spec.tries,
    points: spec.points,
    sortOrder: 0,
    sourceProvider: SOURCE,
    sourceUrl: "https://all.rugby",
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
          sourceProvider: "uar",
          sourcePageUrl: "https://www.lospumas.com.ar/",
          altText: spec.imageAlt,
          caption: spec.imageAlt,
          credit: "Unión Argentina de Rugby / Los Pumas",
          licence: "club_supplied",
          imageType: "headshot",
          role: "gallery",
          confidence: "high",
          confidenceScore: 100,
          status: "candidate",
          isPublic: false,
          matchContext: { source: "lospumas.com.ar" },
        })
        .returning({ id: playerImages.id })
    )[0]!.id;
  await applyPlayerImageAction(playerId, imageId, "set_primary");
}

async function upsertSeasonLine(playerId: string, line: SeasonLine) {
  const db = getDb();
  const competition = await resolveCompetition(line.competitionSlug);
  const team = await resolveTeam(line.teamSlug);
  const year = seasonYear(line.allRugbySeason, line.competitionSlug);
  const season = await resolveSeason(competition.id, year);

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

  if (existing) {
    await db
      .update(playerSeasonStats)
      .set({
        appearances: line.appearances,
        tries: line.tries,
        points: line.points,
        minutesPlayed: line.minutes || existing.minutesPlayed,
        competitionId: competition.id,
        sourceProvider: SOURCE,
        syncedAt: new Date(),
      })
      .where(eq(playerSeasonStats.id, existing.id));
    return;
  }
  await db.insert(playerSeasonStats).values({
    playerId,
    seasonId: season.id,
    competitionId: competition.id,
    teamId: team.id,
    appearances: line.appearances,
    tries: line.tries,
    points: line.points,
    minutesPlayed: line.minutes,
    sourceProvider: SOURCE,
    syncedAt: new Date(),
  });
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
    clubTeamId: spec.clubTeamId,
    countryName: "Argentina",
    nationCode: "AR",
    internationalTeamId: ARGENTINA_ID,
    positionName: spec.positionName,
    school: spec.school ?? null,
    university: spec.university ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: "active",
    isPublic: true,
    publishStatus: "published",
  });

  const db = getDb();
  await db
    .update(players)
    .set({
      name: spec.name,
      positions: spec.positions,
      relatives: spec.relatives ?? null,
      wikipediaUrl: spec.wikipediaUrl,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, playerId));

  await upsertArgentinaStint(playerId, spec);
  if (spec.name === "Julián Montoya") {
    await db
      .update(playerCareerStints)
      .set({ apps: 16, tries: 6, points: 30, sourceProvider: SOURCE, syncedAt: new Date() })
      .where(
        and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.teamName, "Pau")),
      );
    await db.delete(playerCareerStints).where(
      and(
        eq(playerCareerStints.playerId, playerId),
        eq(playerCareerStints.careerType, "international"),
        eq(playerCareerStints.teamName, ""),
      ),
    );
  }
  await upsertTitles(playerId, spec);
  await upsertImage(playerId, spec);
  for (const line of spec.seasonLines) {
    await upsertSeasonLine(playerId, line);
  }
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
