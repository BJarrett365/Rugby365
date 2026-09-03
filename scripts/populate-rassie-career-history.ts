/**
 * Populate Rassie Erasmus structured playing + coaching career from Wikipedia
 * (https://en.wikipedia.org/wiki/Rassie_Erasmus) as verified CMS rows.
 *
 * Does not invent roles/dates — mirrors the Wikipedia career tables.
 * Overlapping roles are preserved as separate rows.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/populate-rassie-career-history.ts
 */
import { eq, sql } from "drizzle-orm";
import { coaches, coachPlayingStints, teamCoachingStaff, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const COACH_ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";
const SOURCE = "https://en.wikipedia.org/wiki/Rassie_Erasmus";
const SOURCE_PROVIDER = "wikipedia";

type TeamSpec = {
  slug: string;
  name: string;
  shortName: string;
  teamType: string;
  countryName: string;
  imageFromSlug?: string;
};

const TEAM_SPECS: TeamSpec[] = [
  {
    slug: "free-state",
    name: "Free State",
    shortName: "FS",
    teamType: "provincial",
    countryName: "South Africa",
    imageFromSlug: "cheetahs-x7jq3161",
  },
  {
    slug: "free-state-cheetahs",
    name: "Free State Cheetahs",
    shortName: "FSC",
    teamType: "provincial",
    countryName: "South Africa",
    imageFromSlug: "cheetahs-x7jq3161",
  },
  {
    slug: "cats",
    name: "Cats",
    shortName: "CAT",
    teamType: "franchise",
    countryName: "South Africa",
    imageFromSlug: "lions-k76kd1jy",
  },
  {
    slug: "stormers",
    name: "Stormers",
    shortName: "STO",
    teamType: "franchise",
    countryName: "South Africa",
    imageFromSlug: "dhl-stormers-xxiii-pd9ry3j8",
  },
];

async function ensureTeams(db: ReturnType<typeof getDb>) {
  const existing = await db.select().from(teams);
  const bySlug = new Map(existing.map((t) => [t.slug, t]));
  const imageBySlug = new Map(
    existing.map((t) => [t.slug, t.imageUrl?.trim() || null] as const),
  );

  for (const spec of TEAM_SPECS) {
    const found = bySlug.get(spec.slug);
    const imageUrl = spec.imageFromSlug
      ? imageBySlug.get(spec.imageFromSlug) ?? null
      : null;
    if (found) {
      if (!found.imageUrl?.trim() && imageUrl) {
        await db
          .update(teams)
          .set({ imageUrl })
          .where(eq(teams.id, found.id));
        found.imageUrl = imageUrl;
      }
      continue;
    }
    const [created] = await db
      .insert(teams)
      .values({
        slug: spec.slug,
        name: spec.name,
        shortName: spec.shortName,
        teamType: spec.teamType,
        countryName: spec.countryName,
        hemisphere: "south",
        region: "Africa",
        sourceProvider: "manual",
        imageUrl,
      })
      .returning();
    bySlug.set(spec.slug, created!);
    console.log("created team", spec.name, created!.id);
  }

  // Prefer canonical Stormers crest for the DHL XXIII alias row if empty (already has image).
  return bySlug;
}

function teamId(bySlug: Map<string, typeof teams.$inferSelect>, slug: string): string {
  const t = bySlug.get(slug);
  if (!t) throw new Error(`Missing team slug ${slug}`);
  return t.id;
}

async function upsertPlaying(
  db: ReturnType<typeof getDb>,
  row: {
    importKey: string;
    teamType: string;
    startYear: number;
    endYear: number | null;
    yearsLabel: string;
    teamName: string;
    teamId: string | null;
    apps?: number | null;
    points?: number | null;
    country?: string | null;
    showOnOverview: boolean;
    sortOrder: number;
  },
) {
  const [existing] = await db
    .select()
    .from(coachPlayingStints)
    .where(
      sql`${coachPlayingStints.coachId} = ${COACH_ID}
        AND ${coachPlayingStints.sourceUrl} = ${`${SOURCE}#${row.importKey}`}`,
    )
    .limit(1);

  const payload = {
    coachId: COACH_ID,
    teamType: row.teamType,
    startYear: row.startYear,
    endYear: row.endYear,
    yearsLabel: row.yearsLabel,
    teamName: row.teamName,
    teamId: row.teamId,
    apps: row.apps ?? null,
    points: row.points ?? null,
    country: row.country ?? "South Africa",
    sortOrder: row.sortOrder,
    sourceProvider: SOURCE_PROVIDER,
    sourceUrl: `${SOURCE}#${row.importKey}`,
    verifiedAt: new Date(),
    showOnOverview: row.showOnOverview,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(coachPlayingStints)
      .set(payload)
      .where(eq(coachPlayingStints.id, existing.id));
    return { id: existing.id, created: false };
  }

  const [created] = await db.insert(coachPlayingStints).values(payload).returning();
  return { id: created!.id, created: true };
}

async function upsertAssignment(
  db: ReturnType<typeof getDb>,
  row: {
    importKey: string;
    teamId: string;
    role: string;
    careerType: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    isPrimaryCoach: boolean;
    showOnOverview: boolean;
    notes: string;
    eligibleForCareerRecord?: boolean;
    overviewLabel?: string | null;
    teamDisplayName?: string | null;
  },
) {
  const [existing] = await db
    .select()
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.importKey, row.importKey))
    .limit(1);

  const payload = {
    coachId: COACH_ID,
    teamId: row.teamId,
    role: row.role,
    careerType: row.careerType,
    startDate: row.startDate,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    isPrimaryCoach: row.isPrimaryCoach,
    eligibleForCareerRecord: row.eligibleForCareerRecord ?? true,
    showOnOverview: row.showOnOverview,
    overviewLabel: row.overviewLabel ?? null,
    teamDisplayName: row.teamDisplayName ?? null,
    recordStatus: "verified",
    notes: row.notes,
    sourceUrl: SOURCE,
    confidence: "high",
    verifiedAt: new Date(),
    importKey: row.importKey,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(teamCoachingStaff)
      .set(payload)
      .where(eq(teamCoachingStaff.id, existing.id));
    return { id: existing.id, created: false };
  }

  const [created] = await db.insert(teamCoachingStaff).values(payload).returning();
  return { id: created!.id, created: true };
}

