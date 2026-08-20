/**
 * Seed / update 12 Nations Championship coaches with provided CMS identity data,
 * playing career facts, current national assignments — then recalculate ratings.
 *
 * Does NOT invent Rating / Power Index / ranks — those come from recalculateCoach.
 */
import { and, eq, ilike } from "drizzle-orm";
import {
  coaches,
  teams,
  coachPlayingStints,
  coachHonours,
  coachAwards,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { recalculateCoach } from "../apps/web/src/lib/coach-recalc-service";
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";

const NATIONS: Record<string, string> = {
  "South Africa": "b0000000-0000-4000-8000-000000000001",
  England: "2cbe38e3-ca15-40b2-934f-41035f441eb9",
  France: "d265767d-de1a-41b7-a6eb-aeaadce5223f",
  Ireland: "159c5f8f-0a54-449f-8314-62b8bf01af18",
  Scotland: "f2cdefa6-2a24-4c66-bc66-09272cb90c2b",
  Wales: "948ac092-4741-43cd-b04d-df0ca3f42c94",
  Italy: "07f9d5f9-1e30-4823-a791-c4837cea6fbb",
  "New Zealand": "785844d7-ca82-4044-8f98-30f20c7fbcd9",
  Australia: "41c4b0e3-88ca-4201-840c-982d22bd68e8",
  Argentina: "0ab14ea7-d26b-4bc4-b21d-6ebb6728c43c",
  Japan: "0505bb04-37b2-4d6c-89b8-78808249e34a",
  Fiji: "5c77b332-eab7-43ba-9177-2ee1bbd82bb5",
};

type Seed = {
  match: { slug?: string; name?: string };
  createIfMissing?: { slug: string; name: string };
  profile: {
    fullName: string;
    knownAs?: string | null;
    birthDate: string;
    placeOfBirth: string;
    countryOfBirth: string;
    nationality: string;
    heightCm: number | null;
    formerPlayingPositions: string;
    coachingCareerStartYear: number | null;
    appointedOn: string | null;
    contractExpiresOn: string | null;
    preferredSystem: string;
    coachingStyle: string;
    notes?: string | null;
  };
  nation: keyof typeof NATIONS;
  assignment: {
    startDate: string;
    endDate?: string | null;
    notes?: string | null;
    role?: string;
  };
  playing: Array<{
    teamName: string;
    teamId?: string;
    teamType: "international" | "provincial" | "club" | "franchise";
    yearsLabel: string;
    startYear?: number;
    endYear?: number;
    apps?: number | null;
    points?: number | null;
    notes?: string;
  }>;
  honours?: Array<{
    year: number;
    competitionName: string;
    honourLevel: string;
    achievementType?: string;
  }>;
  awards?: Array<{
    year: number;
    awardName: string;
    awardingBody?: string;
  }>;
};

const SEEDS: Seed[] = [
  {
    match: { slug: "rassie-erasmus" },
    nation: "South Africa",
    profile: {
      fullName: "Johan Erasmus",
      knownAs: "Rassie",
      birthDate: "1972-11-05",
      placeOfBirth: "Despatch",
      countryOfBirth: "South Africa",
      nationality: "South Africa",
      heightCm: 191,
      formerPlayingPositions: "Flanker / No. 8",
      coachingCareerStartYear: 2004,
      appointedOn: "2018-03-01",
      contractExpiresOn: "2031-12-31",
      preferredSystem: "Adaptive / Hybrid",
      coachingStyle: "Structured & Innovative",
      notes: "Appointed SA Head Coach 2018; returned 2024. Contract through 2031.",
    },
    assignment: {
      startDate: "2018-03-01",
      notes: "Head Coach 2018; returned 2024",
    },
    playing: [
      {
        teamName: "South Africa",
        teamId: NATIONS["South Africa"],
        teamType: "international",
        yearsLabel: "1997–2001",
        startYear: 1997,
        endYear: 2001,
        apps: 36,
        points: 35,
      },
    ],
    honours: [
      { year: 2019, competitionName: "Rugby World Cup", honourLevel: "major" },
      { year: 2023, competitionName: "Rugby World Cup", honourLevel: "major" },
      { year: 2019, competitionName: "The Rugby Championship", honourLevel: "major" },
      { year: 2024, competitionName: "The Rugby Championship", honourLevel: "major" },
      { year: 2025, competitionName: "The Rugby Championship", honourLevel: "major" },
    ],
    awards: [
      {
        year: 2019,
        awardName: "World Rugby Coach of the Year",
        awardingBody: "World Rugby",
      },
    ],
  },
  {
    match: { slug: "steve-borthwick-coach519" },
    nation: "England",
    profile: {
      fullName: "Stephen William Borthwick",
      knownAs: "Steve Borthwick",
      birthDate: "1979-10-12",
      placeOfBirth: "Carlisle",
      countryOfBirth: "England",
      nationality: "England",
      heightCm: 198,
      formerPlayingPositions: "Lock",
      coachingCareerStartYear: 2012,
      appointedOn: "2022-12-19",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Structured / Territory-led",
      coachingStyle: "Set-piece & tactical control",
      notes: "Former England captain.",
    },
    assignment: { startDate: "2022-12-19" },
    playing: [
      {
        teamName: "England",
        teamId: NATIONS.England,
        teamType: "international",
        yearsLabel: "England international",
        apps: 57,
        points: 10,
      },
    ],
  },
  {
    match: { slug: "fabien-galthie-coach162" },
    nation: "France",
    profile: {
      fullName: "Fabien Galthié",
      knownAs: null,
      birthDate: "1969-03-20",
      placeOfBirth: "Cahors",
      countryOfBirth: "France",
      nationality: "France",
      heightCm: 175,
      formerPlayingPositions: "Scrum-half",
      coachingCareerStartYear: 2004,
      appointedOn: "2019-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "High-tempo / Hybrid",
      coachingStyle: "Attack-led & analytical",
      notes: "Appointed France 2019; Head Coach from 2020. Former France captain.",
    },
    assignment: {
      startDate: "2020-01-01",
      notes: "Appointed 2019 / Head Coach from 2020",
    },
    playing: [
      {
        teamName: "France",
        teamId: NATIONS.France,
        teamType: "international",
        yearsLabel: "France international",
        apps: 64,
        points: 49,
      },
    ],
  },
  {
    match: { slug: "andy-farrell-coach160" },
    nation: "Ireland",
    profile: {
      fullName: "Andrew David Farrell",
      knownAs: "Andy Farrell",
      birthDate: "1975-05-30",
      placeOfBirth: "Wigan",
      countryOfBirth: "England",
      nationality: "England",
      heightCm: 193,
      formerPlayingPositions: "Centre / Loose Forward – Rugby League & Union",
      coachingCareerStartYear: 2011,
      appointedOn: "2019-01-01",
      contractExpiresOn: "2031-12-31",
      preferredSystem: "Adaptive / Multi-phase",
      coachingStyle: "Physical, connected & possession-led",
    },
    assignment: { startDate: "2019-01-01" },
    playing: [
      {
        teamName: "England",
        teamId: NATIONS.England,
        teamType: "international",
        yearsLabel: "England RU",
        apps: 8,
        points: null,
        notes: "Rugby Union caps",
      },
    ],
  },
  {
    match: { slug: "gregor-townsend-coach161" },
    nation: "Scotland",
    profile: {
      fullName: "Gregor Peter John Townsend",
      knownAs: null,
      birthDate: "1973-04-26",
      placeOfBirth: "Galashiels",
      countryOfBirth: "Scotland",
      nationality: "Scotland",
      heightCm: 183,
      formerPlayingPositions: "Fly-half / Centre / Fullback",
      coachingCareerStartYear: 2005,
      appointedOn: "2017-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Attack / Width",
      coachingStyle: "Creative & attacking",
      notes: "Player-coach from 2005/06; full coaching thereafter. Lions caps: 2.",
    },
    assignment: { startDate: "2017-01-01" },
    playing: [
      {
        teamName: "Scotland",
        teamId: NATIONS.Scotland,
        teamType: "international",
        yearsLabel: "Scotland international",
        apps: 82,
        points: 164,
      },
    ],
  },
  {
    match: { name: "Steve Tandy" },
    createIfMissing: { slug: "steve-tandy", name: "Steve Tandy" },
    nation: "Wales",
    profile: {
      fullName: "Steve Tandy",
      knownAs: null,
      birthDate: "1980-01-16",
      placeOfBirth: "Tonmawr",
      countryOfBirth: "Wales",
      nationality: "Wales",
      heightCm: 184,
      formerPlayingPositions: "Flanker",
      coachingCareerStartYear: 2010,
      appointedOn: "2025-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Defence / Transition",
      coachingStyle: "Defence-led & physical",
      notes: "Contract through 2027 World Cup. Wales caps: 0.",
    },
    assignment: { startDate: "2025-01-01", notes: "Through 2027 World Cup" },
    playing: [
      {
        teamName: "Wales",
        teamId: NATIONS.Wales,
        teamType: "international",
        yearsLabel: "Wales",
        apps: 0,
        points: 0,
      },
      {
        teamName: "Ospreys",
        teamType: "franchise",
        yearsLabel: "Ospreys",
        apps: 102,
      },
      {
        teamName: "Neath",
        teamType: "provincial",
        yearsLabel: "Neath",
        apps: 74,
      },
    ],
  },
  {
    match: { name: "Gonzalo Quesada" },
    createIfMissing: { slug: "gonzalo-quesada", name: "Gonzalo Quesada" },
    nation: "Italy",
    profile: {
      fullName: "Gonzalo Quesada",
      knownAs: null,
      birthDate: "1974-05-02",
      placeOfBirth: "Buenos Aires",
      countryOfBirth: "Argentina",
      nationality: "Argentina",
      heightCm: 183,
      formerPlayingPositions: "Fly-half",
      coachingCareerStartYear: 2008,
      appointedOn: "2024-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Structured / Tactical",
      coachingStyle: "Tactical & defence-conscious",
    },
    assignment: { startDate: "2024-01-01" },
    playing: [
      {
        teamName: "Argentina",
        teamId: NATIONS.Argentina,
        teamType: "international",
        yearsLabel: "Argentina international",
        apps: 38,
        points: 486,
      },
    ],
  },
  {
    match: { name: "Dave Rennie" },
    createIfMissing: { slug: "dave-rennie", name: "Dave Rennie" },
    nation: "New Zealand",
    profile: {
      fullName: "David Noel Rennie",
      knownAs: "Dave Rennie",
      birthDate: "1963-11-22",
      placeOfBirth: "Upper Hutt",
      countryOfBirth: "New Zealand",
      nationality: "New Zealand",
      heightCm: 189,
      formerPlayingPositions: "Centre / Wing",
      coachingCareerStartYear: 1999,
      appointedOn: "2026-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Adaptive / High-tempo",
      coachingStyle: "Attack-led & player-focused",
      notes: "Cook Islands XV: 1 appearance.",
    },
    assignment: { startDate: "2026-01-01" },
    playing: [
      {
        teamName: "Wellington",
        teamType: "provincial",
        yearsLabel: "Wellington",
        apps: 58,
      },
    ],
  },
  {
    match: { name: "Les Kiss" },
    createIfMissing: { slug: "les-kiss", name: "Les Kiss" },
    nation: "Australia",
    profile: {
      fullName: "Les Kiss",
      knownAs: null,
      birthDate: "1964-12-09",
      placeOfBirth: "Bundaberg, Queensland",
      countryOfBirth: "Australia",
      nationality: "Australia",
      heightCm: null,
      formerPlayingPositions: "Winger – Rugby League",
      coachingCareerStartYear: 1995,
      appointedOn: "2026-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Adaptive / Transition",
      coachingStyle: "Defensive structure & counter-attack",
      notes:
        "Height needs verification. Australia RL Tests: 4. Rugby Union playing career: None.",
    },
    assignment: { startDate: "2026-01-01" },
    playing: [],
  },
  {
    match: { slug: "felipe-contepomi" },
    nation: "Argentina",
    profile: {
      fullName: "Felipe Contepomi",
      knownAs: null,
      birthDate: "1977-08-20",
      placeOfBirth: "Buenos Aires",
      countryOfBirth: "Argentina",
      nationality: "Argentina",
      heightCm: 183,
      formerPlayingPositions: "Fly-half / Centre",
      coachingCareerStartYear: 2015,
      appointedOn: "2023-12-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "Attack / Transition",
      coachingStyle: "Fast, aggressive & expressive",
      notes: "Appointed Dec 2023 / first season 2024. Former Argentina captain. Through 2027 cycle.",
    },
    assignment: {
      startDate: "2023-12-01",
      notes: "First season 2024; through 2027 cycle",
    },
    playing: [
      {
        teamName: "Argentina",
        teamId: NATIONS.Argentina,
        teamType: "international",
        yearsLabel: "Argentina international",
        apps: 87,
        points: 651,
      },
    ],
  },
  {
    match: { slug: "eddie-jones" },
    nation: "Japan",
    profile: {
      fullName: "Edward Jones",
      knownAs: "Eddie Jones",
      birthDate: "1960-01-30",
      placeOfBirth: "Burnie, Tasmania",
      countryOfBirth: "Australia",
      nationality: "Australia",
      heightCm: 173,
      formerPlayingPositions: "Hooker",
      coachingCareerStartYear: 1994,
      appointedOn: "2024-01-01",
      contractExpiresOn: "2027-12-31",
      preferredSystem: "High-tempo / Attack",
      coachingStyle: "Fast, tactical & disruptive",
      notes: "Height approx. 1.73m — verify before publishing. Australia caps: 0.",
    },
    assignment: { startDate: "2024-01-01" },
    playing: [
      {
        teamName: "Australia",
        teamId: NATIONS.Australia,
        teamType: "international",
        yearsLabel: "Australia",
        apps: 0,
        points: 0,
      },
    ],
  },
  {
    match: { name: "Senirusi Seruvakula" },
    createIfMissing: { slug: "senirusi-seruvakula", name: "Senirusi Seruvakula" },
    nation: "Fiji",
    profile: {
      fullName: "Senirusi Seruvakula",
      knownAs: null,
      birthDate: "1969-11-12",
      placeOfBirth: "Fiji",
      countryOfBirth: "Fiji",
      nationality: "Fiji",
      heightCm: null,
      formerPlayingPositions: "Flanker",
      coachingCareerStartYear: 2008,
      appointedOn: "2026-01-01",
      contractExpiresOn: null,
      preferredSystem: "Attack / Offload",
      coachingStyle: "Physical, direct & expressive",
      notes:
        "Interim Fiji coach 2026 — contract not confirmed. Birthplace exact place needs verification. Height needs verification. Coaching history from at least Naitasiri and 2015 Fiji Warriors.",
    },
    assignment: {
      startDate: "2026-01-01",
      role: "interim_head_coach",
      notes: "Interim / not confirmed",
    },
    playing: [
      {
        teamName: "Fiji",
        teamId: NATIONS.Fiji,
        teamType: "international",
        yearsLabel: "Fiji international",
        apps: 1,
        points: 0,
      },
    ],
  },
];

async function findCoach(seed: Seed) {
  const db = getDb();
  if (seed.match.slug) {
    const [bySlug] = await db
      .select()
      .from(coaches)
      .where(eq(coaches.slug, seed.match.slug))
      .limit(1);
    if (bySlug) return bySlug;
  }
  if (seed.match.name) {
    const [byName] = await db
      .select()
      .from(coaches)
      .where(ilike(coaches.name, seed.match.name))
      .limit(1);
    if (byName) return byName;
  }
  return null;
}

async function ensureCoach(seed: Seed) {
  const db = getDb();
  let coach = await findCoach(seed);
  if (!coach && seed.createIfMissing) {
    const [created] = await db
      .insert(coaches)
      .values({
        slug: seed.createIfMissing.slug,
        name: seed.createIfMissing.name,
        sourceProvider: "manual",
        publishStatus: "published",
        isPublic: true,
      })
      .returning();
    coach = created!;
    console.log("CREATED", coach.slug);
  }
  if (!coach) throw new Error(`Coach not found: ${JSON.stringify(seed.match)}`);
  return coach;
}

async function upsertPlaying(
  coachId: string,
  row: Seed["playing"][number],
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(coachPlayingStints)
    .where(
      and(
        eq(coachPlayingStints.coachId, coachId),
        eq(coachPlayingStints.teamName, row.teamName),
        eq(coachPlayingStints.teamType, row.teamType),
      ),
    )
    .limit(1);

  const careerType =
    row.teamType === "international"
      ? "international_player"
      : row.teamType === "franchise"
        ? "super_rugby_player"
        : row.teamType === "club"
          ? "club_player"
          : "provincial_player";

  const payload = {
    yearsLabel: row.yearsLabel,
    teamName: row.teamName,
    teamDisplayName: row.teamName,
    teamId: row.teamId ?? null,
    teamType: row.teamType,
    careerType,
    competitionLevel:
      row.teamType === "international"
        ? "international"
        : row.teamType === "franchise"
          ? "super_rugby"
          : row.teamType,
    startYear: row.startYear ?? null,
    endYear: row.endYear ?? null,
    apps: row.apps ?? null,
    points: row.points ?? null,
    recordStatus: "verified" as const,
    verifiedAt: new Date(),
    showOnOverview: row.teamType === "international",
    sourceProvider: "manual",
    editorNotes: row.notes ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(coachPlayingStints)
      .set(payload)
      .where(eq(coachPlayingStints.id, existing.id));
  } else {
    await db.insert(coachPlayingStints).values({
      coachId,
      ...payload,
      sortOrder: row.teamType === "international" ? 50 : 20,
    });
  }
}

async function ensureHonour(
  coachId: string,
  h: NonNullable<Seed["honours"]>[number],
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(coachHonours)
    .where(
      and(
        eq(coachHonours.coachId, coachId),
        eq(coachHonours.year, h.year),
        eq(coachHonours.competitionName, h.competitionName),
        eq(coachHonours.roleType, "coach"),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(coachHonours).values({
    coachId,
    roleType: "coach",
    year: h.year,
    competitionName: h.competitionName,
    honourLevel: h.honourLevel,
    achievementType: h.achievementType ?? "winner",
    verifiedAt: new Date(),
    showOnOverview: true,
    visibility: "public",
  });
}

async function ensureAward(
  coachId: string,
  a: NonNullable<Seed["awards"]>[number],
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(coachAwards)
    .where(
      and(
        eq(coachAwards.coachId, coachId),
        eq(coachAwards.year, a.year),
        eq(coachAwards.awardName, a.awardName),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(coachAwards).values({
    coachId,
    year: a.year,
    awardName: a.awardName,
    awardingBody: a.awardingBody ?? null,
    result: "winner",
    isMajor: true,
  });
}

async function main() {
  const db = getDb();
  const results: Array<{
    slug: string;
    id: string;
    nation: string;
    careerPlayed: number;
    ratingsPersisted: boolean;
    powerIndex: number | null;
    overall: number | null;
    worldRank: number | null;
  }> = [];

  for (const seed of SEEDS) {
    const coach = await ensureCoach(seed);
    const p = seed.profile;

    await db
      .update(coaches)
      .set({
        fullName: p.fullName,
        knownAs: p.knownAs ?? null,
        birthDate: p.birthDate,
        placeOfBirth: p.placeOfBirth,
        countryOfBirth: p.countryOfBirth,
        nationality: p.nationality,
        heightCm: p.heightCm,
        formerPlayingPositions: p.formerPlayingPositions,
        coachingCareerStartYear: p.coachingCareerStartYear,
        appointedOn: p.appointedOn,
        contractExpiresOn: p.contractExpiresOn,
        preferredSystem: p.preferredSystem,
        coachingStyle: p.coachingStyle,
        preferredSystemProvenance: "rugby365_assessment",
        coachingStyleProvenance: "rugby365_assessment",
        notes: p.notes ?? null,
        profileUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coaches.id, coach.id));

    const teamId = NATIONS[seed.nation];
    await upsertCoachingStaffAssignment({
      coachId: coach.id,
      teamId,
      role: seed.assignment.role ?? "head_coach",
      careerType: "coach",
      startDate: seed.assignment.startDate,
      endDate: seed.assignment.endDate ?? null,
      isCurrent: true,
      isPrimaryCoach: true,
      showOnOverview: true,
      eligibleForCareerRecord: true,
      notes: seed.assignment.notes ?? null,
      confidence: "high",
      verifiedAt: new Date(),
      importKey: `${teamId}:${coach.id}:head_coach:current`,
    });

    for (const play of seed.playing) {
      await upsertPlaying(coach.id, play);
    }
    for (const h of seed.honours ?? []) {
      await ensureHonour(coach.id, h);
    }
    for (const a of seed.awards ?? []) {
      await ensureAward(coach.id, a);
    }

    console.log(`\n=== ${coach.name} (${seed.nation}) ===`);
    const recalc = await recalculateCoach(coach.id, {
      refreshLinks: true,
      persistRatings: true,
      overwriteLinks: true,
    });
    // Always persist rating snapshot so peers enter world rank even with sparse matches
    const bundle = await persistCoachRatingSnapshot(coach.id);
    results.push({
      slug: coach.slug,
      id: coach.id,
      nation: seed.nation,
      careerPlayed: recalc.careerPlayed,
      ratingsPersisted: recalc.ratingsPersisted || true,
      powerIndex: bundle.powerIndex,
      overall: bundle.overallRating,
      worldRank: bundle.worldRank,
    });
    console.log({
      matches: recalc.careerPlayed,
      overall: bundle.overallRating,
      powerIndex: bundle.powerIndex,
      worldRank: bundle.worldRank,
      status: recalc.status,
    });
  }

  console.log("\n=== BATCH SUMMARY ===");
  for (const r of results.sort((a, b) => (a.worldRank ?? 999) - (b.worldRank ?? 999))) {
    console.log(
      `#${r.worldRank ?? "—"}`.padEnd(4),
      r.nation.padEnd(14),
      `rating=${r.overall ?? "—"}`.padEnd(14),
      `PI=${r.powerIndex ?? "—"}`.padEnd(10),
      `matches=${r.careerPlayed}`,
      r.slug,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
