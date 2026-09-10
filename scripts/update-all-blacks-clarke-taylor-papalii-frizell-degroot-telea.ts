/**
 * Research-backed profile updates for All Blacks:
 * Caleb Clarke, Codie Taylor, Dalton Papali'i, Shannon Frizell,
 * Ethan de Groot and Mark Tele'a.
 *
 * Test caps/tries/points/height: allblacks.com player pages where live (14 Aug 2026);
 * otherwise All.Rugby New Zealand team totals cross-checked with Wikipedia / Rugby Database.
 * Season lines 2012–2026: All.Rugby overall tables (all competitions; Super Rugby variants merged;
 * U20 and Barbarians skipped; no invented rows).
 * Titles: Wikipedia and allblacks.com / Highlanders official news.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-all-blacks-clarke-taylor-papalii-frizell-degroot-telea.ts
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
  readFileSync(join(here, "all-blacks-clarke-taylor-papalii-degroot-frizell-telea-season-lines.json"), "utf8"),
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
  imageUrl: string | null;
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
  clarke: "https://en.wikipedia.org/wiki/Caleb_Clarke_(rugby_union)",
  taylor: "https://en.wikipedia.org/wiki/Codie_Taylor",
  papalii: "https://en.wikipedia.org/wiki/Dalton_Papali%27i",
  frizell: "https://en.wikipedia.org/wiki/Shannon_Frizell",
  degroot: "https://en.wikipedia.org/wiki/Ethan_de_Groot",
  telea: "https://en.wikipedia.org/wiki/Mark_Tele%27a",
};

const AB = {
  clarke: "https://www.allblacks.com/players/caleb-clarke",
  taylor: "https://www.allblacks.com/players/codie-taylor",
  papalii: "https://www.allblacks.com/players/dalton-papali-i",
  degroot: "https://www.allblacks.com/players/ethan-de-groot",
  frizell: "https://stats.allblacks.com/all-players/profile/Shannon-Frizell-AB-1172",
  telea: "https://stats.allblacks.com/all-players/profile/Mark-Tele'a-AB-1207",
};

const HIGHLANDERS_FRIZELL =
  "https://thehighlanders.co.nz/news/shannon-frizell-confirmed-to-return-for-2027/";

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["1e949fb4-9253-4a93-b79a-5875d3b6337f"],
    seasonKey: "caleb-clarke",
    name: "Caleb Clarke",
    fullName: "Caleb Daniel Clarke",
    wikipediaUrl: WIKI.clarke,
    birthDate: "1999-03-29",
    birthPlace: "Auckland, New Zealand",
    heightCm: 184,
    weightKg: 108,
    clubName: "Blues",
    clubTeamSlug: "blues-x7jq1d91",
    positionName: "wing",
    positions: ["wing"],
    school: "Mount Albert Grammar School",
    relatives: "Eroni Clarke (father), Sheryl Scanlan (aunt), Deine Mariner (cousin)",
    bioSummary:
      "All Blacks winger for the Blues and Auckland. All Black #1187, Test debut in 2020. Son of former All Black Eroni Clarke. Rugby World Cup 2023 squad member (runners-up). Part of Auckland’s 2018 NPC title and the Blues’ 2024 Super Rugby Pacific title.",
    imageUrl: AB_IMG("p1lwwqxiojnzhlwhpr8p"),
    imageAlt: "Caleb Clarke All Blacks profile",
    imageSourcePage: AB.clarke,
    caps: 37,
    tries: 17,
    points: 85,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "National Provincial Championship champion", year: 2018, sourceUrl: AB.clarke },
      { titleType: "other", title: "World Rugby Sevens Series winner", year: 2020, sourceUrl: AB.clarke },
      { titleType: "other", title: "Super Rugby Pacific champion", year: 2024, sourceUrl: AB.clarke },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.clarke },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.clarke },
    ],
  },
  {
    ids: ["c0d15ce3-2c18-4cb5-9bc2-6514eef7904f"],
    seasonKey: "codie-taylor",
    name: "Codie Taylor",
    fullName: "Codie Joshua Dane Taylor",
    wikipediaUrl: WIKI.taylor,
    birthDate: "1991-03-31",
    birthPlace: "Levin, New Zealand",
    heightCm: 183,
    weightKg: 109,
    clubName: "Crusaders",
    clubTeamSlug: "crusaders-5d9yde9o",
    positionName: "hooker",
    positions: ["hooker"],
    school: "Feilding High School",
    relatives: "Walter Pringle (great-great-grandfather)",
    bioSummary:
      "All Blacks hooker for the Crusaders and Canterbury, contracted through 2027. All Black #1143, Test debut in 2015. Rugby World Cup winner in 2015 (played Namibia) and squad member in 2019 (third place) and 2023 (runners-up). Super Rugby champion in 2017, 2018, 2019, 2022, 2023 and 2025.",
    imageUrl: AB_IMG("yt3eehqm7awzyomfc2vy"),
    imageAlt: "Codie Taylor All Blacks profile",
    imageSourcePage: AB.taylor,
    caps: 109,
    tries: 23,
    points: 115,
    intlYearsLabel: "2015–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "IRB Junior World Championship winner", year: 2011, sourceUrl: AB.taylor },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Rugby World Cup winner", year: 2015, sourceUrl: AB.taylor },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Rugby World Cup third place", year: 2019, sourceUrl: WIKI.taylor },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Super Rugby champion", year: 2017, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Super Rugby champion", year: 2018, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Super Rugby champion", year: 2019, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Super Rugby champion", year: 2022, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Super Rugby champion", year: 2023, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Super Rugby champion", year: 2025, sourceUrl: WIKI.taylor },
      { titleType: "other", title: "Tom French Cup", year: 2018, sourceUrl: WIKI.taylor },
    ],
  },
  {
    ids: [
      "1b4842ac-3947-4325-af4b-6701afb082fd",
      "b631156b-e463-4e37-a01b-00e8687d576e",
    ],
    seasonKey: "dalton-papalii",
    name: "Dalton Papali'i",
    fullName: "Dalton Reece Papali'i",
    wikipediaUrl: WIKI.papalii,
    birthDate: "1997-10-11",
    birthPlace: "Auckland, New Zealand",
    heightCm: 193,
    weightKg: 108,
    clubName: "Blues",
    clubTeamSlug: "blues-x7jq1d91",
    positionName: "flanker",
    positions: ["flanker"],
    school: "St Kentigern College",
    bioSummary:
      "All Blacks flanker for the Blues and Counties Manukau. All Black #1176, Test debut against Japan in 2018. Rugby World Cup 2023 squad member (runners-up) and part of the Blues’ 2024 Super Rugby Pacific title. Played for the All Blacks XV in 2025; signed with Castres Olympique for 2027 after the 2026 New Zealand season.",
    imageUrl: AB_IMG("b8daqxncd4axm0dcqvze"),
    imageAlt: "Dalton Papali'i All Blacks profile",
    imageSourcePage: AB.papalii,
    caps: 37,
    tries: 8,
    points: 40,
    intlYearsLabel: "2018–2025",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "World Rugby U20 Championship winner", year: 2017, sourceUrl: AB.papalii },
      { titleType: "other", title: "Super Rugby Pacific champion", year: 2024, sourceUrl: WIKI.papalii },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.papalii },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.papalii },
    ],
  },
  {
    ids: [
      "61d85908-64aa-48cf-858d-9b01f59d2af0",
      "4cefa4a0-aabc-4c35-8094-59a67cad51ef",
    ],
    seasonKey: "shannon-frizell",
    name: "Shannon Frizell",
    fullName: "Shannon Michael Frizell",
    wikipediaUrl: WIKI.frizell,
    birthDate: "1994-02-11",
    birthPlace: "Folaha, Tonga",
    heightCm: 195,
    weightKg: 116,
    clubName: "Tasman",
    clubTeamSlug: "tasman-m98ee29x",
    positionName: "flanker",
    positions: ["flanker", "number 8", "lock"],
    school: "'Apifo'ou College",
    relatives: "Tyson Frizell (brother)",
    bioSummary:
      "Tonga-born All Blacks loose forward returning to Tasman for the 2026 NPC after Toshiba Brave Lupus Tokyo, with the Highlanders from 2027. All Black #1172, Test debut against France in 2018; last Test was the 2023 Rugby World Cup final. Rugby World Cup squad member in 2019 (third place) and 2023 (runners-up). Helped Toshiba win back-to-back Japan Rugby League One titles in 2024 and 2025.",
    imageUrl: null,
    imageAlt: "Shannon Frizell All Blacks profile",
    imageSourcePage: AB.frizell,
    caps: 33,
    tries: 8,
    points: 40,
    intlYearsLabel: "2018–2023",
    careerStatus: "active",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.frizell },
      { titleType: "other", title: "Rugby World Cup third place", year: 2019, sourceUrl: WIKI.frizell },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.frizell },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.frizell },
      { titleType: "other", title: "Japan Rugby League One champion", year: 2024, sourceUrl: HIGHLANDERS_FRIZELL },
      { titleType: "other", title: "Japan Rugby League One champion", year: 2025, sourceUrl: HIGHLANDERS_FRIZELL },
    ],
  },
  {
    ids: ["7c311042-2b8f-4836-8473-e5f8864b45c4"],
    seasonKey: "ethan-de-groot",
    name: "Ethan de Groot",
    fullName: "Ethan de Groot",
    wikipediaUrl: WIKI.degroot,
    birthDate: "1998-07-22",
    birthPlace: "Gold Coast, Queensland, Australia",
    heightCm: 190,
    weightKg: 128,
    clubName: "Highlanders",
    clubTeamSlug: "highlanders-016oyo95",
    positionName: "prop",
    positions: ["prop"],
    school: "Southland Boys' High School",
    bioSummary:
      "All Blacks loosehead prop for the Highlanders and Southland, re-signed through 2027. Born on the Gold Coast and qualified for New Zealand on ancestry. All Black #1197, Test debut against Fiji in 2021. Rugby World Cup 2023 squad member (runners-up); started knockout matches including the final.",
    imageUrl: AB_IMG("rd2fdbabujjv1zocnnhs"),
    imageAlt: "Ethan de Groot All Blacks profile",
    imageSourcePage: AB.degroot,
    caps: 44,
    tries: 5,
    points: 25,
    intlYearsLabel: "2021–present",
    careerStatus: "active",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.degroot },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.degroot },
    ],
  },
  {
    ids: ["fb28d382-1086-4366-9652-25b5b0ec5c65"],
    seasonKey: "mark-telea",
    name: "Mark Tele'a",
    fullName: "Mark Evander Tele'a",
    wikipediaUrl: WIKI.telea,
    birthDate: "1996-12-06",
    birthPlace: "Auckland, New Zealand",
    heightCm: 186,
    weightKg: 94,
    clubName: "Toyota Verblitz",
    clubTeamSlug: "toyota-verblitz",
    positionName: "wing",
    positions: ["wing", "centre"],
    school: "Massey High School",
    bioSummary:
      "All Blacks winger now with Toyota Verblitz in Japan Rugby League One after the Blues and North Harbour. All Black #1207, Test debut against Scotland in 2022 (two tries). Rugby World Cup 2023 squad member (runners-up) and World Rugby Men’s 15s Breakthrough Player of the Year 2023. Last Test in 2024.",
    imageUrl: null,
    imageAlt: "Mark Tele'a All Blacks profile",
    imageSourcePage: AB.telea,
    caps: 19,
    tries: 13,
    points: 65,
    intlYearsLabel: "2022–2024",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Mitre 10 Cup champion", year: 2020, sourceUrl: WIKI.telea },
      { titleType: "other", title: "Super Rugby Trans-Tasman champion", year: 2021, sourceUrl: WIKI.telea },
      { titleType: "other", title: "Super Rugby Pacific champion", year: 2024, sourceUrl: WIKI.telea },
      { titleType: "other", title: "World Rugby Breakthrough Player of the Year", year: 2023, sourceUrl: WIKI.telea },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.telea },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2023, sourceUrl: WIKI.telea },
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
  if (!spec.imageUrl) {
    console.log("  image: skipped (no live allblacks.com player-page headshot)");
    return;
  }
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