async function main() {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.id, COACH_ID)).limit(1);
  if (!coach) throw new Error("Rassie coach row not found");

  const bySlug = await ensureTeams(db);
  // Merge already-known teams into map
  for (const t of await db.select().from(teams)) {
    bySlug.set(t.slug, t);
  }

  const SA = teamId(bySlug, "south-africa");
  const FREE_STATE = teamId(bySlug, "free-state");
  const FSC = teamId(bySlug, "free-state-cheetahs");
  const LIONS = teamId(bySlug, "lions-k76kd1jy");
  const CATS = teamId(bySlug, "cats");
  const STORMERS = teamId(bySlug, "stormers");
  const WP = teamId(bySlug, "western-province");
  const MUNSTER = teamId(bySlug, "munster-m46vomjz");
  const BARBS = teamId(bySlug, "barbarians");

  // Keep existing international stint, retarget source + overview
  await db
    .update(coachPlayingStints)
    .set({
      showOnOverview: true,
      teamId: SA,
      teamName: "South Africa",
      teamType: "international",
      startYear: 1997,
      endYear: 2001,
      yearsLabel: "1997–2001",
      apps: 36,
      points: 35,
      sourceProvider: SOURCE_PROVIDER,
      sourceUrl: `${SOURCE}#playing-international`,
      verifiedAt: new Date(),
      sortOrder: 50,
      updatedAt: new Date(),
    })
    .where(eq(coachPlayingStints.id, "0da77ca5-b75f-4221-9c7f-cf69da36d195"));

  const playing = [
    {
      importKey: "playing-free-state",
      teamType: "provincial",
      startYear: 1994,
      endYear: 2003,
      yearsLabel: "1994–98, 2001–03",
      teamName: "Free State",
      teamId: FREE_STATE,
      apps: 112,
      showOnOverview: true, // overview key journey: Player Free State / Cats / Stormers era start
      sortOrder: 10,
    },
    {
      importKey: "playing-golden-lions",
      teamType: "provincial",
      startYear: 1998,
      endYear: 2000,
      yearsLabel: "1998–2000",
      teamName: "Golden Lions",
      teamId: LIONS,
      apps: 7,
      showOnOverview: false,
      sortOrder: 20,
    },
    {
      importKey: "playing-free-state-super",
      teamType: "franchise",
      startYear: 1997,
      endYear: 1997,
      yearsLabel: "1997",
      teamName: "Free State",
      teamId: FREE_STATE,
      apps: 7,
      points: 10,
      showOnOverview: false,
      sortOrder: 30,
    },
    {
      importKey: "playing-cats",
      teamType: "franchise",
      startYear: 1998,
      endYear: 2001,
      yearsLabel: "1998–2001",
      teamName: "Cats",
      teamId: CATS,
      apps: 46,
      points: 45,
      showOnOverview: false,
      sortOrder: 40,
    },
    {
      importKey: "playing-stormers",
      teamType: "franchise",
      startYear: 2003,
      endYear: 2003,
      yearsLabel: "2003",
      teamName: "Stormers",
      teamId: STORMERS,
      apps: 4,
      showOnOverview: false,
      sortOrder: 45,
    },
  ] as const;

  for (const p of playing) {
    const r = await upsertPlaying(db, { ...p, country: "South Africa" });
    console.log("playing", p.importKey, r.created ? "created" : "updated");
  }

  // Collapse duplicate “current Springboks HC” rows into the Wikipedia 2024–present stint.
  const keepCurrentHcId = "503ae3b9-3e8a-4ce8-b06b-b5036d19b436";
  await db
    .update(teamCoachingStaff)
    .set({
      role: "head_coach",
      careerType: "coach",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      isPrimaryCoach: true,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      recordStatus: "verified",
      sourceUrl: SOURCE,
      confidence: "high",
      verifiedAt: new Date(),
      importKey: "wikipedia:rassie:sa:hc:2024-",
      notes: "South Africa Head Coach (Wikipedia 2024–present). Second stint; overlaps end of DoR years.",
      eligibleForCareerRecord: true,
      updatedAt: new Date(),
    })
    .where(eq(teamCoachingStaff.id, keepCurrentHcId));

  const duplicateCurrent = await db
    .select({ id: teamCoachingStaff.id, importKey: teamCoachingStaff.importKey })
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.coachId, COACH_ID));
  for (const row of duplicateCurrent) {
    if (row.id === keepCurrentHcId) continue;
    if (row.importKey?.startsWith("wikipedia:rassie:")) continue;
    const isLegacyCurrent =
      row.importKey === "springboks-current:rassie-erasmus:head-coach" ||
      row.importKey === "current-coach:south-africa:head_coach:rassie-erasmus" ||
      row.importKey?.includes(":head_coach:current");
    if (!isLegacyCurrent) continue;
    await db
      .update(teamCoachingStaff)
      .set({
        isCurrent: false,
        isPrimaryCoach: false,
        showOnOverview: false,
        recordStatus: "needs_review",
        verifiedAt: null,
        notes: "Hidden duplicate of Wikipedia-verified South Africa Head Coach stints.",
        updatedAt: new Date(),
      })
      .where(eq(teamCoachingStaff.id, row.id));
    console.log("hid duplicate assignment", row.importKey);
  }

  const coaching = [
    {
      importKey: "wikipedia:rassie:fsc:coach:2004-2006",
      teamId: FSC,
      role: "head_coach",
      careerType: "coach",
      startDate: "2004-01-01",
      endDate: "2006-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      notes: "Free State Cheetahs — Wikipedia coaching table 2004–2006.",
    },
    {
      importKey: "wikipedia:rassie:fsc:coach:2006-2007",
      teamId: FSC,
      role: "head_coach",
      careerType: "coach",
      startDate: "2006-01-01",
      endDate: "2007-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      notes:
        "Free State Cheetahs / Cheetahs Super 14 — Wikipedia 2006–2007 Cheetahs row, shown as Free State Cheetahs Head Coach.",
    },
    {
      importKey: "wikipedia:rassie:sa:tech-adviser:2007",
      teamId: SA,
      role: "technical_adviser",
      careerType: "technical",
      startDate: "2007-01-01",
      endDate: "2007-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Technical Adviser",
      notes: "South Africa (Technical Adviser) — Wikipedia coaching table 2007.",
      eligibleForCareerRecord: false,
    },
    {
      importKey: "wikipedia:rassie:wp:coach:2007-2010",
      teamId: WP,
      role: "director_of_rugby",
      careerType: "coach",
      startDate: "2007-01-01",
      endDate: "2010-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Director of Coaching / Head Coach",
      notes:
        "Western Province — Wikipedia 2007–2010. Prose: director of rugby from 2007; also head coach. Overlaps Stormers 2008–2011.",
    },
    {
      importKey: "wikipedia:rassie:stormers:coach:2008-2011",
      teamId: STORMERS,
      role: "head_coach",
      careerType: "coach",
      startDate: "2008-01-01",
      endDate: "2011-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      notes: "Stormers — Wikipedia coaching table 2008–2011. Overlaps Western Province.",
    },
    {
      importKey: "wikipedia:rassie:sa:tech-specialist:2011",
      teamId: SA,
      role: "technical_specialist",
      careerType: "technical",
      startDate: "2011-01-01",
      endDate: "2011-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Technical Specialist",
      notes: "South Africa (Technical Specialist) — Wikipedia coaching table 2011 / RWC.",
      eligibleForCareerRecord: false,
    },
    {
      importKey: "wikipedia:rassie:sa:gm-hp:2012-2016",
      teamId: SA,
      role: "other",
      careerType: "management",
      startDate: "2012-04-01",
      endDate: "2016-06-30",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "General Manager / High Performance",
      notes:
        "SARU General Manager: High Performance teams from April 2012 (Wikipedia prose). Not in infobox coaching table; verified from article body.",
      eligibleForCareerRecord: false,
    },
    {
      importKey: "wikipedia:rassie:munster:dor:2016-2017",
      teamId: MUNSTER,
      role: "director_of_rugby",
      careerType: "management",
      startDate: "2016-07-01",
      endDate: "2017-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Director of Rugby / Head Coach",
      notes:
        "Munster Director of Rugby from 1 July 2016. Took on head-coach duties after Anthony Foley’s death.",
      eligibleForCareerRecord: true,
    },
    {
      importKey: "wikipedia:rassie:sa:dor:2017-2024",
      teamId: SA,
      role: "director_of_rugby",
      careerType: "management",
      startDate: "2017-12-01",
      endDate: "2024-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Director of Rugby",
      notes: "Director of Rugby (Wikipedia 2017–2024). Overlaps 2018–19 and 2024 Head Coach stints.",
      eligibleForCareerRecord: false,
    },
    {
      importKey: "wikipedia:rassie:sa:hc:2018-2019",
      teamId: SA,
      role: "head_coach",
      careerType: "coach",
      startDate: "2018-03-01",
      endDate: "2019-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      notes: "First Springboks head-coach appointment (March 2018–2019 World Cup). Overlaps DoR.",
    },
    {
      importKey: "wikipedia:rassie:barbarians:coach:2018",
      teamId: BARBS,
      role: "head_coach",
      careerType: "coach",
      startDate: "2018-01-01",
      endDate: "2018-12-31",
      isCurrent: false,
      isPrimaryCoach: false,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      notes: "Barbarians — Wikipedia coaching table 2018.",
      eligibleForCareerRecord: false,
    },
    {
      importKey: "wikipedia:rassie:sa:hc:2024-",
      teamId: SA,
      role: "head_coach",
      careerType: "coach",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      isPrimaryCoach: true,
      showOnOverview: true,
      overviewLabel: "Head Coach",
      notes: "South Africa Head Coach (Wikipedia 2024–present).",
    },
  ] as const;

  for (const c of coaching) {
    const r = await upsertAssignment(db, c);
    console.log("coach", c.importKey, r.created ? "created" : "updated");
  }

  const stints = await db
    .select()
    .from(coachPlayingStints)
    .where(eq(coachPlayingStints.coachId, COACH_ID));
  const assignments = await db
    .select()
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.coachId, COACH_ID));

  console.log(
    JSON.stringify(
      {
        playingCount: stints.length,
        playingOverview: stints.filter((s) => s.showOnOverview).map((s) => s.yearsLabel + " " + s.teamName),
        coachingCount: assignments.length,
        coachingOverview: assignments
          .filter((a) => a.showOnOverview || a.isCurrent)
          .sort((a, b) => String(a.startDate ?? "").localeCompare(String(b.startDate ?? "")))
          .map(
            (a) =>
              `${a.startDate?.slice(0, 4) ?? "—"}–${a.isCurrent ? "present" : a.endDate?.slice(0, 4) ?? "—"} ${a.overviewLabel || a.role}`,
          ),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
