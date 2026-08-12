/**
 * Seed 2026/27 PREM senior rugby leaders (10 clubs).
 * Roles: Head Coach / Head of Rugby / Director of Rugby — not forced to head_coach.
 * Verify fields left null. Calculated Rating / PI / PREM Rank from recalc only.
 *
 * Saracens = Brendan Venter (McCall → Technical Adviser after 2025/26).
 * Northampton: Dowson DoR (PREM board primary) + Sam Vesty Head Coach (match lead).
 */
import { and, eq, ilike } from "drizzle-orm";
import {
  coaches,
  coachPlayingStints,
  coachHonours,
  teamCoachingStaff,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { recalculateCoach } from "../apps/web/src/lib/coach-recalc-service";
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { listPremCoachRankings } from "../apps/web/src/lib/coach-competition-rank";
import type { CoachingRole } from "../apps/web/src/lib/coach-types";

const NATIONS = {
  "South Africa": "b0000000-0000-4000-8000-000000000001",
  England: "2cbe38e3-ca15-40b2-934f-41035f441eb9",
  "New Zealand": "785844d7-ca82-4044-8f98-30f20c7fbcd9",
} as const;

const TEAMS = {
  bath: { id: "95ae893d-5429-4dd6-8990-ae898c200eef", display: "Bath Rugby" },
  bristol: { id: "5c8f53ef-4a9e-46c4-b603-697289fbdf95", display: "Bristol Bears" },
  exeter: { id: "7d2713fa-ee50-46f5-9a76-cfca88dbec94", display: "Exeter Chiefs" },
  gloucester: { id: "0495a0e5-b1ba-4cb9-878f-1de13893ecad", display: "Gloucester Rugby" },
  harlequins: { id: "80571a64-5088-4284-863c-ca85a7dc1bb1", display: "Harlequins" },
  leicester: { id: "1d1bcadf-006f-45bd-85e2-91e50b9bb843", display: "Leicester Tigers" },
  newcastle: {
    id: "4cb571a0-f199-4ff0-ad13-3c3f20547cf7",
    display: "Newcastle Red Bulls",
  },
  northampton: {
    id: "cfcdc2cc-0f92-48dd-84bc-ef1b40c686f8",
    display: "Northampton Saints",
  },
  sale: { id: "5c4f05ae-6fa2-44bb-99d2-44615d29ff00", display: "Sale Sharks" },
  saracens: { id: "fbd298b9-79eb-4b8c-8438-eec55eb4d06d", display: "Saracens" },
} as const;

type Playing = {
  teamName: string;
  teamId?: string;
  teamType: "international" | "provincial" | "club" | "franchise";
  yearsLabel: string;
  startYear?: number;
  endYear?: number;
  apps?: number | null;
  points?: number | null;
};

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
  role: CoachingRole;
  assignmentStart: string;
  assignmentNotes?: string | null;
  overviewLabel: string;
  /** PREM board + match-stat owner for this club. */
  isPrimaryCoach: boolean;
  eligibleForCareerRecord: boolean;
  playing?: Playing[];
  honours?: Array<{
    year: number;
    competitionName: string;
    honourLevel?: string;
    roleType?: "coach" | "player";
  }>;
};

