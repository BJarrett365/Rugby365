/**
 * Research-backed profile updates for Reece Hodge, Noah Lolesio, Nic White,
 * Tom Wright, Folau Fainga'a and Bernard Foley.
 *
 * Caps/height/weight: wallabies.rugby player pages where listed (14 Aug 2026);
 * otherwise All.Rugby Australia team totals cross-checked with Wikipedia.
 * Season lines 2012–2026: All.Rugby overall tables (all competitions; Super Rugby
 * variants merged; U20 and 0-minute DNPs skipped). Foley 2013 Super Rugby,
 * 2015–16 Black Rams and 2020–21 Kubota Top League from Wikipedia club table
 * (absent from All.Rugby overall). Titles: Wikipedia / Rugby Australia where explicit.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-wallabies-hodge-lolesio-white-wright-faingaa-foley.ts
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

const AUSTRALIA_ID = "c58b3003-8f30-45cf-b176-ff0a5f98531e";
const SOURCE = "all_rugby";

const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "wallabies-hodge-lolesio-white-wright-faingaa-foley-season-lines.json"), "utf8"),
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
  careerStatus: "active" | "released";
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
  hodge: "https://en.wikipedia.org/wiki/Reece_Hodge",
  lolesio: "https://en.wikipedia.org/wiki/Noah_Lolesio",
  white: "https://en.wikipedia.org/wiki/Nic_White",
  wright: "https://en.wikipedia.org/wiki/Tom_Wright_(rugby,_born_1997)",
  faingaa: "https://en.wikipedia.org/wiki/Folau_Fainga%27a",
  foley: "https://en.wikipedia.org/wiki/Bernard_Foley",
};

const RA = {
  hodge: "https://wallabies.rugby/players/reece-hodge",
  lolesio: "https://wallabies.rugby/players/noah-lolesio",
  white: "https://wallabies.rugby/players/nic-white",
  wright: "https://wallabies.rugby/players/tom-wright/2878",
  faingaa: "https://wallabies.rugby/players/folau-faingaa",
  foley: "https://wallabies.rugby/players/bernard-foley",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["fc8b17a4-28ec-4767-ad14-ca987144ec24", "c1e5f0a5-5208-4a8a-8617-ae433813f47c"],
    seasonKey: "reece-hodge",
    name: "Reece Hodge",
    fullName: "Reece Hodge",
    wikipediaUrl: WIKI.hodge,
    officialUrl: RA.hodge,
    birthDate: "1994-08-26",
    birthPlace: "North Sydney, New South Wales, Australia",
    heightCm: 191,
    weightKg: 94,
    clubName: "",
    clubTeamSlug: null,
    positionName: "centre",
    positions: ["centre", "fullback", "wing", "fly-half"],
    school: "Northern Beaches Secondary College, Manly Selective Campus",
    bioSummary:
      "Utility Wallabies back (Wallaby #897) who can play centre, fullback, wing or fly-half. Made his Test debut against New Zealand in Wellington in 2016 and won 63 caps through a final Test against South Africa in Pretoria in 2023. A Rugby World Cup 2019 squad member. Left the Melbourne Rebels after 100 Super Rugby appearances and was released by Aviron Bayonnais in May 2026 after a long knee injury; no new club has been announced.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cc/2017.06.24.15.28.28-Reece_Hodge_%2834706371334%29_%28cropped%29.jpg",
    imageAlt: "Reece Hodge with Australia in 2017",
    caps: 63,
    tries: 13,
    points: 168,
    intlYearsLabel: "2016–2023",
    careerStatus: "released",
    statusOverride: "unattached",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.hodge },
    ],
  },
  {
    ids: ["7fce348c-bfc7-414d-8215-eb192ec22f84"],
    seasonKey: "noah-lolesio",
    name: "Noah Lolesio",
    fullName: "Noah Lolesio",
    wikipediaUrl: WIKI.lolesio,
    officialUrl: RA.lolesio,
    birthDate: "1999-12-18",
    birthPlace: "Auckland, New Zealand",
    heightCm: 180,
    weightKg: 89,
    clubName: "Toyota Industries Shuttles Aichi",
    clubTeamSlug: "toyota-industries-shuttles-aichi",
    positionName: "fly-half",
    positions: ["fly-half", "centre"],
    school: "The Southport School",
    bioSummary:
      "Wallabies fly-half (Wallaby #934) of Samoan and Niuean descent, born in Auckland and raised on the Gold Coast. Came through the ACT Brumbies, including the 2020 Super Rugby AU title, and had a Top 14 joker spell at Toulon in 2023. Signed for Toyota Industries Shuttles Aichi in Japan Rugby League One Division 2 in October 2025. Test debut against New Zealand in 2020.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8e/Noah_Lolesio_2023-11-18.jpg",
    imageAlt: "Noah Lolesio in 2023",
    caps: 32,
    tries: 2,
    points: 229,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Super Rugby AU champion", year: 2020, sourceUrl: WIKI.lolesio },
    ],
  },
  {
    ids: ["e50fcf45-c8a9-4011-b025-9844ac0f63d7"],
    seasonKey: "nic-white",
    name: "Nic White",
    fullName: "Nicolas William White",
    wikipediaUrl: WIKI.white,
    officialUrl: RA.white,
    birthDate: "1990-06-13",
    birthPlace: "Scone, New South Wales, Australia",
    heightCm: 175,
    weightKg: 78,
    clubName: "Western Force",
    clubTeamSlug: "western-force-zv90r19e",
    positionName: "scrum-half",
    positions: ["scrum-half"],
    school: "St Gregory's College, Campbelltown",
    bioSummary:
      "Former Wallabies scrum-half (Wallaby #875) with 77 Test caps. Came through the Brumbies, then Montpellier and Exeter Chiefs, before returning to the Brumbies and finishing Super Rugby with the Western Force. Rugby World Cup squad member in 2019 and 2023. His final Test was against Argentina in Sydney on 13 September 2025. Wikipedia lists him as a former professional; no 2025–26 Super Rugby appearances are recorded.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/42/Crop_Wallaby_Nic_White_speaks_to_the_media_in_2014.jpg",
    imageAlt: "Nic White representing Australia in 2014",
    caps: 77,
    tries: 7,
    points: 51,
    intlYearsLabel: "2013–2025",
    careerStatus: "released",
    statusOverride: "unattached",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.white },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.white },
    ],
  },
  {
    ids: ["3a9d9afb-e7b8-4091-a423-fa0adfd1fb50"],
    seasonKey: "tom-wright",
    name: "Tom Wright",
    fullName: "Thomas Wright",
    wikipediaUrl: WIKI.wright,
    officialUrl: RA.wright,
    birthDate: "1997-07-21",
    birthPlace: "Randwick, New South Wales, Australia",
    heightCm: 186,
    weightKg: 97,
    clubName: "ACT Brumbies",
    clubTeamSlug: "brumbies-vx91v29w",
    positionName: "fullback",
    positions: ["fullback", "wing", "centre"],
    school: "St Joseph's College, Hunters Hill",
    bioSummary:
      "Wallabies fullback and wing (Wallaby #939) for the ACT Brumbies. Dual-code back who switched from the Manly Sea Eagles; Test debut against New Zealand in Brisbane in 2020, scoring with his first touch. Super Rugby AU champion in 2020. Omitted from the 2023 Rugby World Cup squad. Started every minute of the 2025 British & Irish Lions series before an ACL injury in the 2025 Rugby Championship; returned for seven Super Rugby Pacific appearances in 2026.",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/c/c6/Autumn_Nations_Series_%2722-_Italia_vs_Australia-70_%2852500437548%29_%28Tom_Wright_cropped%29.jpg",
    imageAlt: "Tom Wright with Australia in 2022",
    caps: 47,
    tries: 14,
    points: 70,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Super Rugby AU champion", year: 2020, sourceUrl: WIKI.wright },
    ],
  },
  {
    ids: ["c7985ccc-c329-4a77-8e4a-055f08187e87"],
    seasonKey: "folau-faingaa",
    name: "Folau Fainga'a",
    fullName: "Folau Fainga'a",
    wikipediaUrl: WIKI.faingaa,
    officialUrl: RA.faingaa,
    birthDate: "1995-05-05",
    birthPlace: "Sydney, Australia",
    heightCm: 178,
    weightKg: 115,
    clubName: "NSW Waratahs",
    clubTeamSlug: "waratahs-016o2oj5",
    positionName: "hooker",
    positions: ["hooker"],
    bioSummary:
      "Wallabies hooker now with the NSW Waratahs after the Brumbies, Western Force and ASM Clermont Auvergne. Test debut in 2018; 38 caps and seven Test tries. Rugby World Cup 2019 squad member and Super Rugby AU champion with the Brumbies in 2020. Clermont released him in September 2025; he played Super Rugby Pacific 2026 with the Waratahs after a short return to Clermont.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fe/Folau_Fainga%27a_2023-11-18.jpg",
    imageAlt: "Folau Fainga'a in 2023",
    caps: 38,
    tries: 7,
    points: 35,
    intlYearsLabel: "2018–2022",
    careerStatus: "active",
    titles: [
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.faingaa },
    ],
  },
  {
    ids: ["ffe4faee-ee4a-479e-8c7b-3b9bca276ec9", "3d625b88-d039-48ae-8936-9011976c53fc"],
    seasonKey: "bernard-foley",
    name: "Bernard Foley",
    fullName: "Bernard Foley",
    wikipediaUrl: WIKI.foley,
    officialUrl: RA.foley,
    birthDate: "1989-09-08",
    birthPlace: "Sydney, New South Wales, Australia",
    heightCm: 177,
    weightKg: 89,
    clubName: "NSW Waratahs",
    clubTeamSlug: "waratahs-016o2oj5",
    positionName: "fly-half",
    positions: ["fly-half", "centre", "fullback"],
    school: "St Aloysius' College; Redfield College",
    bioSummary:
      "Wallabies fly-half (Wallaby #877), nicknamed the Iceman, signed to return to the NSW Waratahs for 2027 after Kubota Spears (2020–2026). Super Rugby champion with the Waratahs in 2014 and Japan Rugby League One champion with Kubota in 2022–23. Rugby World Cup 2015 runner-up and 2019 squad member. 76 Tests from 2013 to 2022. Commonwealth Games rugby sevens silver medallist in 2010.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Qantas_Wallabies_Player_Bernard_Foley_%28cropped%29.jpg",
    imageAlt: "Bernard Foley in Wallabies kit",
    caps: 76,
    tries: 16,
    points: 675,
    intlYearsLabel: "2013–2022",
    careerStatus: "active",
    titles: [
      { titleType: "other", title: "Commonwealth Games sevens silver", year: 2010, sourceUrl: WIKI.foley },
      { titleType: "other", title: "Super Rugby champion", year: 2014, sourceUrl: WIKI.foley },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.foley },
      { titleType: "other", title: "Rugby World Cup runner-up", year: 2015, sourceUrl: WIKI.foley },
      { titleType: "world_cup", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.foley },
      { titleType: "other", title: "Japan Rugby League One champion", year: 2023, seasonLabel: "2022–23", sourceUrl: WIKI.foley },
    ],
  },
];

function seasonYear(label: string, competitionSlug: string): number {
  const start = Number(label.slice(0, 4));
  if (competitionSlug === "nations-championship") return 2026;
  if (competitionSlug === "pacific-nations-cup") return start;
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

async function upsertAustraliaStint(playerId: string, spec: PlayerUpdate) {
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
  const australia = existing.find((row) => {
    const name = row.teamName.trim();
    if (/australia\s*(a|xv|sevens|u20|u-20|school)/i.test(name)) return false;
    return /^australia$/i.test(name);
  });
  const payload = {
    teamName: "Australia",
    teamId: AUSTRALIA_ID,
    yearsLabel: spec.intlYearsLabel,
    apps: spec.caps,
    tries: spec.tries,
    points: spec.points,
    sourceProvider: SOURCE,
    sourceUrl: spec.officialUrl,
    syncedAt: new Date(),
  };
  if (australia) {
    await db.update(playerCareerStints).set(payload).where(eq(playerCareerStints.id, australia.id));
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
            note: "wallabies.rugby / rugby.com.au player-page images blocked (HTTP 429); Foley file is a Qantas Wallabies promotional portrait on Commons",
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

  const club = spec.clubTeamSlug ? await resolveTeam(spec.clubTeamSlug) : null;
  await updatePlayer(playerId, {
    name: spec.name,
    fullName: spec.fullName,
    birthDate: spec.birthDate,
    birthPlace: spec.birthPlace,
    heightCm: spec.heightCm,
    weightKg: spec.weightKg,
    clubName: spec.clubName,
    clubTeamId: club?.id ?? null,
    countryName: "Australia",
    nationCode: "AU",
    internationalTeamId: AUSTRALIA_ID,
    positionName: spec.positionName,
    school: spec.school ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: spec.careerStatus,
    statusOverride: spec.statusOverride ?? null,
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

  await upsertAustraliaStint(playerId, spec);
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
