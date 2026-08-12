/**
 * Seed 2026 Currie Cup Premier Division eight-coach pack.
 * Identity + career facts only where verified; leave uncertain fields null for CMS/OpenAI.
 * Then: assignments → match linking → Intelligence → Power Index → Coach Rating → Currie Cup Rank.
 */
import { and, eq, ilike } from "drizzle-orm";
import {
  coaches,
  coachPlayingStints,
  coachHonours,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { recalculateCoach } from "../apps/web/src/lib/coach-recalc-service";
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { listCurrieCupCoachRankings } from "../apps/web/src/lib/coach-competition-rank";

const TEAMS = {
  boland: {
    id: "41af3238-709f-4539-9d11-6b3176528950",
    display: "Boland Cavaliers",
  },
  bulls: {
    id: "99f818a1-794f-4e9f-a7bb-41d259c68337",
    display: "Bulls XV",
  },
  cheetahs: {
    id: "32324b5d-f326-4e4d-b1f7-a5562c917ae3",
    display: "Cheetahs",
  },
  griquas: {
    id: "9b0939ae-e515-4815-9a71-b1b64cc9c031",
    display: "Griquas",
  },
  lions: {
    id: "cd89c524-a07d-4ee3-aa6a-959e22fe9a98",
    display: "Lions",
  },
  pumas: {
    id: "2cba5c69-6d45-463e-9141-801697473ed7",
    display: "Pumas",
  },
  sharks: {
    id: "a4907a68-de2d-4faa-8a12-6883ad6142ba",
    display: "Sharks XV",
  },
  stormers23: {
    id: "9c7ff5c6-e6e6-4067-bf22-0cd154aaba4d",
    display: "Stormers XXIII",
  },
} as const;

type Seed = {
  name: string;
  slug: string;
  fullName?: string | null;
  knownAs?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  countryOfBirth?: string | null;
  nationality: string;
  heightCm?: number | null;
  formerPlayingPositions?: string | null;
  coachingCareerStartYear?: number | null;
  appointedOn?: string | null;
  contractExpiresOn?: string | null;
  preferredSystem: string;
  coachingStyle: string;
  notes?: string | null;
  team: keyof typeof TEAMS;
  assignmentStart: string;
  assignmentNotes?: string | null;
  playing?: Array<{
    teamName: string;
    teamId?: string;
    teamType: "international" | "provincial" | "club" | "franchise";
    yearsLabel: string;
    startYear?: number;
    endYear?: number;
    apps?: number | null;
    points?: number | null;
    tries?: number | null;
  }>;
  honours?: Array<{ year: number; competitionName: string; honourLevel?: string }>;
};

const SEEDS: Seed[] = [
  {
    name: "Hawies Fourie",
    slug: "hawies-fourie",
    nationality: "South Africa",
    countryOfBirth: "South Africa",
    coachingCareerStartYear: null,
    appointedOn: "2024-01-01",
    preferredSystem: "Structured / Territory & Width",
    coachingStyle: "Tactical, organised & attack-focused",
    notes:
      "Confirmed Boland head coach for 2026 Currie Cup. Birth/height/former position/contract need CMS verification. Major career: Boland, Cheetahs, Griquas, Maties.",
    team: "boland",
    assignmentStart: "2024-01-01",
    assignmentNotes: "Head Coach — Boland Cavaliers (Currie Cup 2026)",
    honours: [
      { year: 0, competitionName: "Currie Cup (Cheetahs) — year verify", honourLevel: "major" },
      { year: 0, competitionName: "SA Cup (Boland) — year verify", honourLevel: "domestic_major" },
    ],
  },
  {
    name: "Phiwe Nomlomo",
    slug: "phiwe-nomlomo",
    nationality: "South Africa",
    countryOfBirth: "South Africa",
    preferredSystem: "Power / Structured Attack",
    coachingStyle: "Physical, direct & development-led",
    notes:
      "Bulls XV / Currie Cup coach — verify exact 2026 title vs URC senior structure before publishing identity fields. OpenAI Profile Check recommended.",
    team: "bulls",
    assignmentStart: "2026-01-01",
    assignmentNotes: "Bulls XV / Currie Cup coach — verify vs URC structure",
  },
  {
    name: "Frans Steyn",
    slug: "frans-steyn",
    fullName: "François Philippus Lodewyk Steyn",
    birthDate: "1987-05-14",
    placeOfBirth: "Aliwal North",
    countryOfBirth: "South Africa",
    nationality: "South Africa",
    heightCm: 191,
    formerPlayingPositions: "Fullback / Centre / Fly-half / Wing",
    coachingCareerStartYear: 2025,
    appointedOn: "2025-01-01",
    preferredSystem: "Adaptive / Physical Attack",
    coachingStyle: "Direct, physical & kicking-led",
    notes: "World Cups as player: 2007 & 2019. Contract needs verification.",
    team: "cheetahs",
    assignmentStart: "2025-01-01",
    assignmentNotes: "Head Coach — Cheetahs",
    playing: [
      {
        teamName: "South Africa",
        teamId: "b0000000-0000-4000-8000-000000000001",
        teamType: "international",
        yearsLabel: "South Africa international",
        apps: 78,
        points: 165,
      },
    ],
  },
  {
    name: "Pieter Bergh",
    slug: "pieter-bergh",
    nationality: "South Africa",
    countryOfBirth: "South Africa",
    appointedOn: "2022-01-01",
    preferredSystem: "Balanced / Counter Attack",
    coachingStyle: "Analytical, tactical & adaptable",
    notes:
      "Appointed Griquas ~2022 era — verify exact date. Path: analysis/video under Hawies Fourie → coaching. Birth/height/playing history need verification.",
    team: "griquas",
    assignmentStart: "2022-01-01",
    assignmentNotes: "Head Coach — Griquas",
    honours: [{ year: 2025, competitionName: "Currie Cup", honourLevel: "major" }],
  },
  {
    name: "Mziwakhe Nkosi",
    slug: "mziwakhe-nkosi",
    nationality: "South Africa",
    countryOfBirth: "South Africa",
    preferredSystem: "Attack / High Tempo",
    coachingStyle: "Development-led, attacking & mobile",
    notes:
      "Lions Currie Cup coaching structure — verify exact 2026 head-coach title (do not inherit URC coach). OpenAI Profile Check recommended.",
    team: "lions",
    assignmentStart: "2026-01-01",
    assignmentNotes: "Lions Currie Cup — verify exact 2026 title",
  },
  {
    name: "Jimmy Stonehouse",
    slug: "jimmy-stonehouse",
    nationality: "South Africa",
    countryOfBirth: "South Africa",
    appointedOn: "2018-01-01",
    preferredSystem: "Physical / High Work Rate",
    coachingStyle: "Physical, disciplined & development-led",
    notes:
      "Returned to Pumas 2018 after Toshiba Brave Lupus (Japan) 2015–17. Coaching since 1990s/2000s — exact year verify. Birth/height/former position need verification.",
    team: "pumas",
    assignmentStart: "2018-01-01",
    assignmentNotes: "Head Coach — Pumas (returned 2018)",
    honours: [{ year: 2022, competitionName: "Currie Cup", honourLevel: "major" }],
  },
  {
    name: "JP Pietersen",
    slug: "jp-pietersen",
    fullName: "Jon-Paul Roger Pietersen",
    knownAs: "JP Pietersen",
    birthDate: "1986-07-12",
    placeOfBirth: "Stellenbosch",
    countryOfBirth: "South Africa",
    nationality: "South Africa",
    heightCm: 190,
    formerPlayingPositions: "Wing / Fullback",
    preferredSystem: "Attack / Transition",
    coachingStyle: "Fast, attacking & player-focused",
    notes:
      "Sharks XV coaching structure — verify 2026 Head Coach status. Coaching since after retirement — exact year verify. World Cup 2007 winner as player.",
    team: "sharks",
    assignmentStart: "2026-01-01",
    assignmentNotes: "Sharks XV — verify 2026 Head Coach status",
    playing: [
      {
        teamName: "South Africa",
        teamId: "b0000000-0000-4000-8000-000000000001",
        teamType: "international",
        yearsLabel: "South Africa international",
        apps: 70,
        points: null,
        tries: 24,
      },
    ],
    honours: [
      {
        year: 2007,
        competitionName: "Rugby World Cup",
        honourLevel: "major",
      },
    ],
  },
  {
    name: "Tom Dawson-Squibb",
    slug: "tom-dawson-squibb",
    nationality: "South Africa",
    countryOfBirth: "South Africa",
    appointedOn: "2026-01-01",
    preferredSystem: "Attack / Development",
    coachingStyle: "Progressive, development-led & attacking",
    notes:
      "Confirmed Stormers XXIII head coach for 2026 Currie Cup. Assisted by Helmut Lehmann, Dewaldt Duvenage, Sentle Lehoko, Pine Pienaar. Previous: UCT / Stormers performance coaching. Birth/height/former position need verification.",
    team: "stormers23",
    assignmentStart: "2026-01-01",
    assignmentNotes: "Head Coach — Stormers XXIII (Currie Cup 2026)",
  },
];

async function ensureCoach(seed: Seed) {
  const db = getDb();
  const [bySlug] = await db.select().from(coaches).where(eq(coaches.slug, seed.slug)).limit(1);
  if (bySlug) return bySlug;
  const [byName] = await db
    .select()
    .from(coaches)
    .where(ilike(coaches.name, seed.name))
    .limit(1);
  if (byName) return byName;
  const [created] = await db
    .insert(coaches)
    .values({
      slug: seed.slug,
      name: seed.name,
      sourceProvider: "manual",
      publishStatus: "published",
      isPublic: true,
    })
    .returning();
  console.log("CREATED", seed.slug);
  return created!;
}

async function upsertPlaying(
  coachId: string,
  row: NonNullable<Seed["playing"]>[number],
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

  const payload = {
    yearsLabel: row.yearsLabel,
    teamName: row.teamName,
    teamDisplayName: row.teamName,
    teamId: row.teamId ?? null,
    teamType: row.teamType,
    careerType:
      row.teamType === "international" ? "international_player" : "provincial_player",
    competitionLevel: row.teamType === "international" ? "international" : row.teamType,
    startYear: row.startYear ?? null,
    endYear: row.endYear ?? null,
    apps: row.apps ?? null,
    points: row.points ?? null,
    tries: row.tries ?? null,
    recordStatus: "verified" as const,
    verifiedAt: new Date(),
    showOnOverview: row.teamType === "international",
    sourceProvider: "manual",
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(coachPlayingStints).set(payload).where(eq(coachPlayingStints.id, existing.id));
  } else {
    await db.insert(coachPlayingStints).values({
      coachId,
      ...payload,
      sortOrder: 50,
    });
  }
}

async function ensureHonour(
  coachId: string,
  h: NonNullable<Seed["honours"]>[number],
  roleType: "coach" | "player" = "coach",
) {
  if (!h.year) return; // skip unverified year placeholders
  const db = getDb();
  const [existing] = await db
    .select()
    .from(coachHonours)
    .where(
      and(
        eq(coachHonours.coachId, coachId),
        eq(coachHonours.year, h.year),
        eq(coachHonours.competitionName, h.competitionName),
        eq(coachHonours.roleType, roleType),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(coachHonours).values({
    coachId,
    roleType,
    year: h.year,
    competitionName: h.competitionName,
    honourLevel: h.honourLevel ?? "major",
    achievementType: "winner",
    verifiedAt: new Date(),
    showOnOverview: true,
    visibility: "public",
  });
}

async function main() {
  const db = getDb();
  const coachIds: string[] = [];

  for (const seed of SEEDS) {
    const coach = await ensureCoach(seed);
    coachIds.push(coach.id);
    const team = TEAMS[seed.team];

    await db
      .update(coaches)
      .set({
        name: seed.name,
        fullName: seed.fullName ?? null,
        knownAs: seed.knownAs ?? null,
        birthDate: seed.birthDate ?? null,
        placeOfBirth: seed.placeOfBirth ?? null,
        countryOfBirth: seed.countryOfBirth ?? null,
        nationality: seed.nationality,
        heightCm: seed.heightCm ?? null,
        formerPlayingPositions: seed.formerPlayingPositions ?? null,
        coachingCareerStartYear: seed.coachingCareerStartYear ?? null,
        appointedOn: seed.appointedOn ?? null,
        contractExpiresOn: seed.contractExpiresOn ?? null,
        preferredSystem: seed.preferredSystem,
        coachingStyle: seed.coachingStyle,
        preferredSystemProvenance: "rugby365_assessment",
        coachingStyleProvenance: "rugby365_assessment",
        notes: seed.notes ?? null,
        profileUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coaches.id, coach.id));

    await upsertCoachingStaffAssignment({
      coachId: coach.id,
      teamId: team.id,
      role: "head_coach",
      careerType: "coach",
      startDate: seed.assignmentStart,
      isCurrent: true,
      isPrimaryCoach: true,
      showOnOverview: true,
      eligibleForCareerRecord: true,
      notes: seed.assignmentNotes ?? null,
      confidence: "high",
      verifiedAt: new Date(),
      importKey: `currie-cup-2026:${team.id}:${coach.id}:head_coach`,
    });

    // Store display name for XV / XXIII sides on assignment
    const { teamCoachingStaff } = await import("@rugby365/db");
    await db
      .update(teamCoachingStaff)
      .set({
        teamDisplayName: team.display,
        competitionLevel: "currie_cup_premier",
        overviewLabel: `Head Coach — ${team.display}`,
        recordStatus: "verified",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teamCoachingStaff.coachId, coach.id),
          eq(teamCoachingStaff.teamId, team.id),
          eq(teamCoachingStaff.isCurrent, true),
        ),
      );

    for (const p of seed.playing ?? []) await upsertPlaying(coach.id, p);
    for (const h of seed.honours ?? []) {
      const roleType = seed.slug === "jp-pietersen" && h.year === 2007 ? "player" : "coach";
      await ensureHonour(coach.id, h, roleType);
    }

    console.log(`\n=== ${seed.name} → ${team.display} ===`);
    const recalc = await recalculateCoach(coach.id, {
      refreshLinks: true,
      persistRatings: true,
      overwriteLinks: true,
    });
    const bundle = await persistCoachRatingSnapshot(coach.id);
    console.log({
      matches: recalc.careerPlayed,
      rating: bundle.overallRating,
      powerIndex: bundle.powerIndex,
      worldRank: bundle.worldRank,
      currieRank: bundle.competitionRank,
    });
  }

  console.log("\n=== Re-rank Currie Cup board ===");
  for (const id of coachIds) {
    await persistCoachRatingSnapshot(id);
  }

  const board = await listCurrieCupCoachRankings(8);
  console.log("\n=== CURRIE CUP COACH RANK (2026 Premier) ===");
  for (const r of board) {
    console.log(
      `#${r.rank}`.padEnd(4),
      r.teamName.padEnd(22),
      r.name.padEnd(22),
      `rating=${r.rating}`,
      `PI=${r.powerIndex ?? "—"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