const SEEDS: Seed[] = [
  {
    name: "Johann van Graan",
    slug: "johann-van-graan",
    fullName: "Johann Christiaan van Graan",
    birthDate: "1980-03-18",
    placeOfBirth: "Pretoria",
    countryOfBirth: "South Africa",
    nationality: "South Africa",
    formerPlayingPositions: "No major senior playing career",
    coachingCareerStartYear: 2002,
    appointedOn: "2022-01-01",
    contractExpiresOn: "2030-06-30",
    preferredSystem: "Adaptive / Power & Territory",
    coachingStyle: "Structured, physical & detail-led",
    notes:
      "Bath Head of Rugby; contract through end of 2029/30. Springboks staff from 2012; Munster HC previously. Height verify. 2025 treble: PREM, Challenge Cup, Premiership Rugby Cup.",
    team: "bath",
    role: "head_of_rugby",
    assignmentStart: "2022-01-01",
    overviewLabel: "Head of Rugby — Bath Rugby",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    honours: [
      { year: 2025, competitionName: "Gallagher Premiership", honourLevel: "major" },
      { year: 2025, competitionName: "EPCR Challenge Cup", honourLevel: "major" },
      { year: 2025, competitionName: "Premiership Rugby Cup", honourLevel: "domestic_major" },
    ],
  },
  {
    name: "Pat Lam",
    slug: "pat-lam",
    fullName: "Patrick Richard Lam",
    birthDate: "1968-09-29",
    placeOfBirth: "Auckland",
    countryOfBirth: "New Zealand",
    nationality: "Samoa",
    heightCm: 188,
    formerPlayingPositions: "No. 8 / Flanker",
    coachingCareerStartYear: 2003,
    appointedOn: "2017-01-01",
    contractExpiresOn: "2028-06-30",
    preferredSystem: "Attack / High Tempo",
    coachingStyle: "Expansive, ambitious & possession-led",
    notes:
      "Bristol DoR; May 2026 said two years remaining → 2028. Samoa 34 caps; NZ 1 cap. Connacht Pro12 2016; Bristol Challenge Cup 2020.",
    team: "bristol",
    role: "director_of_rugby",
    assignmentStart: "2017-01-01",
    overviewLabel: "Director of Rugby — Bristol Bears",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "Samoa",
        teamType: "international",
        yearsLabel: "Samoa international",
        apps: 34,
      },
      {
        teamName: "New Zealand",
        teamId: NATIONS["New Zealand"],
        teamType: "international",
        yearsLabel: "New Zealand international",
        apps: 1,
      },
    ],
    honours: [
      { year: 2016, competitionName: "Pro12", honourLevel: "major" },
      { year: 2020, competitionName: "EPCR Challenge Cup", honourLevel: "major" },
    ],
  },
  {
    name: "Rob Baxter",
    slug: "rob-baxter",
    fullName: "Robert John Baxter",
    birthDate: "1971-03-10",
    placeOfBirth: "Tavistock",
    countryOfBirth: "England",
    nationality: "England",
    formerPlayingPositions: "Lock",
    coachingCareerStartYear: 2005,
    appointedOn: "2009-01-01",
    preferredSystem: "Power / Territory",
    coachingStyle: "Physical, set-piece led & development-focused",
    notes:
      "Exeter Chief of Rugby Operations / senior rugby lead since 2009 as head coach era. New contract April 2026 — end date not published. Height verify. 300+ Exeter playing apps; 2 Premierships; 1 European Champions Cup as coach.",
    team: "exeter",
    role: "head_of_rugby",
    assignmentStart: "2009-01-01",
    overviewLabel: "Chief of Rugby Operations — Exeter Chiefs",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "Exeter Chiefs",
        teamId: TEAMS.exeter.id,
        teamType: "club",
        yearsLabel: "Exeter Chiefs (300+ apps)",
        apps: 300,
      },
    ],
    honours: [
      { year: 2017, competitionName: "Aviva Premiership", honourLevel: "major" },
      { year: 2020, competitionName: "Gallagher Premiership", honourLevel: "major" },
      { year: 2020, competitionName: "European Rugby Champions Cup", honourLevel: "major" },
    ],
  },
  {
    name: "George Skivington",
    slug: "george-skivington",
    fullName: "George Skivington",
    birthDate: "1982-12-03",
    placeOfBirth: "Warrington",
    countryOfBirth: "England",
    nationality: "England",
    heightCm: 200,
    formerPlayingPositions: "Lock",
    coachingCareerStartYear: 2016,
    appointedOn: "2020-07-03",
    preferredSystem: "Physical / Forward Platform",
    coachingStyle: "Set-piece, breakdown & forward-led",
    notes:
      "Gloucester HC from 3 Jul 2020. Contract into 2026/27 — exact end verify. England Saxons captain. Playing: Wasps, Leicester, London Irish.",
    team: "gloucester",
    role: "head_coach",
    assignmentStart: "2020-07-03",
    overviewLabel: "Head Coach — Gloucester Rugby",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      { teamName: "Wasps", teamType: "club", yearsLabel: "Wasps" },
      {
        teamName: "Leicester Tigers",
        teamId: TEAMS.leicester.id,
        teamType: "club",
        yearsLabel: "Leicester Tigers",
      },
      { teamName: "London Irish", teamType: "club", yearsLabel: "London Irish" },
    ],
  },
  {
    name: "Jason Gilmore",
    slug: "jason-gilmore",
    fullName: "Jason Gilmore",
    countryOfBirth: "Australia",
    nationality: "Australia",
    coachingCareerStartYear: 2008,
    appointedOn: "2026-03-01",
    preferredSystem: "Attack / Aggressive Defence",
    coachingStyle: "Aggressive, smart & development-led",
    notes:
      "Harlequins permanent HC Mar 2026. DOB / height / former position left blank (not publicly verified). Path: Waratahs; Australia U20; Australia A; Barbarians; Quins defence.",
    team: "harlequins",
    role: "head_coach",
    assignmentStart: "2026-03-01",
    overviewLabel: "Head Coach — Harlequins",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
  },
  {
    name: "Geoff Parling",
    slug: "geoff-parling",
    fullName: "Geoffrey Parling",
    knownAs: "Geoff Parling",
    birthDate: "1983-10-28",
    placeOfBirth: "Stockton-on-Tees",
    countryOfBirth: "England",
    nationality: "England",
    heightCm: 198,
    formerPlayingPositions: "Lock",
    coachingCareerStartYear: 2017,
    appointedOn: "2025-05-01",
    preferredSystem: "Set Piece / Balanced",
    coachingStyle: "Technical, lineout-focused & detail-led",
    notes:
      "Leicester HC announced May 2025 on long-term deal — exact end not disclosed. Took charge 2025/26. England 29 caps; Lions 3 Tests 2013; 2 Premierships as Leicester player.",
    team: "leicester",
    role: "head_coach",
    assignmentStart: "2025-07-01",
    overviewLabel: "Head Coach — Leicester Tigers",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "England",
        teamId: NATIONS.England,
        teamType: "international",
        yearsLabel: "England international",
        apps: 29,
      },
      {
        teamName: "British & Irish Lions",
        teamType: "international",
        yearsLabel: "2013 — 3 Tests",
        startYear: 2013,
        endYear: 2013,
        apps: 3,
      },
      {
        teamName: "Leicester Tigers",
        teamId: TEAMS.leicester.id,
        teamType: "club",
        yearsLabel: "Leicester Tigers",
      },
    ],
    honours: [
      {
        year: 2013,
        competitionName: "Aviva Premiership",
        honourLevel: "major",
        roleType: "player",
      },
    ],
  },
  {
    name: "Steve Diamond",
    slug: "steve-diamond",
    fullName: "Stephen Diamond",
    knownAs: "Steve Diamond",
    birthDate: "1969-02-03",
    placeOfBirth: "Manchester",
    countryOfBirth: "England",
    nationality: "England",
    formerPlayingPositions: "Hooker",
    coachingCareerStartYear: 2001,
    appointedOn: "2024-01-01",
    preferredSystem: "Power / Territory",
    coachingStyle: "Physical, direct & confrontational",
    notes:
      "Newcastle Red Bulls DoR (CMS team still Newcastle Falcons). Identity: rugby union coach + Sale/Newcastle — do not confuse with other Steve Diamonds. Height ~1.78m — verify before publish. Contract Red Bull-era term verify. Playing: Sale Sharks. Coaching: Sale, Worcester, Newcastle.",
    team: "newcastle",
    role: "director_of_rugby",
    assignmentStart: "2024-01-01",
    overviewLabel: "Director of Rugby — Newcastle Red Bulls",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "Sale Sharks",
        teamId: TEAMS.sale.id,
        teamType: "club",
        yearsLabel: "Sale Sharks",
      },
    ],
  },
  {
    name: "Phil Dowson",
    slug: "phil-dowson",
    fullName: "Philip Dowson",
    knownAs: "Phil Dowson",
    birthDate: "1981-10-01",
    placeOfBirth: "Guildford",
    countryOfBirth: "England",
    nationality: "England",
    heightCm: 191,
    formerPlayingPositions: "Flanker / No. 8",
    coachingCareerStartYear: 2017,
    appointedOn: "2022-01-01",
    preferredSystem: "High Tempo / Attack",
    coachingStyle: "Fast, attacking & development-led",
    notes:
      "Northampton DoR (PREM board primary). Sam Vesty is Head Coach — both stored; Vesty also eligible for match-linked stats. Contract end verify. England 7 caps. PREM champion as coach.",
    team: "northampton",
    role: "director_of_rugby",
    assignmentStart: "2022-01-01",
    overviewLabel: "Director of Rugby — Northampton Saints",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "England",
        teamId: NATIONS.England,
        teamType: "international",
        yearsLabel: "England international",
        apps: 7,
      },
      {
        teamName: "Newcastle Falcons",
        teamId: TEAMS.newcastle.id,
        teamType: "club",
        yearsLabel: "Newcastle Falcons",
      },
      {
        teamName: "Northampton Saints",
        teamId: TEAMS.northampton.id,
        teamType: "club",
        yearsLabel: "Northampton Saints",
      },
      { teamName: "Worcester Warriors", teamType: "club", yearsLabel: "Worcester" },
    ],
    honours: [
      { year: 2024, competitionName: "Gallagher Premiership", honourLevel: "major" },
    ],
  },
  {
    name: "Sam Vesty",
    slug: "sam-vesty",
    fullName: "Sam Vesty",
    countryOfBirth: "England",
    nationality: "England",
    formerPlayingPositions: "Fly-half / Fullback",
    preferredSystem: "Attack / Structured",
    coachingStyle: "Attack-minded, technical & development-led",
    notes:
      "Northampton Saints Head Coach (match-day lead). Phil Dowson is DoR and PREM board primary. Identity/birth/height need CMS verification. Seeded so CMS stores both roles.",
    team: "northampton",
    role: "head_coach",
    assignmentStart: "2022-01-01",
    overviewLabel: "Head Coach — Northampton Saints",
    isPrimaryCoach: false,
    eligibleForCareerRecord: true,
  },
  {
    name: "Alex Sanderson",
    slug: "alex-sanderson",
    fullName: "Alexander Sanderson",
    knownAs: "Alex Sanderson",
    birthDate: "1979-10-07",
    placeOfBirth: "Chester",
    countryOfBirth: "England",
    nationality: "England",
    heightCm: 193,
    formerPlayingPositions: "Flanker / No. 8",
    coachingCareerStartYear: 2008,
    appointedOn: "2021-01-15",
    preferredSystem: "Power / High Pressure",
    coachingStyle: "Physical, defensive & intensity-led",
    notes:
      "Sale DoR from 15 Jan 2021. Contract end verify. England 5 caps; 90 Sale playing apps; previous coaching Saracens.",
    team: "sale",
    role: "director_of_rugby",
    assignmentStart: "2021-01-15",
    overviewLabel: "Director of Rugby — Sale Sharks",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "England",
        teamId: NATIONS.England,
        teamType: "international",
        yearsLabel: "England international",
        apps: 5,
      },
      {
        teamName: "Sale Sharks",
        teamId: TEAMS.sale.id,
        teamType: "club",
        yearsLabel: "Sale Sharks",
        apps: 90,
      },
    ],
  },
  {
    name: "Brendan Venter",
    slug: "brendan-venter",
    fullName: "Brendan Venter",
    birthDate: "1969-12-29",
    placeOfBirth: "Johannesburg",
    countryOfBirth: "South Africa",
    nationality: "South Africa",
    heightCm: 185,
    formerPlayingPositions: "Centre",
    coachingCareerStartYear: 2005,
    appointedOn: "2026-07-01",
    preferredSystem: "Structured / Pressure",
    coachingStyle: "Analytical, physical & culture-led",
    notes:
      "Saracens DoR from start of 2026/27 (confirmed return). McCall → Technical Adviser / board. Previously Saracens DoR from 2009. SA 17 caps; 1995 RWC winner. Also London Irish, Italy, SA consultancy. Contract verify.",
    team: "saracens",
    role: "director_of_rugby",
    assignmentStart: "2026-07-01",
    overviewLabel: "Director of Rugby — Saracens",
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    playing: [
      {
        teamName: "South Africa",
        teamId: NATIONS["South Africa"],
        teamType: "international",
        yearsLabel: "South Africa international",
        apps: 17,
      },
    ],
    honours: [
      {
        year: 1995,
        competitionName: "Rugby World Cup",
        honourLevel: "major",
        roleType: "player",
      },
    ],
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

async function upsertPlaying(coachId: string, row: Playing) {
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
      row.teamType === "international" ? "international_player" : "club_player",
    competitionLevel: row.teamType === "international" ? "international" : "club",
    startYear: row.startYear ?? null,
    endYear: row.endYear ?? null,
    apps: row.apps ?? null,
    points: row.points ?? null,
    recordStatus: "verified" as const,
    verifiedAt: new Date(),
    showOnOverview: row.teamType === "international",
    sourceProvider: "manual",
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(coachPlayingStints)
      .set(payload)
      .where(eq(coachPlayingStints.id, existing.id));
  } else {
    await db.insert(coachPlayingStints).values({ coachId, ...payload, sortOrder: 50 });
  }
}

