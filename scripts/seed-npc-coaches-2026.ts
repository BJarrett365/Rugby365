/**
 * Update 2026 Hilux NPC fourteen-coach pack with verified Nations-style seed data.
 * Leave "Verify" fields null. Calculated Rating / PI / ranks come from recalc only.
 */
import { and, eq, ilike } from "drizzle-orm";
import {
  coaches,
  coachPlayingStints,
  coachHonours,
  coachAwards,
  teamCoachingStaff,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { recalculateCoach } from "../apps/web/src/lib/coach-recalc-service";
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { listNpcCoachRankings } from "../apps/web/src/lib/coach-competition-rank";

const NZ_ID = "785844d7-ca82-4044-8f98-30f20c7fbcd9";

const TEAMS = {
  auckland: { id: "cf089a23-184a-47ab-98eb-acdae82e199c", display: "Auckland" },
  bayOfPlenty: { id: "086b5bda-26c3-4855-a93c-21a76503f985", display: "Bay of Plenty" },
  canterbury: { id: "141ce8f7-2ac4-4283-b44e-5aaf62e54d9d", display: "Canterbury" },
  countiesManukau: {
    id: "d54c3618-057e-4d34-80a9-2bbb12eca0c5",
    display: "Counties Manukau",
  },
  hawkesBay: { id: "cfd41b38-e1d0-4e5e-84cd-4fb512908e0c", display: "Hawke's Bay" },
  manawatu: { id: "36517f4a-58e5-40b0-810c-5448c4ad272d", display: "Manawatū" },
  northHarbour: { id: "671eba41-08f5-4e14-bcf9-9ddf59d8ffea", display: "North Harbour" },
  northland: { id: "e9cd8279-448e-459e-a7fd-f2938256ec37", display: "Northland" },
  otago: { id: "492165e7-2f82-40bb-9315-709839bf32e1", display: "Otago" },
  southland: { id: "8c037df8-45cb-463d-a816-c825c13ad2af", display: "Southland" },
  taranaki: { id: "7b1ee9db-a8ee-4db6-88a5-425212c63001", display: "Taranaki" },
  tasman: { id: "be756fbc-9abb-4bde-9076-a414dabe8e3f", display: "Tasman" },
  waikato: { id: "21e51635-42eb-492f-a4e4-6154a727f6e0", display: "Waikato" },
  wellington: { id: "6b9c5528-43ef-48a0-9255-2e3561638fac", display: "Wellington" },
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
  tries?: number | null;
  notes?: string;
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
  secondNationality?: string | null;
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
  overviewLabel?: string;
  playing?: Playing[];
  honours?: Array<{
    year: number;
    competitionName: string;
    honourLevel?: string;
    roleType?: "coach" | "player";
  }>;
  awards?: Array<{
    year: number;
    awardName: string;
    awardingBody?: string;
    isMajor?: boolean;
  }>;
};

const SEEDS: Seed[] = [
  {
    name: "Steven Bates",
    slug: "steven-bates",
    birthDate: "1980-01-16",
    placeOfBirth: "Auckland",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    heightCm: 191,
    formerPlayingPositions: "Flanker / No. 8",
    appointedOn: null, // 2025/26 — exact date verify
    preferredSystem: "Physical / Balanced Attack",
    coachingStyle: "Direct, physical & breakdown-focused",
    notes:
      "Confirmed Auckland NPC HC for 2026. Coaching since / exact appointment date / contract need CMS verification. NZ Cap: 1.",
    team: "auckland",
    assignmentStart: "2025-01-01",
    assignmentNotes: "Head Coach — Auckland (Hilux NPC 2026)",
    playing: [
      {
        teamName: "New Zealand",
        teamId: NZ_ID,
        teamType: "international",
        yearsLabel: "New Zealand international",
        apps: 1,
      },
      {
        teamName: "Waikato",
        teamId: TEAMS.waikato.id,
        teamType: "provincial",
        yearsLabel: "Waikato",
      },
      {
        teamName: "Chiefs",
        teamType: "franchise",
        yearsLabel: "Chiefs",
      },
      {
        teamName: "Newcastle Falcons",
        teamType: "club",
        yearsLabel: "Newcastle Falcons",
      },
    ],
  },
  {
    name: "Richard Watt",
    slug: "richard-watt",
    knownAs: "Watty",
    birthDate: "1965-04-03",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    heightCm: 186,
    formerPlayingPositions: "Lock",
    coachingCareerStartYear: null, // club rugby — exact year verify
    appointedOn: "2023-04-01",
    preferredSystem: "Structured / Technical",
    coachingStyle: "Technical, organised & set-piece aware",
    notes:
      "Appointed Bay of Plenty Steamers HC April 2023; confirmed 2026. Birthplace / coaching-start year / contract verify. Playing weight reported 100kg (no CMS weight field — note only).",
    team: "bayOfPlenty",
    assignmentStart: "2023-04-01",
    assignmentNotes: "Head Coach — Bay of Plenty Steamers",
    overviewLabel: "Head Coach — Bay of Plenty Steamers",
    playing: [
      {
        teamName: "Wellington",
        teamId: TEAMS.wellington.id,
        teamType: "provincial",
        yearsLabel: "Wellington",
        apps: 18,
      },
    ],
  },
  {
    name: "Alex Robertson",
    slug: "alex-robertson",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    coachingCareerStartYear: 2017,
    appointedOn: "2025-12-01",
    preferredSystem: "Structured / High-tempo",
    coachingStyle: "Development-led, technical & organised",
    notes:
      "Appointed Canterbury NPC HC Dec 2025 for 2026. Pathway: Ellesmere, Lincoln University, Canterbury U19/U20/B, NZ U20, Canterbury assistant. Birth / birthplace town / former position / height / contract verify. 2026 assistants: James Lentjes, Ryan Crotty, Dan Cron.",
    team: "canterbury",
    assignmentStart: "2025-12-01",
    assignmentNotes: "Head Coach — Canterbury (Hilux NPC 2026)",
    honours: [
      {
        year: 2025,
        competitionName: "National Provincial Championship",
        honourLevel: "major",
        roleType: "coach",
      },
    ],
  },
  {
    name: "Reon Graham",
    slug: "reon-graham",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    contractExpiresOn: "2027-12-31",
    preferredSystem: "Physical / Direct",
    coachingStyle: "Physical, local-development focused",
    notes:
      "Counties Manukau Steelers HC; two-year extension March 2026 through 2027. Birth / birthplace / coaching since / former position / height / exact appointed date verify.",
    team: "countiesManukau",
    assignmentStart: "2024-01-01",
    assignmentNotes: "Head Coach — Counties Manukau Steelers (contract through 2027)",
    overviewLabel: "Head Coach — Counties Manukau Steelers",
  },
  {
    name: "Brock James",
    slug: "brock-james",
    fullName: "Brock James",
    birthDate: "1981-10-22",
    placeOfBirth: "Victoria",
    countryOfBirth: "Australia",
    nationality: "Australia",
    heightCm: 179,
    formerPlayingPositions: "Fly-half",
    preferredSystem: "Attack / Kicking",
    coachingStyle: "Attack-minded, tactical & kicking-focused",
    notes:
      "Confirmed Hawke's Bay Magpies HC 2026. Coaching-since year / exact appointment / contract verify. Playing career: Taranaki, Clermont (289 apps, 2,483 pts), La Rochelle, Bordeaux, Reds, Western Force.",
    team: "hawkesBay",
    assignmentStart: "2026-01-01",
    assignmentNotes: "Head Coach — Hawke's Bay Magpies",
    overviewLabel: "Head Coach — Hawke's Bay Magpies",
    playing: [
      {
        teamName: "Clermont",
        teamType: "club",
        yearsLabel: "Clermont",
        apps: 289,
        points: 2483,
        notes: "289 appearances, 2,483 points",
      },
      {
        teamName: "Taranaki",
        teamId: TEAMS.taranaki.id,
        teamType: "provincial",
        yearsLabel: "Taranaki",
      },
      {
        teamName: "La Rochelle",
        teamType: "club",
        yearsLabel: "La Rochelle",
      },
      {
        teamName: "Bordeaux",
        teamType: "club",
        yearsLabel: "Bordeaux",
      },
      {
        teamName: "Queensland Reds",
        teamType: "franchise",
        yearsLabel: "Reds",
      },
      {
        teamName: "Western Force",
        teamType: "franchise",
        yearsLabel: "Western Force",
      },
    ],
  },
  {
    name: "Wesley Clarke",
    slug: "wesley-clarke",
    placeOfBirth: "Port Elizabeth",
    countryOfBirth: "South Africa",
    nationality: "New Zealand",
    secondNationality: "South Africa",
    appointedOn: null, // 2026 — exact date verify
    preferredSystem: "Development / Balanced",
    coachingStyle: "Development-led & people-focused",
    notes:
      "Confirmed Manawatū Turbos HC 2026 (not Mike Rogers). Born Port Elizabeth; moved to NZ aged 19. Formal nationality field NZ with SA background. Previous: Head of Performance Rugby — Manawatū. Birth date / coaching since / former position / height / contract / exact appointed date verify.",
    team: "manawatu",
    assignmentStart: "2026-01-01",
    assignmentNotes: "Head Coach — Manawatū Turbos",
    overviewLabel: "Head Coach — Manawatū Turbos",
  },
  {
    name: "Jimmy Maher",
    slug: "jimmy-maher",
    fullName: "James Thomas Maher",
    knownAs: "Jimmy Maher",
    birthDate: "1981-05-21",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    heightCm: 190,
    formerPlayingPositions: "No. 8 / Loose forward",
    preferredSystem: "Balanced / Development",
    coachingStyle: "Development-led & adaptable",
    notes:
      "North Harbour HC 2026 confirmed by union squad announcement. Assistants: Grant Henson, Adam Foy, Glen Rowe. Birthplace / coaching since / exact appointment / contract verify. Played 40 for Counties Manukau 2004–07; All Blacks Sevens; Japan.",
    team: "northHarbour",
    assignmentStart: "2025-01-01",
    assignmentNotes: "Head Coach — North Harbour (Hilux NPC 2026)",
    playing: [
      {
        teamName: "Counties Manukau",
        teamId: TEAMS.countiesManukau.id,
        teamType: "provincial",
        yearsLabel: "2004–2007",
        startYear: 2004,
        endYear: 2007,
        apps: 40,
      },
    ],
  },
  {
    name: "Ryan Martin",
    slug: "ryan-martin",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    heightCm: 180,
    coachingCareerStartYear: 2008,
    appointedOn: "2025-01-01",
    preferredSystem: "Attack / High-tempo",
    coachingStyle: "Attack-led, innovative & development-focused",
    notes:
      "Northland Taniwha HC from 2025; also New England Free Jacks (MLR). Path: junior coaching from 2008; Otago, Melbourne Rebels, Toyota Verblitz, Free Jacks. Birth date / birthplace town / former position / contract verify. Height 1.80m reported.",
    team: "northland",
    assignmentStart: "2025-01-01",
    assignmentNotes: "Head Coach — Northland Taniwha",
    overviewLabel: "Head Coach — Northland Taniwha",
    honours: [
      {
        year: 2025,
        competitionName: "Major League Rugby",
        honourLevel: "major",
        roleType: "coach",
      },
    ],
    awards: [
      {
        year: 2025,
        awardName: "MLR Coach of the Year",
        awardingBody: "Major League Rugby",
        isMajor: true,
      },
    ],
  },
  {
    name: "Mark Brown",
    slug: "mark-brown",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    preferredSystem: "Structured / Development",
    coachingStyle: "Balanced, organised & development-led",
    notes:
      "Otago official 2026 management lists Mark Brown as Head Coach; assistants Ryan Bambry, Will Henry, Mitch Scott. Birth / birthplace / coaching since / exact appointment / former position / height / contract verify.",
    team: "otago",
    assignmentStart: "2025-01-01",
    assignmentNotes: "Head Coach — Otago (Hilux NPC 2026)",
  },
  {
    name: "Scott Eade",
    slug: "scott-eade",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    appointedOn: "2025-11-01",
    preferredSystem: "Defence / Physical",
    coachingStyle: "Defence-led, local & physical",
    notes:
      "Promoted from Southland defence assistant to sole HC for 2026 (Oct/Nov 2025). Exact birthplace / coaching since / former position / height / contract term verify.",
    team: "southland",
    assignmentStart: "2025-11-01",
    assignmentNotes: "Head Coach — Southland Stags",
    overviewLabel: "Head Coach — Southland Stags",
  },
  {
    name: "Jarrad Hoeata",
    slug: "jarrad-hoeata",
    fullName: "Jarrad Hoeata",
    birthDate: "1983-12-12",
    placeOfBirth: "Tauranga",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    heightCm: 198,
    formerPlayingPositions: "Lock / Flanker",
    coachingCareerStartYear: 2019,
    appointedOn: "2026-04-14",
    preferredSystem: "Physical / Set Piece",
    coachingStyle: "Physical, confrontational & forward-led",
    notes:
      "Taranaki Bulls HC appointed 14 Apr 2026 after assistant role since 2019. Also Chiefs assistant / NZ U20 pathway — verify dual-role contract. Major playing: Taranaki, Highlanders, Chiefs, Cardiff Blues (Hurricanes listed in draft — verify before adding).",
    team: "taranaki",
    assignmentStart: "2026-04-14",
    assignmentNotes: "Head Coach — Taranaki Bulls",
    overviewLabel: "Head Coach — Taranaki Bulls",
    playing: [
      {
        teamName: "New Zealand",
        teamId: NZ_ID,
        teamType: "international",
        yearsLabel: "2011",
        startYear: 2011,
        endYear: 2011,
        apps: 3,
        points: 0,
      },
      {
        teamName: "Taranaki",
        teamId: TEAMS.taranaki.id,
        teamType: "provincial",
        yearsLabel: "2006–2014, 2018–2020",
        startYear: 2006,
        endYear: 2020,
        apps: 91,
        points: 20,
      },
      {
        teamName: "Highlanders",
        teamType: "franchise",
        yearsLabel: "2011–2014",
        startYear: 2011,
        endYear: 2014,
        apps: 53,
        points: 5,
      },
      {
        teamName: "Chiefs",
        teamType: "franchise",
        yearsLabel: "2010",
        startYear: 2010,
        endYear: 2010,
        apps: 6,
      },
      {
        teamName: "Cardiff Blues",
        teamType: "club",
        yearsLabel: "2014–2017",
        startYear: 2014,
        endYear: 2017,
        apps: 62,
        points: 5,
      },
    ],
    honours: [
      {
        year: 2023,
        competitionName: "National Provincial Championship",
        honourLevel: "major",
        roleType: "coach",
      },
    ],
  },
  {
    name: "Jono Phillips",
    slug: "jono-phillips",
    fullName: "Jono Phillips",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    appointedOn: "2026-05-01",
    contractExpiresOn: "2027-12-31",
    preferredSystem: "Attack / Balanced",
    coachingStyle: "Technical, progressive & development-led",
    notes:
      "Tasman Mako Director of Rugby & Head Coach — two-year deal from 2026. Previous: Taranaki / Hurricanes pathway. Birth / birthplace / coaching since / former position / height verify.",
    team: "tasman",
    assignmentStart: "2026-05-01",
    assignmentNotes: "Director of Rugby & Head Coach — Tasman Mako (two-year deal)",
    overviewLabel: "Director of Rugby & Head Coach — Tasman Mako",
  },
  {
    name: "Leon Holden",
    slug: "leon-holden",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    coachingCareerStartYear: null, // 20+ years — exact year verify
    appointedOn: "2025-12-01",
    preferredSystem: "Forward platform / Balanced",
    coachingStyle: "Experienced, technical & development-led",
    notes:
      "Waikato HC appointed 1 Dec 2025 for 2026. 20+ years HP coaching across NZ, Japan, England, USA. Birth / birthplace / exact coaching-start year / former position / height / contract verify. Assistants: Nathan White, Jackson Willison, Aaron Cruden.",
    team: "waikato",
    assignmentStart: "2025-12-01",
    assignmentNotes: "Head Coach — Waikato (Hilux NPC 2026)",
  },
  {
    name: "Trent Renata",
    slug: "trent-renata",
    fullName: "Trent Wiremu Kitahi Renata",
    birthDate: "1988-05-13",
    placeOfBirth: "Hamilton",
    countryOfBirth: "New Zealand",
    nationality: "New Zealand",
    heightCm: 180,
    formerPlayingPositions: "Fullback / Fly-half",
    appointedOn: "2025-01-01",
    preferredSystem: "Attack / Skill",
    coachingStyle: "Attack-minded, skill-based & adaptive",
    notes:
      "Confirmed Wellington Lions HC 2026 (live NPC fixtures). Coaching-since year / contract verify. Major playing: Otago, Highlanders, Chiefs, Tasman, Wellington.",
    team: "wellington",
    assignmentStart: "2025-01-01",
    assignmentNotes: "Head Coach — Wellington Lions",
    overviewLabel: "Head Coach — Wellington Lions",
    playing: [
      {
        teamName: "Otago",
        teamId: TEAMS.otago.id,
        teamType: "provincial",
        yearsLabel: "Otago",
      },
      {
        teamName: "Wellington",
        teamId: TEAMS.wellington.id,
        teamType: "provincial",
        yearsLabel: "Wellington",
      },
      {
        teamName: "Tasman",
        teamId: TEAMS.tasman.id,
        teamType: "provincial",
        yearsLabel: "Tasman",
      },
      {
        teamName: "Highlanders",
        teamType: "franchise",
        yearsLabel: "Highlanders",
      },
      {
        teamName: "Chiefs",
        teamType: "franchise",
        yearsLabel: "Chiefs",
      },
    ],
    honours: [
      {
        year: 2024,
        competitionName: "National Provincial Championship",
        honourLevel: "major",
        roleType: "coach",
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
      row.teamType === "international"
        ? "international_player"
        : row.teamType === "franchise"
          ? "franchise_player"
          : "provincial_player",
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
    tries: row.tries ?? null,
    notes: row.notes ?? null,
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
) {
  if (!h.year) return;
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
        eq(coachAwards.awardName, a.awardName),
        eq(coachAwards.year, a.year),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(coachAwards).values({
    coachId,
    awardName: a.awardName,
    awardingBody: a.awardingBody ?? null,
    year: a.year,
    result: "winner",
    isMajor: a.isMajor ?? true,
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
        secondNationality: seed.secondNationality ?? null,
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
      importKey: `npc-2026:${team.id}:${coach.id}:head_coach`,
    });

    await db
      .update(teamCoachingStaff)
      .set({
        teamDisplayName: team.display,
        competitionLevel: "npc",
        overviewLabel:
          seed.overviewLabel ?? seed.assignmentNotes ?? `Head Coach — ${team.display}`,
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
    for (const a of seed.awards ?? []) await ensureAward(coach.id, a);

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
      npcRank: bundle.competitionRank,
      of: bundle.competitionRankedOutOf,
    });
  }

  console.log("\n=== Re-rank NPC board ===");
  for (const id of coachIds) await persistCoachRatingSnapshot(id);

  const board = await listNpcCoachRankings(14);
  console.log("\n=== NPC COACH RANK (2026 Hilux NPC) ===");
  for (const r of board) {
    console.log(
      `#${r.rank}`.padEnd(4),
      r.teamName.padEnd(18),
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
