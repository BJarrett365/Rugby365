/**
 * Research-backed profile updates for All Blacks:
 * Samisoni Taukei'aho, Damian McKenzie, Quinn Tupaea, Scott Barrett,
 * Ardie Savea, Jordie Barrett, Fletcher Newell, Simon Parker,
 * Fabian Holland and Will Jordan.
 *
 * Test caps/tries/points/height: allblacks.com player pages (13 Aug 2026).
 * Season lines 2012–2026: All.Rugby overall tables (all competitions; no invented rows).
 * Titles: Wikipedia (or allblacks.com where Wikipedia has no article).
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-all-blacks-profiles.ts
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

const NEW_ZEALAND_ID = "a8027ebf-f064-4797-ad87-5b69ceacd4bb";
const SOURCE = "all_rugby";
const AB_IMG = (id: string) => `https://images.allblacks.com/image/private/t_q_good/prd/${id}`;

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "all-blacks-season-lines.json"), "utf8"),
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
  birthDate: string | null;
  birthPlace: string;
  heightCm: number;
  weightKg: number;
  clubName: string;
  clubTeamSlug: string;
  positionName: string;
  positions: string[];
  school?: string;
  relatives?: string;
  bioSummary: string;
  imageUrl: string;
  imageAlt: string;
  imageSourcePage: string;
  caps: number;
  tries: number;
  points: number;
  intlYearsLabel: string;
  careerStatus: "active";
  titles: Array<{
    titleType: string;
    title: string;
    year: number;
    seasonLabel?: string;
    sourceUrl: string;
  }>;
};

const WIKI = {
  savea: "https://en.wikipedia.org/wiki/Ardie_Savea",
  mckenzie: "https://en.wikipedia.org/wiki/Damian_McKenzie",
  tupaea: "https://en.wikipedia.org/wiki/Quinn_Tupaea",
  scott: "https://en.wikipedia.org/wiki/Scott_Barrett_(rugby_union)",
  jordie: "https://en.wikipedia.org/wiki/Jordie_Barrett",
  newell: "https://en.wikipedia.org/wiki/Fletcher_Newell",
  holland: "https://en.wikipedia.org/wiki/Fabian_Holland_(rugby_union)",
  jordan: "https://en.wikipedia.org/wiki/Will_Jordan_(rugby_union)",
  taukei: "https://en.wikipedia.org/wiki/Samisoni_Taukei%27aho",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["5c1a5062-52c1-4fc2-891c-da77252bcf8e"],
    seasonKey: "samisoni-taukei-aho",
    name: "Samisoni Taukei'aho",
    fullName: "Samisoni Frank Simpson Taukei'aho",
    wikipediaUrl: WIKI.taukei,
    birthDate: "1997-08-08",
    birthPlace: "Tongatapu, Tonga",
    heightCm: 183,
    weightKg: 115,
    clubName: "Chiefs",
    clubTeamSlug: "chiefs-g567wm9e",
    positionName: "hooker",
    positions: ["hooker"],
    school: "St Paul's Collegiate School",
    bioSummary:
      "Tonga-born All Blacks hooker for the Chiefs and Waikato. All Black #1198, Test debut in 2021. Rugby World Cup 2023 squad member (runners-up).",
    imageUrl: AB_IMG("lm84pcwa8gkqajjl1wa6"),
    imageAlt: "Samisoni Taukei'aho All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/samisoni-taukei-aho",
    caps: 45,
    tries: 14,
    points: 70,
    intlYearsLabel: "2021–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.taukei },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.taukei },
    ],
  },
  {
    ids: ["d0ce0648-aa15-4afc-9f10-14c82004d06b"],
    seasonKey: "damian-mckenzie",
    name: "Damian McKenzie",
    fullName: "Damian Sinclair McKenzie",
    wikipediaUrl: WIKI.mckenzie,
    birthDate: "1995-04-20",
    birthPlace: "Invercargill, New Zealand",
    heightCm: 177,
    weightKg: 75,
    clubName: "Chiefs",
    clubTeamSlug: "chiefs-g567wm9e",
    positionName: "fly-half",
    positions: ["fly-half", "fullback"],
    school: "Christ's College",
    relatives: "Marty McKenzie (brother)",
    bioSummary:
      "All Blacks first five-eighth and fullback for the Chiefs and Waikato. All Black #1154, Test debut in 2016. Missed the 2019 World Cup through knee injury; Rugby World Cup 2023 squad member (runners-up). Spent the 2022 Japan Rugby League One season with Tokyo Sungoliath.",
    imageUrl: AB_IMG("uc3p1cewwesp5fdkvbyt"),
    imageAlt: "Damian McKenzie All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/damian-mckenzie",
    caps: 78,
    tries: 24,
    points: 390,
    intlYearsLabel: "2016–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.mckenzie },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.mckenzie },
    ],
  },
  {
    ids: ["8a3f2348-7821-4013-aac6-0ab15d0cb7ed"],
    seasonKey: "quinn-tupaea",
    name: "Quinn Tupaea",
    fullName: "Quinn Puketahinga Claude Tupaea",
    wikipediaUrl: WIKI.tupaea,
    birthDate: "1999-05-10",
    birthPlace: "Hamilton, Waikato, New Zealand",
    heightCm: 186,
    weightKg: 102,
    clubName: "Chiefs",
    clubTeamSlug: "chiefs-g567wm9e",
    positionName: "centre",
    positions: ["centre", "wing"],
    school: "Hamilton Boys' High School",
    relatives: "Mason Tupaea",
    bioSummary:
      "All Blacks midfielder for the Chiefs and Waikato. All Black #1193, Test debut against Tonga in 2021. A 2022 knee injury interrupted his Test career; returned to the All Blacks squad in 2025. Has not appeared at a Rugby World Cup.",
    imageUrl: AB_IMG("zcfqeld3ytvdyr9nn5iz"),
    imageAlt: "Quinn Tupaea All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/quinn-tupaea",
    caps: 27,
    tries: 5,
    points: 25,
    intlYearsLabel: "2021–present",
    careerStatus: "active",
    titles: [],
  },
  {
    ids: ["66b06b97-23a7-4281-b9d0-556ef8e45873"],
    seasonKey: "scott-barrett",
    name: "Scott Barrett",
    fullName: "Scott Kevin Barrett",
    wikipediaUrl: WIKI.scott,
    birthDate: "1993-11-20",
    birthPlace: "New Plymouth, New Zealand",
    heightCm: 197,
    weightKg: 115,
    clubName: "Crusaders",
    clubTeamSlug: "crusaders-5d9yde9o",
    positionName: "lock",
    positions: ["lock", "flanker"],
    school: "Francis Douglas Memorial College",
    relatives: "Beauden Barrett (brother); Kane Barrett (brother); Jordie Barrett (brother); Kevin Barrett (father)",
    bioSummary:
      "All Blacks lock for the Crusaders and Taranaki. All Black #1155, Test debut in 2016. Rugby World Cup squad member in 2019 (third place) and 2023 (runners-up). Named All Blacks captain in 2024. Part of the Crusaders' 2017 Super Rugby title-winning side.",
    imageUrl: AB_IMG("bhhcu8y3gsigazlonyiy"),
    imageAlt: "Scott Barrett All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/scott-barrett",
    caps: 91,
    tries: 7,
    points: 35,
    intlYearsLabel: "2016–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Super Rugby champion", year: 2017, sourceUrl: WIKI.scott },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.scott },
      { titleType: "other", title: "Rugby World Cup third place", year: 2019, sourceUrl: WIKI.scott },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.scott },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.scott },
    ],
  },
  {
    ids: ["4c18243d-b266-4fa3-b57f-235e25586cf3"],
    seasonKey: "ardie-savea",
    name: "Ardie Savea",
    fullName: "Ardie Suemalo Savea",
    wikipediaUrl: WIKI.savea,
    birthDate: "1993-10-14",
    birthPlace: "Wellington, New Zealand",
    heightCm: 190,
    weightKg: 105,
    clubName: "Moana Pasifika",
    clubTeamSlug: "moana-pasifika-dp9z1868",
    positionName: "number 8",
    positions: ["number 8", "flanker"],
    school: "Rongotai College",
    relatives: "Julian Savea (brother)",
    bioSummary:
      "All Blacks captain (2026) and loose forward. All Black #1147, Test debut against Wales in 2016. Super Rugby champion with the Hurricanes in 2016; 2023 World Rugby Player of the Year. Rugby World Cup squad member in 2019 (third place) and 2023 (runners-up). Super Rugby club listed by NZ Rugby as Moana Pasifika; played the 2025–26 Japan Rugby League One season with Kobelco Kobe Steelers.",
    imageUrl: AB_IMG("bqfbpxygppge9ug8svsz"),
    imageAlt: "Ardie Savea All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/ardie-savea",
    caps: 111,
    tries: 32,
    points: 160,
    intlYearsLabel: "2016–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Super Rugby champion", year: 2016, sourceUrl: WIKI.savea },
      { titleType: "other", title: "World Rugby Player of the Year", year: 2023, sourceUrl: WIKI.savea },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.savea },
      { titleType: "other", title: "Rugby World Cup third place", year: 2019, sourceUrl: WIKI.savea },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.savea },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.savea },
    ],
  },
  {
    ids: ["5d4aa72f-43d7-41bd-b3ad-522a8511dfb5"],
    seasonKey: "jordie-barrett",
    name: "Jordie Barrett",
    fullName: "Jordan Matthew Barrett",
    wikipediaUrl: WIKI.jordie,
    birthDate: "1997-02-17",
    birthPlace: "New Plymouth, New Zealand",
    heightCm: 196,
    weightKg: 102,
    clubName: "Hurricanes",
    clubTeamSlug: "hurricanes-3ej5139x",
    positionName: "centre",
    positions: ["centre", "fullback", "fly-half", "wing"],
    school: "Francis Douglas Memorial College",
    relatives: "Beauden Barrett (brother); Kane Barrett (brother); Scott Barrett (brother)",
    bioSummary:
      "All Blacks centre and fullback for the Hurricanes and Taranaki. All Black #1159, Test debut in 2017. Mitre 10 Cup winner with Canterbury in 2016; United Rugby Championship winner with Leinster in 2025; Super Rugby Pacific winner with the Hurricanes in 2026. Rugby World Cup squad member in 2019 (third place) and 2023 (runners-up).",
    imageUrl: AB_IMG("dizsuqle213dskg3arwl"),
    imageAlt: "Jordie Barrett All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/jordie-barrett",
    caps: 82,
    tries: 27,
    points: 311,
    intlYearsLabel: "2017–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Mitre 10 Cup champion", year: 2016, sourceUrl: WIKI.jordie },
      { titleType: "urc", title: "United Rugby Championship winner", year: 2025, seasonLabel: "2024–25", sourceUrl: WIKI.jordie },
      { titleType: "other", title: "Super Rugby Pacific champion", year: 2026, sourceUrl: WIKI.jordie },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.jordie },
      { titleType: "other", title: "Rugby World Cup third place", year: 2019, sourceUrl: WIKI.jordie },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.jordie },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.jordie },
    ],
  },
  {
    ids: ["a0cbb5ca-e5ab-4a73-b9c8-d9ad650c00ee"],
    seasonKey: "fletcher-newell",
    name: "Fletcher Newell",
    fullName: "Fletcher Newell",
    wikipediaUrl: WIKI.newell,
    birthDate: "2000-03-01",
    birthPlace: "Rangiora, New Zealand",
    heightCm: 186,
    weightKg: 121,
    clubName: "Crusaders",
    clubTeamSlug: "crusaders-5d9yde9o",
    positionName: "prop",
    positions: ["prop"],
    school: "Rangiora High School",
    bioSummary:
      "All Blacks tighthead prop for the Crusaders and Canterbury. All Black #1205, Test debut in 2022. Rugby World Cup 2023 squad member (runners-up). Wikipedia does not list a Super Rugby title in his honours.",
    imageUrl: AB_IMG("ceulqaehwonnnzgqm8ia"),
    imageAlt: "Fletcher Newell All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/fletcher-newell",
    caps: 38,
    tries: 2,
    points: 10,
    intlYearsLabel: "2022–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.newell },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.newell },
    ],
  },
  {
    ids: ["09788be2-bfde-496d-adba-179a29dca8f7"],
    seasonKey: "simon-parker",
    name: "Simon Parker",
    fullName: "Simon Parker",
    wikipediaUrl: "https://www.allblacks.com/players/simon-parker",
    birthDate: null,
    birthPlace: "Mangawhai, New Zealand",
    heightCm: 197,
    weightKg: 117,
    clubName: "Chiefs",
    clubTeamSlug: "chiefs-g567wm9e",
    positionName: "number 8",
    positions: ["number 8", "flanker"],
    school: "St Peter's School, Cambridge",
    bioSummary:
      "All Blacks number 8 for the Chiefs and Northland. All Black #1230, Test debut against Argentina in August 2025. NZ Rugby lists him as 26 years old (as of the June 2026 squad naming); no reliable source published a full date of birth. Has not appeared at a Rugby World Cup. No standalone Wikipedia rugby biography.",
    imageUrl: AB_IMG("vwqztke28u1pfnzdaccy"),
    imageAlt: "Simon Parker All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/simon-parker",
    caps: 9,
    tries: 1,
    points: 5,
    intlYearsLabel: "2025–present",
    careerStatus: "active",
    titles: [],
  },
  {
    ids: ["72da8def-c824-4832-acce-5db4851c45f4"],
    seasonKey: "fabian-holland",
    name: "Fabian Holland",
    fullName: "Fabian Marijn Holland",
    wikipediaUrl: WIKI.holland,
    birthDate: "2002-10-09",
    birthPlace: "Alkmaar, North Holland, Netherlands",
    heightCm: 204,
    weightKg: 124,
    clubName: "Highlanders",
    clubTeamSlug: "highlanders-016oyo95",
    positionName: "lock",
    positions: ["lock"],
    school: "Christchurch Boys' High School",
    bioSummary:
      "Dutch-born All Blacks lock for the Highlanders and Otago. All Black #1224, Test debut in 2025; the first Dutch-born All Black. Lived in New Zealand since 2019. Has not appeared at a Rugby World Cup. Unavailable through injury for the June 2026 Nations Championship Southern Series naming, but listed in the current All Blacks squad.",
    imageUrl: AB_IMG("dyei31iuwddkddix8t6q"),
    imageAlt: "Fabian Holland All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/fabian-holland",
    caps: 12,
    tries: 0,
    points: 0,
    intlYearsLabel: "2025–present",
    careerStatus: "active",
    titles: [],
  },
  {
    ids: ["d02cb9af-f85c-46a4-b709-3bcded10839b"],
    seasonKey: "will-jordan",
    name: "Will Jordan",
    fullName: "William Thomas Jordan",
    wikipediaUrl: WIKI.jordan,
    birthDate: "1998-02-24",
    birthPlace: "Christchurch, Canterbury, New Zealand",
    heightCm: 188,
    weightKg: 94,
    clubName: "Crusaders",
    clubTeamSlug: "crusaders-5d9yde9o",
    positionName: "fullback",
    positions: ["fullback", "wing"],
    school: "Christchurch Boys' High School",
    bioSummary:
      "All Blacks fullback and wing for the Crusaders and Tasman. All Black #1191, Test debut in 2020. Mitre 10 Cup winner with Tasman in 2019; Super Rugby Aotearoa champion in 2021 and Super Rugby Pacific champion in 2022 with the Crusaders. 2021 World Rugby Breakthrough Player of the Year. Rugby World Cup 2023 squad member (runners-up).",
    imageUrl: AB_IMG("p9vnivm59campku1cvsg"),
    imageAlt: "Will Jordan All Blacks profile",
    imageSourcePage: "https://www.allblacks.com/players/will-jordan",
    caps: 57,
    tries: 51,
    points: 255,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Mitre 10 Cup champion", year: 2019, sourceUrl: WIKI.jordan },
      { titleType: "other", title: "Super Rugby Aotearoa champion", year: 2021, sourceUrl: WIKI.jordan },
      { titleType: "other", title: "Super Rugby Pacific champion", year: 2022, sourceUrl: WIKI.jordan },
      { titleType: "other", title: "World Rugby Breakthrough Player of the Year", year: 2021, sourceUrl: WIKI.jordan },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.jordan },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.jordan },
    ],
  },
];

function seasonYear(label: string, competitionSlug: string): number {
  const start = Number(label.slice(0, 4));
  if (competitionSlug === "nations-championship") return 2026;
  if (competitionSlug === "npc-n0628z68") return start + 1;
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

async function upsertNewZealandStint(playerId: string, spec: PlayerUpdate) {
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
  const newZealand = existing.find((row) => {
    const name = row.teamName.trim();
    if (/all\s*blacks\s*xv|m[āa]ori|sevens|u20|u-20|school/i.test(name)) return false;
    return /^(new zealand|all blacks)$/i.test(name);
  });
  const payload = {
    teamName: "New Zealand",
    teamId: NEW_ZEALAND_ID,
    yearsLabel: spec.intlYearsLabel,
    apps: spec.caps,
    tries: spec.tries,
    points: spec.points,
    sourceProvider: SOURCE,
    sourceUrl: spec.imageSourcePage,
    syncedAt: new Date(),
  };
  if (newZealand) {
    await db.update(playerCareerStints).set(payload).where(eq(playerCareerStints.id, newZealand.id));
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
          sourceProvider: "allblacks",
          sourcePageUrl: spec.imageSourcePage,
          altText: spec.imageAlt,
          caption: spec.imageAlt,
          credit: "New Zealand Rugby / allblacks.com",
          licence: "allblacks",
          imageType: "headshot",
          role: "gallery",
          confidence: "high",
          confidenceScore: 95,
          status: "candidate",
          isPublic: false,
          matchContext: { source: "allblacks.com-squad" },
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
  if (process.env.SKIP_WIKI !== "1" && spec.wikipediaUrl.includes("wikipedia.org")) {
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
    countryName: "New Zealand",
    nationCode: "NZ",
    internationalTeamId: NEW_ZEALAND_ID,
    positionName: spec.positionName,
    school: spec.school ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: spec.careerStatus,
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
      relatives: spec.relatives ?? null,
      wikipediaUrl: spec.wikipediaUrl,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, playerId));

  await upsertNewZealandStint(playerId, spec);
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