async function ensureHonour(
  coachId: string,
  h: NonNullable<Seed["honours"]>[number],
) {
  const roleType = h.roleType ?? "coach";
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
  const boardCoachIds: string[] = [];

  for (const seed of SEEDS) {
    const coach = await ensureCoach(seed);
    if (seed.isPrimaryCoach) boardCoachIds.push(coach.id);
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
        lastVerifiedAt: new Date(),
        profileUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coaches.id, coach.id));

    await upsertCoachingStaffAssignment({
      coachId: coach.id,
      teamId: team.id,
      role: seed.role,
      careerType: "coach",
      startDate: seed.assignmentStart,
      isCurrent: true,
      isPrimaryCoach: seed.isPrimaryCoach,
      showOnOverview: true,
      eligibleForCareerRecord: seed.eligibleForCareerRecord,
      notes: seed.assignmentNotes ?? seed.overviewLabel,
      confidence: "high",
      verifiedAt: new Date(),
      importKey: `prem-2026-27:${team.id}:${coach.id}:${seed.role}`,
    });

    await db
      .update(teamCoachingStaff)
      .set({
        teamDisplayName: team.display,
        competitionLevel: "premiership",
        overviewLabel: seed.overviewLabel,
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
    for (const h of seed.honours ?? []) await ensureHonour(coach.id, h);

    console.log(`\n=== ${seed.name} → ${team.display} (${seed.role}) ===`);
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
      premRank: bundle.competitionRank,
      of: bundle.competitionRankedOutOf,
      label: bundle.competitionRankLabel,
    });
  }

  console.log("\n=== Re-rank PREM board ===");
  for (const id of boardCoachIds) await persistCoachRatingSnapshot(id);

  const board = await listPremCoachRankings(10);
  console.log("\n=== PREM COACH RANK (2026/27) ===");
  for (const r of board) {
    console.log(
      `#${r.rank}`.padEnd(4),
      r.teamName.padEnd(22),
      r.name.padEnd(22),
      `rating=${r.rating ?? "—"}`,
      `PI=${r.powerIndex ?? "—"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
