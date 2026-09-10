/**
 * Research-backed profile updates for Santiago Chocobares, Rodrigo Isgró,
 * Pablo Matera and Gonzalo García.
 *
 * Test tries/points: lospumas.com.ar player pages (caps field on that site is broken / shows 0).
 * Test caps: All.Rugby match sheets, except Matera (Rugby Database 124 / July 2026 Tests).
 * Season lines 2012–2026: All.Rugby overall tables (all competitions; no invented rows).
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-pumas-chocobares-isgro-matera-garcia.ts
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "pumas-chocobares-isgro-matera-garcia-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

type SeasonLine = {
  allRugbySeason: string;
  competitionSlug: string;
  teamSlug: string;
  appearances: number;
  tries: number;
  points: number;
  minutes: number;
};

type PlayerUpdate = {
  ids: string[];
  seasonKey: string;
  name: string;
  fullName: string;
  wikipediaUrl: string;
  birthDate: string;
  birthPlace: string;
  heightCm: number;
  weightKg: number;
  clubName: string;
  clubTeamSlug: string;
  positionName: string;
  positions: string[];
  school?: string;
  bioSummary: string;
  imageUrl: string;
  imageAlt: string;
  imageSourcePage: string;
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
};

const WIKI = {
  chocobares: "https://en.wikipedia.org/wiki/Santiago_Chocobares",
  chocobaresFr: "https://fr.wikipedia.org/wiki/Santiago_Chocobares",
  isgro: "https://en.wikipedia.org/wiki/Rodrigo_Isgr%C3%B3",
  matera: "https://en.wikipedia.org/wiki/Pablo_Matera",
  garcia: "https://en.wikipedia.org/wiki/Gonzalo_Garc%C3%ADa_(rugby_union,_born_1999)",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["125f007a-9ba8-4507-8601-e003f06ae61c"],
    seasonKey: "santiago-chocobares",
    name: "Santiago Chocobares",
    fullName: "Santiago Chocobares",
    wikipediaUrl: WIKI.chocobares,
    birthDate: "1999-03-31",
    birthPlace: "Rufino, Santa Fe, Argentina",
    heightCm: 190,
    weightKg: 101,
    clubName: "Toulouse",
    clubTeamSlug: "toulouse",
    positionName: "centre",
    positions: ["centre"],
    bioSummary:
      "Los Pumas centre for Stade Toulousain. Test debut against New Zealand on 14 November 2020. Rugby World Cup 2023 squad member (Argentina finished fourth). Top 14 champion with Toulouse in 2021, 2023, 2024 and 2025; Champions Cup winner in 2024. Missed Argentina's July 2026 Nations Championship opener because of the Top 14 final.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/CHOCOBARES-4.png",
    imageAlt: "Santiago Chocobares, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/chocobares-santiago/",
    caps: 35,
    tries: 2,
    points: 10,
    intlYearsLabel: "2020–present",
    titles: [
      { titleType: "top_14", title: "Top 14 champion", year: 2021, seasonLabel: "2020–21", sourceUrl: WIKI.chocobaresFr },
      { titleType: "top_14", title: "Top 14 champion", year: 2023, seasonLabel: "2022–23", sourceUrl: WIKI.chocobaresFr },
      { titleType: "top_14", title: "Top 14 champion", year: 2024, seasonLabel: "2023–24", sourceUrl: WIKI.chocobaresFr },
      { titleType: "top_14", title: "Top 14 champion", year: 2025, seasonLabel: "2024–25", sourceUrl: WIKI.chocobaresFr },
      { titleType: "champions_cup", title: "Champions Cup winner", year: 2024, seasonLabel: "2023–24", sourceUrl: WIKI.chocobares },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.chocobares },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.chocobares },
    ],
  },
  {
    ids: ["24ca9da4-a741-463b-9d47-c445aa0f4c7e"],
    seasonKey: "rodrigo-isgro-alastra",
    name: "Rodrigo Isgró",
    fullName: "Rodrigo Antonio Isgró Alastra",
    wikipediaUrl: WIKI.isgro,
    birthDate: "1999-03-24",
    birthPlace: "Mendoza, Argentina",
    heightCm: 185,
    weightKg: 100,
    clubName: "Harlequins",
    clubTeamSlug: "harlequins-216my6ng",
    positionName: "wing",
    positions: ["wing"],
    bioSummary:
      "Los Pumas wing for Harlequins. Test debut against Australia on 15 July 2023. Rugby World Cup 2023 squad member. Former Argentina sevens international: Olympic bronze at Tokyo 2020 and World Rugby Men's Sevens Player of the Year in 2023. Signed for Harlequins in 2024.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/ISGRO-8.png",
    imageAlt: "Rodrigo Isgró, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/isgro-rodrigo/",
    caps: 19,
    tries: 7,
    points: 35,
    intlYearsLabel: "2023–present",
    titles: [
      { titleType: "other", title: "Olympic rugby sevens bronze", year: 2021, sourceUrl: WIKI.isgro },
      { titleType: "other", title: "World Rugby Men's Sevens Player of the Year", year: 2023, sourceUrl: WIKI.isgro },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.isgro },
    ],
  },
  {
    ids: ["4f44663b-d5de-408c-ae96-9f39cd20491e"],
    seasonKey: "pablo-matera",
    name: "Pablo Matera",
    fullName: "Pablo Nicolás Matera",
    wikipediaUrl: WIKI.matera,
    birthDate: "1993-07-18",
    birthPlace: "Buenos Aires, Argentina",
    heightCm: 192,
    weightKg: 111,
    clubName: "Mie Honda Heat",
    clubTeamSlug: "mie-honda-heat",
    positionName: "flanker",
    positions: ["flanker", "number 8"],
    school: "St. Catherine's Moorlands School",
    bioSummary:
      "Los Pumas flanker for Mie Honda Heat and Argentina's most-capped player. Test debut against Chile on 1 May 2013. Rugby World Cup squad member in 2015 (fourth place), 2019 and 2023 (fourth place). Previously played for Leicester Tigers, Jaguares, Stade Français and the Crusaders.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/MATERA-7.png",
    imageAlt: "Pablo Matera, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/matera-pablo/",
    caps: 124,
    tries: 14,
    points: 70,
    intlYearsLabel: "2013–present",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.matera },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2015, sourceUrl: WIKI.matera },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.matera },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.matera },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.matera },
    ],
  },
  {
    ids: ["140b1cff-33a3-4837-ab41-a2eeb4fb2b83"],
    seasonKey: "gonzalo-garcia-1999",
    name: "Gonzalo García",
    fullName: "Gonzalo Jesús García",
    wikipediaUrl: WIKI.garcia,
    birthDate: "1999-03-05",
    birthPlace: "San Miguel de Tucumán, Tucumán, Argentina",
    heightCm: 173,
    weightKg: 82,
    clubName: "Section Paloise",
    clubTeamSlug: "section-paloise-zv90536e",
    positionName: "scrum-half",
    positions: ["scrum-half"],
    bioSummary:
      "Los Pumas scrum-half who joined Section Paloise from Zebre Parma in 2026. Test debut against New Zealand on 12 September 2021. Product of Natación y Gimnasia in Tucumán. Has not appeared at a Rugby World Cup. English Wikipedia still lists Zebre Parma as his club; NZ Rugby-style current listing and Americas Rugby News (May–July 2026) have him at Pau.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/GARCIA-1.png",
    imageAlt: "Gonzalo García, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/garcia-gonzalo/",
    caps: 21,
    tries: 1,
    points: 5,
    intlYearsLabel: "2021–present",
    titles: [],
  },
];

function seasonYear(label: string, competitionSlug: string): number {
  const start = Number(label.slice(0, 4));
  if (competitionSlug === "nations-championship") return 2026;
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
  const payload = {
    teamName: "Argentina",
    teamId: ARGENTINA_ID,
    yearsLabel: spec.intlYearsLabel,
    apps: spec.caps,
    tries: spec.tries,
    points: spec.points,
    sourceProvider: SOURCE,
    sourceUrl: spec.imageSourcePage,
    syncedAt: new Date(),
  };
  if (argentina) {
    await db.update(playerCareerStints).set(payload).where(eq(playerCareerStints.id, argentina.id));
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
          sourceProvider: "uar",
          sourcePageUrl: spec.imageSourcePage,
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

  const club = await resolveTeam(spec.clubTeamSlug);
  await updatePlayer(playerId, {
    name: spec.name,
    fullName: spec.fullName,
    birthDate: spec.birthDate,
    birthPlace: spec.birthPlace,
    heightCm: spec.heightCm,
    weightKg: spec.weightKg,
    clubName: spec.clubName,
    clubTeamId: club.id,
    countryName: "Argentina",
    nationCode: "AR",
    internationalTeamId: ARGENTINA_ID,
    positionName: spec.positionName,
    school: spec.school ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: "active",
    statusOverride: null,
    preferredFoot: null,
    isPublic: true,
    publishStatus: "published",
  });

  const db = getDb();
  await db
    .update(players)
    .set({
      name: spec.name,
      positions: spec.positions,
      wikipediaUrl: spec.wikipediaUrl,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, playerId));

  await upsertArgentinaStint(playerId, spec);
  await upsertTitles(playerId, spec);
  await upsertImage(playerId, spec);
  const lines = SEASON_LINES[spec.seasonKey];
  if (!lines?.length) throw new Error(`No season lines for ${spec.seasonKey}`);
  for (const line of lines) {
    await upsertSeasonLine(playerId, line);
  }
  console.log(`  season lines: ${lines.length}`);
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
