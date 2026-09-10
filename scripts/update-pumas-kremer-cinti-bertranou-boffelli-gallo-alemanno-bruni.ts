/**
 * Research-backed profile updates for Marcos Kremer, Lucio Cinti, Gonzalo Bertranou,
 * Emiliano Boffelli, Thomas Gallo, Matías Alemanno and Rodrigo Bruni.
 *
 * Test tries/points: lospumas.com.ar player pages where present (caps/height/weight on that
 * site are broken / show 0). Bruni has no current UAR player page.
 * Test caps: All.Rugby Argentina team totals (played Tests; U20 / Argentina XV excluded).
 * Season lines 2012–2026: All.Rugby overall tables, all competitions; no invented rows.
 * Pro14 + Rainbow Cup merged into United Rugby Championship for 2020–21.
 * Cinti 2019–20 Tri Nations (0 minutes) omitted.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-pumas-kremer-cinti-bertranou-boffelli-gallo-alemanno-bruni.ts
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
  readFileSync(
    join(here, "pumas-kremer-cinti-bertranou-boffelli-gallo-alemanno-bruni-season-lines.json"),
    "utf8",
  ),
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
  clubTeamSlug: string | null;
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
  kremer: "https://en.wikipedia.org/wiki/Marcos_Kremer",
  cinti: "https://en.wikipedia.org/wiki/Lucio_Cinti",
  bertranou: "https://en.wikipedia.org/wiki/Gonzalo_Bertranou",
  boffelli: "https://en.wikipedia.org/wiki/Emiliano_Boffelli",
  gallo: "https://en.wikipedia.org/wiki/Thomas_Gallo_(rugby_union)",
  alemanno: "https://en.wikipedia.org/wiki/Mat%C3%ADas_Alemanno",
  bruni: "https://en.wikipedia.org/wiki/Rodrigo_Bruni",
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["7ddf862f-eefb-485f-9e20-b3911a40b9e8"],
    seasonKey: "marcos-kremer",
    name: "Marcos Kremer",
    fullName: "Marcos Kremer",
    wikipediaUrl: WIKI.kremer,
    birthDate: "1997-07-30",
    birthPlace: "Concordia, Entre Ríos, Argentina",
    heightCm: 195,
    weightKg: 115,
    clubName: "Clermont",
    clubTeamSlug: "clermont-zd93m5jv",
    positionName: "flanker",
    positions: ["flanker", "lock"],
    bioSummary:
      "Los Pumas flanker and lock for ASM Clermont Auvergne. Test debut against New Zealand on 10 September 2016. Rugby World Cup squad member in 2019 and 2023 (Argentina finished fourth). Previously played for Jaguares and Stade Français. Product of Club Salto Grande and Los Espinillos in Concordia. Missed Argentina's July 2026 Nations Championship opener; played against Wales and England later in the window.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/KREMER-2.png",
    imageAlt: "Marcos Kremer, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/kremer-marcos/",
    caps: 83,
    tries: 4,
    points: 20,
    intlYearsLabel: "2016–present",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.kremer },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.kremer },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.kremer },
    ],
  },
  {
    ids: ["8ddd51ba-4e08-4fc4-a0a9-b53f46a21ce1"],
    seasonKey: "lucio-cinti",
    name: "Lucio Cinti",
    fullName: "Lucio Constantino Cinti Luna",
    wikipediaUrl: WIKI.cinti,
    birthDate: "2000-02-23",
    birthPlace: "La Plata, Buenos Aires, Argentina",
    heightCm: 190,
    weightKg: 97,
    clubName: "Saracens",
    clubTeamSlug: "saracens-zv9039e5",
    positionName: "centre",
    positions: ["centre", "wing"],
    bioSummary:
      "Los Pumas centre and wing for Saracens. Test debut against South Africa on 21 August 2021. Rugby World Cup 2023 squad member (Argentina finished fourth). Previously with London Irish. Product of La Plata Rugby Club. Olympic rugby sevens bronze medallist with Argentina at Tokyo 2020.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/CINTI-2.png",
    imageAlt: "Lucio Cinti, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/cinti-lucio/",
    caps: 41,
    tries: 4,
    points: 20,
    intlYearsLabel: "2021–present",
    titles: [
      { titleType: "other", title: "Olympic rugby sevens bronze", year: 2021, sourceUrl: WIKI.cinti },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.cinti },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.cinti },
    ],
  },
  {
    ids: ["fb71b7a9-b97f-4d43-93e2-d76862e4d2a0"],
    seasonKey: "gonzalo-bertranou",
    name: "Gonzalo Bertranou",
    fullName: "Gonzalo Bertranou",
    wikipediaUrl: WIKI.bertranou,
    birthDate: "1993-12-31",
    birthPlace: "Mendoza, Argentina",
    heightCm: 177,
    weightKg: 82,
    clubName: "California Legion",
    clubTeamSlug: "california-legion",
    positionName: "scrum-half",
    positions: ["scrum-half"],
    bioSummary:
      "Los Pumas scrum-half for California Legion in Major League Rugby. Test debut against Paraguay on 23 May 2015. Rugby World Cup squad member in 2019 and 2023 (Argentina finished fourth). Previously played for Jaguares, Dragons, Cardiff and RFC Los Angeles. Product of Los Tordos. MLR Back of the Year in 2025 and 2026.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/BERTRANOU-7.png",
    imageAlt: "Gonzalo Bertranou, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/bertranou-gonzalo/",
    caps: 66,
    tries: 7,
    points: 35,
    intlYearsLabel: "2015–present",
    titles: [
      { titleType: "other", title: "MLR Back of the Year", year: 2025, sourceUrl: WIKI.bertranou },
      { titleType: "other", title: "MLR Back of the Year", year: 2026, sourceUrl: WIKI.bertranou },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.bertranou },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.bertranou },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.bertranou },
    ],
  },
  {
    ids: ["fdf6c8b6-77fa-49bb-87b7-f660a838b068"],
    seasonKey: "emiliano-boffelli",
    name: "Emiliano Boffelli",
    fullName: "Emiliano Boffelli",
    wikipediaUrl: WIKI.boffelli,
    birthDate: "1995-01-16",
    birthPlace: "Rosario, Argentina",
    heightCm: 192,
    weightKg: 96,
    clubName: "Capibaras XV",
    clubTeamSlug: null,
    positionName: "fullback",
    positions: ["fullback", "wing"],
    bioSummary:
      "Los Pumas fullback and wing. Test debut against England on 10 June 2017. Rugby World Cup squad member in 2019 and 2023 (Argentina finished fourth). Previously played for Jaguares, Racing 92 and Edinburgh. Left Edinburgh in 2025 after a long back injury; returned via Duendes and joined Capibaras XV as an invitational Super Rugby Americas player in April 2026. English Wikipedia still lists Edinburgh as his club.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/BOFFELLI-5.png",
    imageAlt: "Emiliano Boffelli, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/boffelli-emiliano-2/",
    caps: 59,
    tries: 14,
    points: 340,
    intlYearsLabel: "2017–present",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.boffelli },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.boffelli },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.boffelli },
    ],
  },
  {
    ids: ["782f5645-84fe-4750-badf-d0d776c3e4d8"],
    seasonKey: "thomas-gallo",
    name: "Thomas Gallo",
    fullName: "Thomas Gallo",
    wikipediaUrl: WIKI.gallo,
    birthDate: "1999-04-30",
    birthPlace: "San Miguel de Tucumán, Tucumán, Argentina",
    heightCm: 176,
    weightKg: 107,
    clubName: "Lyon",
    clubTeamSlug: "lyon-x7jq51j1",
    positionName: "prop",
    positions: ["prop"],
    bioSummary:
      "Los Pumas loosehead prop who joined Lyon Olympique Universitaire from Benetton on 1 July 2026. Test debut against Australia on 2 October 2021. Rugby World Cup 2023 squad member (Argentina finished fourth). Product of Universitario de Tucumán. English Wikipedia still lists Benetton as his current club.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/GALLO-9.png",
    imageAlt: "Thomas Gallo, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/gallo-thomas/",
    caps: 40,
    tries: 7,
    points: 35,
    intlYearsLabel: "2021–present",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.gallo },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.gallo },
    ],
  },
  {
    ids: ["cda3970d-6cbd-4caa-9d80-968b74a0244f"],
    seasonKey: "matias-alemanno",
    name: "Matías Alemanno",
    fullName: "Matías Alemanno",
    wikipediaUrl: WIKI.alemanno,
    birthDate: "1991-12-05",
    birthPlace: "Córdoba, Argentina",
    heightCm: 198,
    weightKg: 117,
    clubName: "Vannes",
    clubTeamSlug: "vannes",
    positionName: "lock",
    positions: ["lock"],
    bioSummary:
      "Los Pumas lock who joined Rugby Club Vannes from Gloucester in June 2026. Test debut against Uruguay on 17 May 2014. Rugby World Cup squad member in 2015 (fourth place), 2019 and 2023 (fourth place). Product of La Tablada. Reached 100 Test appearances for Argentina in July 2026. English Wikipedia and All.Rugby still list Gloucester as his club.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/ALEMANNO-1.png",
    imageAlt: "Matías Alemanno, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/jugadores/alemanno-matias/",
    caps: 100,
    tries: 6,
    points: 30,
    intlYearsLabel: "2014–present",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2015, sourceUrl: WIKI.alemanno },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2015, sourceUrl: WIKI.alemanno },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.alemanno },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.alemanno },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.alemanno },
    ],
  },
  {
    ids: ["bb3a5f56-62f7-40a4-8a96-db8dfc79992e"],
    seasonKey: "rodrigo-bruni",
    name: "Rodrigo Bruni",
    fullName: "Rodrigo Bruni Pleininger",
    wikipediaUrl: WIKI.bruni,
    birthDate: "1993-09-03",
    birthPlace: "Tandil, Argentina",
    heightCm: 187,
    weightKg: 111,
    clubName: "Aviron Bayonnais",
    clubTeamSlug: "aviron-bayonnais",
    positionName: "number 8",
    positions: ["number 8", "flanker"],
    bioSummary:
      "Argentina number 8 and flanker for Aviron Bayonnais through 2027. Test debut in 2018. Rugby World Cup squad member in 2019 and 2023 (Argentina finished fourth). Previously played for Jaguares, Vannes and Brive. Not listed in the current Los Pumas plantel and was not selected for the 2026 Nations Championship.",
    imageUrl: "https://www.lospumas.com.ar/wp-content/uploads/BRUNI-3.png",
    imageAlt: "Rodrigo Bruni, Argentina headshot",
    imageSourcePage: "https://www.lospumas.com.ar/",
    caps: 26,
    tries: 2,
    points: 10,
    intlYearsLabel: "2018–present",
    titles: [
      { titleType: "other", title: "Rugby World Cup appearance", year: 2019, sourceUrl: WIKI.bruni },
      { titleType: "other", title: "Rugby World Cup appearance", year: 2023, sourceUrl: WIKI.bruni },
      { titleType: "other", title: "Rugby World Cup fourth place", year: 2023, sourceUrl: WIKI.bruni },
    ],
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
