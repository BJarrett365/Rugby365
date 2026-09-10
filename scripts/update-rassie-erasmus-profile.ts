/**
 * Verify and load Rassie Erasmus onto the public /coaches/rassie-erasmus profile.
 *
 * Merges the empty slug row with the legacy duplicate, writes sourced CMS fields,
 * dated tenures, honours, then recalculates career stats from fixtures.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/update-rassie-erasmus-profile.ts
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { and, eq, ilike, or, sql } from "drizzle-orm";
import {
  coachAwards,
  coachHonours,
  coachMatchRatings,
  coachMedals,
  coachPlayingStints,
  coaches,
  competitions,
  fixtures,
  teamCoachingStaff,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { updateCoach, upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { mergeCoachRecords } from "../apps/web/src/lib/entity-dedup-service";
import { recalculateCoach } from "../apps/web/src/lib/coach-recalc-service";
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { setCoachPrimaryImage } from "../apps/web/src/lib/coach-image-service";
import { syncCoachLegacyAchievements } from "../apps/web/src/lib/achievement-service";
import { getPublicCoachProfile } from "../apps/web/src/lib/public-coach-profile-service";
import {
  fetchCommonsPortraitForPerson,
  fetchWikipediaOriginalImages,
} from "../apps/web/src/lib/wikipedia-page-image";
import {
  RASSIE_ERASMUS_COACHING_TENURES,
  RASSIE_ERASMUS_PROFILE,
  RASSIE_ERASMUS_SLUG,
  RASSIE_ERASMUS_WIKIPEDIA,
  isRassieSpringbokHeadCoachMatchDate,
} from "../apps/web/src/lib/rassie-erasmus-verified-career";

const WIKI = RASSIE_ERASMUS_WIKIPEDIA;

async function resolvePublicCoachId() {
  const db = getDb();
  const [canonical] = await db
    .select({ id: coaches.id, slug: coaches.slug })
    .from(coaches)
    .where(eq(coaches.slug, RASSIE_ERASMUS_SLUG))
    .limit(1);
  if (!canonical) throw new Error("Public coach slug rassie-erasmus not found");

  const duplicates = await db
    .select({ id: coaches.id, slug: coaches.slug })
    .from(coaches)
    .where(
      and(
        or(ilike(coaches.slug, "rassie-erasmus__legacy__%"), ilike(coaches.name, "Rassie Erasmus")),
        sql`${coaches.id} <> ${canonical.id}`,
      ),
    );
  const duplicateIds = duplicates.map((row) => row.id);
  if (duplicateIds.length) {
    await mergeCoachRecords(canonical.id, duplicateIds);
    console.log("merged duplicate coach ids", duplicateIds);
  }
  return canonical.id;
}

async function teamIdBySlugs(candidates: string[]): Promise<string | null> {
  const db = getDb();
  for (const slug of candidates) {
    const [row] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, slug))
      .limit(1);
    if (row) return row.id;
  }
  const [fuzzy] = await db
    .select({ id: teams.id, slug: teams.slug, name: teams.name })
    .from(teams)
    .where(ilike(teams.name, candidates[0].replace(/-/g, " ")))
    .limit(5);
  return fuzzy?.id ?? null;
}

async function competitionIdBySlug(slug: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function upsertPlayingStint(
  coachId: string,
  row: {
    sourceId: string;
    teamType: string;
    careerType: string;
    startYear: number;
    endYear: number | null;
    yearsLabel: string;
    teamName: string;
    teamId: string | null;
    apps?: number | null;
    points?: number | null;
    showOnOverview: boolean;
    sortOrder: number;
  },
) {
  const db = getDb();
  const sourceUrl = `${WIKI}#${row.sourceId}`;
  const [existing] = await db
    .select({ id: coachPlayingStints.id })
    .from(coachPlayingStints)
    .where(and(eq(coachPlayingStints.coachId, coachId), eq(coachPlayingStints.sourceUrl, sourceUrl)))
    .limit(1);
  const payload = {
    coachId,
    teamType: row.teamType,
    careerType: row.careerType,
    startYear: row.startYear,
    endYear: row.endYear,
    yearsLabel: row.yearsLabel,
    teamName: row.teamName,
    teamId: row.teamId,
    apps: row.apps ?? null,
    points: row.points ?? null,
    country: "South Africa",
    sortOrder: row.sortOrder,
    sourceProvider: "wikipedia",
    sourceUrl,
    verifiedAt: new Date(),
    showOnOverview: row.showOnOverview,
    recordStatus: "verified",
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(coachPlayingStints).set(payload).where(eq(coachPlayingStints.id, existing.id));
    return;
  }
  await db.insert(coachPlayingStints).values(payload);
}

async function upsertHonour(
  coachId: string,
  row: {
    sourceId: string;
    roleType: string;
    year: number;
    competitionName: string;
    competitionId?: string | null;
    teamName: string;
    teamId?: string | null;
    achievementType: string;
    honourLevel: string;
    shared?: boolean;
    showOnOverview: boolean;
    notes?: string;
  },
) {
  const db = getDb();
  const [existing] = await db
    .select({ id: coachHonours.id })
    .from(coachHonours)
    .where(
      and(
        eq(coachHonours.coachId, coachId),
        eq(coachHonours.year, row.year),
        eq(coachHonours.competitionName, row.competitionName),
        eq(coachHonours.roleType, row.roleType),
        eq(coachHonours.achievementType, row.achievementType),
      ),
    )
    .limit(1);
  const payload = {
    coachId,
    roleType: row.roleType,
    year: row.year,
    competitionName: row.competitionName,
    competitionId: row.competitionId ?? null,
    teamName: row.teamName,
    teamId: row.teamId ?? null,
    achievementType: row.achievementType,
    honourLevel: row.honourLevel,
    shared: row.shared ?? false,
    notes: row.notes ?? null,
    sourceUrl: WIKI,
    sourceId: row.sourceId,
    verifiedAt: new Date(),
    showOnOverview: row.showOnOverview,
    visibility: "public",
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(coachHonours).set(payload).where(eq(coachHonours.id, existing.id));
    return;
  }
  await db.insert(coachHonours).values(payload);
}

async function upsertAward(
  coachId: string,
  row: {
    year: number;
    awardName: string;
    awardingBody: string;
    sourceUrl: string;
    isMajor: boolean;
    showOnOverview: boolean;
  },
) {
  const db = getDb();
  const [existing] = await db
    .select({ id: coachAwards.id })
    .from(coachAwards)
    .where(
      and(
        eq(coachAwards.coachId, coachId),
        eq(coachAwards.year, row.year),
        eq(coachAwards.awardName, row.awardName),
      ),
    )
    .limit(1);
  const payload = {
    coachId,
    year: row.year,
    awardName: row.awardName,
    awardingBody: row.awardingBody,
    result: "winner",
    isMajor: row.isMajor,
    sourceUrl: row.sourceUrl,
    verifiedAt: new Date(),
    showOnOverview: row.showOnOverview,
    visibility: "public",
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(coachAwards).set(payload).where(eq(coachAwards.id, existing.id));
    return;
  }
  await db.insert(coachAwards).values(payload);
}

async function upsertMedal(
  coachId: string,
  row: {
    roleType: string;
    year: number;
    competitionName: string;
    competitionId?: string | null;
    teamName: string;
    teamId?: string | null;
    finish: string;
    medalType: string;
  },
) {
  const db = getDb();
  const [existing] = await db
    .select({ id: coachMedals.id })
    .from(coachMedals)
    .where(
      and(
        eq(coachMedals.coachId, coachId),
        eq(coachMedals.year, row.year),
        eq(coachMedals.competitionName, row.competitionName),
        eq(coachMedals.roleType, row.roleType),
      ),
    )
    .limit(1);
  const payload = {
    coachId,
    roleType: row.roleType,
    year: row.year,
    competitionName: row.competitionName,
    competitionId: row.competitionId ?? null,
    teamName: row.teamName,
    teamId: row.teamId ?? null,
    finish: row.finish,
    medalType: row.medalType,
    sourceUrl: WIKI,
    verifiedAt: new Date(),
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(coachMedals).set(payload).where(eq(coachMedals.id, existing.id));
    return;
  }
  await db.insert(coachMedals).values(payload);
}

async function hideStaleCurrentAssignments(coachId: string, keepImportKey: string) {
  const db = getDb();
  const rows = await db
    .select({ id: teamCoachingStaff.id, importKey: teamCoachingStaff.importKey })
    .from(teamCoachingStaff)
    .where(and(eq(teamCoachingStaff.coachId, coachId), eq(teamCoachingStaff.isCurrent, true)));
  for (const row of rows) {
    if (row.importKey === keepImportKey) continue;
    await db
      .update(teamCoachingStaff)
      .set({
        isCurrent: false,
        isPrimaryCoach: false,
        updatedAt: new Date(),
      })
      .where(eq(teamCoachingStaff.id, row.id));
  }
}

/** Seed/legacy rows must not remain eligible — an open 2018–present SA HC window would count Nienaber Tests. */
async function disableLeftoverEligibleAssignments(coachId: string) {
  const db = getDb();
  const keep = new Set(RASSIE_ERASMUS_COACHING_TENURES.map((row) => row.importKey));
  const rows = await db
    .select({
      id: teamCoachingStaff.id,
      importKey: teamCoachingStaff.importKey,
      notes: teamCoachingStaff.notes,
    })
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.coachId, coachId));
  for (const row of rows) {
    if (row.importKey && keep.has(row.importKey)) continue;
    await db
      .update(teamCoachingStaff)
      .set({
        isCurrent: false,
        isPrimaryCoach: false,
        eligibleForCareerRecord: false,
        showOnOverview: false,
        recordStatus: "conflict",
        notes: [row.notes, "Disabled leftover seed/legacy assignment; replaced by verified tenures."]
          .filter(Boolean)
          .join(" "),
        updatedAt: new Date(),
      })
      .where(eq(teamCoachingStaff.id, row.id));
    console.log("disabled leftover assignment", row.importKey ?? row.id);
  }
}

async function clearIneligibleSpringbokCoachLinks(coachId: string, southAfricaTeamId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
    })
    .from(fixtures)
    .where(
      or(
        and(eq(fixtures.homeTeamId, southAfricaTeamId), eq(fixtures.homeCoachId, coachId)),
        and(eq(fixtures.awayTeamId, southAfricaTeamId), eq(fixtures.awayCoachId, coachId)),
      ),
    );
  let cleared = 0;
  for (const row of rows) {
    const day = row.kickoffAt ? row.kickoffAt.toISOString().slice(0, 10) : "";
    if (day && isRassieSpringbokHeadCoachMatchDate(day)) continue;
    const patch: { homeCoachId?: null; awayCoachId?: null } = {};
    if (row.homeTeamId === southAfricaTeamId && row.homeCoachId === coachId) patch.homeCoachId = null;
    if (row.awayTeamId === southAfricaTeamId && row.awayCoachId === coachId) patch.awayCoachId = null;
    if (!Object.keys(patch).length) continue;
    await db.update(fixtures).set(patch).where(eq(fixtures.id, row.id));
    await db
      .delete(coachMatchRatings)
      .where(and(eq(coachMatchRatings.coachId, coachId), eq(coachMatchRatings.fixtureId, row.id)));
    cleared += 1;
  }
  console.log("cleared ineligible Springboks coach links", cleared);
}

async function resolveProfileImage(existingUrl: string | null): Promise<string | null> {
  if (existingUrl?.trim()) return existingUrl;
  try {
    const wiki = await fetchWikipediaOriginalImages(["Rassie Erasmus"]);
    const fromWiki = wiki.get("Rassie Erasmus") ?? null;
    if (fromWiki) return fromWiki;
    return await fetchCommonsPortraitForPerson("Rassie Erasmus");
  } catch (error) {
    console.warn("profile image lookup failed", error);
    return null;
  }
}

async function main() {
  const coachId = await resolvePublicCoachId();
  const profile = RASSIE_ERASMUS_PROFILE;
  const db = getDb();
  const [existingCoach] = await db
    .select({ imageUrl: coaches.imageUrl })
    .from(coaches)
    .where(eq(coaches.id, coachId))
    .limit(1);
  const imageUrl = await resolveProfileImage(existingCoach?.imageUrl ?? null);

  await updateCoach(coachId, {
    name: profile.name,
    knownAs: profile.knownAs,
    fullName: profile.fullName,
    birthDate: profile.birthDate,
    placeOfBirth: profile.placeOfBirth,
    countryOfBirth: profile.countryOfBirth,
    nationality: profile.nationality,
    heightCm: profile.heightCm,
    formerPlayingPositions: profile.formerPlayingPositions,
    playingCareerStatus: profile.playingCareerStatus,
    coachingCareerStartYear: profile.coachingCareerStartYear,
    appointedOn: profile.appointedOn,
    contractExpiresOn: profile.contractExpiresOn,
    preferredSystem: profile.preferredSystem,
    coachingStyle: profile.coachingStyle,
    preferredSystemProvenance: "unverified",
    coachingStyleProvenance: "unverified",
    bioSummary: profile.bioSummary,
    wikipediaUrl: profile.wikipediaUrl,
    wikidataId: profile.wikidataId,
    sourceUrl: profile.sourceUrl,
    notes:
      "Contract: SA Rugby announced a four-year extension on 5 December 2025 through the 2031 Rugby World Cup. No exact calendar expiry date published. Style/system left empty — no official named system sourced.",
    isPublic: true,
    publishStatus: "published",
    seoTitle: "Rassie Erasmus | Springboks head coach | Rugby365",
    seoDescription:
      "Profile and coaching record for Johan “Rassie” Erasmus, Springboks head coach and 2019 Rugby World Cup-winning coach.",
    verify: true,
  });
  if (imageUrl && imageUrl !== existingCoach?.imageUrl) {
    await setCoachPrimaryImage({
      coachId,
      imageUrl,
      sourceProvider: "wikipedia",
      sourcePageUrl: RASSIE_ERASMUS_WIKIPEDIA,
      altText: "Rassie Erasmus",
      credit: "Wikimedia Commons / Wikipedia",
    });
  }

  const saId = await teamIdBySlugs(["south-africa"]);
  if (!saId) throw new Error("south-africa team not found");
  const freeStateId = await teamIdBySlugs(["free-state"]);
  const catsId = await teamIdBySlugs(["cats"]);
  const lionsId = await teamIdBySlugs(["lions-k76kd1jy", "golden-lions", "lions"]);
  const stormersId = await teamIdBySlugs(["dhl-stormers-xxiii-pd9ry3j8", "stormers"]);
  const trcId = await competitionIdBySlug("rugby-championship");
  const rwcId = await competitionIdBySlug("rugby-world-cup");
  const currieId = await competitionIdBySlug("currie-cup");

  await upsertPlayingStint(coachId, {
    sourceId: "playing-international",
    teamType: "international",
    careerType: "international_player",
    startYear: 1997,
    endYear: 2001,
    yearsLabel: "1997–2001",
    teamName: "South Africa",
    teamId: saId,
    apps: 36,
    points: 35,
    showOnOverview: true,
    sortOrder: 50,
  });
  await upsertPlayingStint(coachId, {
    sourceId: "playing-free-state",
    teamType: "provincial",
    careerType: "provincial_player",
    startYear: 1994,
    endYear: 2003,
    yearsLabel: "1994–98, 2001–03",
    teamName: "Free State",
    teamId: freeStateId,
    apps: 112,
    showOnOverview: true,
    sortOrder: 10,
  });
  await upsertPlayingStint(coachId, {
    sourceId: "playing-golden-lions",
    teamType: "provincial",
    careerType: "provincial_player",
    startYear: 1998,
    endYear: 2000,
    yearsLabel: "1998–2000",
    teamName: "Golden Lions",
    teamId: lionsId,
    apps: 7,
    showOnOverview: false,
    sortOrder: 20,
  });
  await upsertPlayingStint(coachId, {
    sourceId: "playing-cats",
    teamType: "franchise",
    careerType: "super_rugby_player",
    startYear: 1998,
    endYear: 2001,
    yearsLabel: "1998–2001",
    teamName: "Cats",
    teamId: catsId,
    apps: 46,
    points: 45,
    showOnOverview: false,
    sortOrder: 40,
  });
  await upsertPlayingStint(coachId, {
    sourceId: "playing-stormers",
    teamType: "franchise",
    careerType: "super_rugby_player",
    startYear: 2003,
    endYear: 2003,
    yearsLabel: "2003",
    teamName: "Stormers",
    teamId: stormersId,
    apps: 4,
    showOnOverview: false,
    sortOrder: 45,
  });

  const missingTeams: string[] = [];
  for (const tenure of RASSIE_ERASMUS_COACHING_TENURES) {
    const teamId = await teamIdBySlugs(tenure.teamSlugCandidates);
    if (!teamId) {
      missingTeams.push(tenure.importKey);
      console.warn("skip tenure, team not found", tenure.importKey, tenure.teamSlugCandidates);
      continue;
    }
    await upsertCoachingStaffAssignment({
      coachId,
      teamId,
      role: tenure.role,
      careerType: tenure.careerType,
      startDate: tenure.startDate,
      endDate: tenure.endDate,
      isCurrent: tenure.isCurrent,
      isPrimaryCoach: tenure.isPrimaryCoach,
      eligibleForCareerRecord: tenure.eligibleForCareerRecord,
      showOnOverview: tenure.showOnOverview,
      overviewLabel: tenure.overviewLabel,
      teamDisplayName: tenure.teamDisplayName ?? null,
      recordStatus: "verified",
      notes: tenure.notes,
      sourceUrl: tenure.sourceUrl,
      importKey: tenure.importKey,
      confidence: "high",
      verifiedAt: new Date(),
    });
  }
  await hideStaleCurrentAssignments(coachId, "wikipedia:rassie:sa:hc:2024-");
  await disableLeftoverEligibleAssignments(coachId);
  await clearIneligibleSpringbokCoachLinks(coachId, saId);

  const honourRows: Array<Parameters<typeof upsertHonour>[1]> = [
    {
      sourceId: "player-trc-1998",
      roleType: "player",
      year: 1998,
      competitionName: "Tri Nations",
      competitionId: trcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "winner",
      honourLevel: "major",
      showOnOverview: true,
    },
    {
      sourceId: "player-rwc-1999",
      roleType: "player",
      year: 1999,
      competitionName: "Rugby World Cup",
      competitionId: rwcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "third",
      honourLevel: "major",
      showOnOverview: true,
      notes: "Squad member; third-place play-off (Wikipedia).",
    },
    {
      sourceId: "coach-currie-2005",
      roleType: "coach",
      year: 2005,
      competitionName: "Currie Cup",
      competitionId: currieId,
      teamName: "Free State Cheetahs",
      achievementType: "winner",
      honourLevel: "domestic_major",
      showOnOverview: true,
    },
    {
      sourceId: "coach-currie-2006",
      roleType: "coach",
      year: 2006,
      competitionName: "Currie Cup",
      competitionId: currieId,
      teamName: "Free State Cheetahs",
      achievementType: "winner",
      honourLevel: "domestic_major",
      shared: true,
      showOnOverview: true,
      notes: "Shared with the Blue Bulls after extra time (Wikipedia).",
    },
    {
      sourceId: "coach-super14-2010",
      roleType: "coach",
      year: 2010,
      competitionName: "Super 14",
      teamName: "Stormers",
      teamId: stormersId,
      achievementType: "runner_up",
      honourLevel: "domestic_major",
      showOnOverview: false,
      notes: "Wikipedia lists this under Erasmus. Allister Coetzee was named Stormers head coach from mid-2009.",
    },
    {
      sourceId: "coach-currie-2010",
      roleType: "coach",
      year: 2010,
      competitionName: "Currie Cup",
      competitionId: currieId,
      teamName: "Western Province",
      achievementType: "runner_up",
      honourLevel: "domestic_major",
      showOnOverview: false,
      notes: "Wikipedia lists this under Erasmus. Coetzee was named provincial head coach from mid-2009.",
    },
    {
      sourceId: "coach-pro12-2017",
      roleType: "coach",
      year: 2017,
      competitionName: "Pro12",
      teamName: "Munster",
      achievementType: "runner_up",
      honourLevel: "domestic_major",
      showOnOverview: true,
    },
    {
      sourceId: "coach-trc-2018",
      roleType: "coach",
      year: 2018,
      competitionName: "The Rugby Championship",
      competitionId: trcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "runner_up",
      honourLevel: "major",
      showOnOverview: false,
      notes: "Named head coach. South Africa finished second (Wikipedia).",
    },
    {
      sourceId: "coach-trc-2019",
      roleType: "coach",
      year: 2019,
      competitionName: "The Rugby Championship",
      competitionId: trcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "winner",
      honourLevel: "major",
      showOnOverview: true,
    },
    {
      sourceId: "coach-rwc-2019",
      roleType: "coach",
      year: 2019,
      competitionName: "Rugby World Cup",
      competitionId: rwcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "winner",
      honourLevel: "major",
      showOnOverview: true,
    },
    {
      sourceId: "coach-rwc-2023",
      roleType: "coach",
      year: 2023,
      competitionName: "Rugby World Cup",
      competitionId: rwcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "winner",
      honourLevel: "major",
      showOnOverview: true,
      notes:
        "Director of Rugby. Jacques Nienaber was the named head coach. SA Rugby and Wikipedia credit Erasmus with the 2023 World Cup programme.",
    },
    {
      sourceId: "coach-trc-2024",
      roleType: "coach",
      year: 2024,
      competitionName: "The Rugby Championship",
      competitionId: trcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "winner",
      honourLevel: "major",
      showOnOverview: true,
    },
    {
      sourceId: "coach-trc-2025",
      roleType: "coach",
      year: 2025,
      competitionName: "The Rugby Championship",
      competitionId: trcId,
      teamName: "South Africa",
      teamId: saId,
      achievementType: "winner",
      honourLevel: "major",
      showOnOverview: true,
    },
  ];
  for (const honour of honourRows) {
    await upsertHonour(coachId, honour);
  }

  await upsertAward(coachId, {
    year: 2017,
    awardName: "Pro12 Coach of the Season",
    awardingBody: "Pro12",
    sourceUrl: "https://www.munsterrugby.ie/",
    isMajor: false,
    showOnOverview: true,
  });
  await upsertAward(coachId, {
    year: 2019,
    awardName: "World Rugby Coach of the Year",
    awardingBody: "World Rugby",
    sourceUrl: "https://www.bbc.com/sport/rugby-union/50283216",
    isMajor: true,
    showOnOverview: true,
  });
  await upsertAward(coachId, {
    year: 2026,
    awardName: "Order of Ikhamanga",
    awardingBody: "The Presidency of South Africa",
    sourceUrl: "https://www.sarugbymag.co.za/rassie-receives-order-of-ikhamanga/",
    isMajor: true,
    showOnOverview: true,
  });

  await upsertMedal(coachId, {
    roleType: "player",
    year: 1999,
    competitionName: "Rugby World Cup",
    competitionId: rwcId,
    teamName: "South Africa",
    teamId: saId,
    finish: "third",
    medalType: "bronze",
  });
  await upsertMedal(coachId, {
    roleType: "coach",
    year: 2019,
    competitionName: "Rugby World Cup",
    competitionId: rwcId,
    teamName: "South Africa",
    teamId: saId,
    finish: "winner",
    medalType: "gold",
  });
  await upsertMedal(coachId, {
    roleType: "director_of_rugby",
    year: 2023,
    competitionName: "Rugby World Cup",
    competitionId: rwcId,
    teamName: "South Africa",
    teamId: saId,
    finish: "winner",
    medalType: "gold",
  });

  await syncCoachLegacyAchievements(coachId);

  const recalc = await recalculateCoach(coachId, {
    refreshLinks: true,
    persistRatings: true,
    overwriteLinks: true,
  });
  if (recalc.careerPlayed > 0) {
    await persistCoachRatingSnapshot(coachId);
  }

  const publicProfile = await getPublicCoachProfile(RASSIE_ERASMUS_SLUG, { preview: true });
  console.log(
    JSON.stringify(
      {
        coachId,
        missingTeams,
        recalc: {
          careerPlayed: recalc.careerPlayed,
          ratingsPersisted: recalc.ratingsPersisted,
          links: recalc.links,
        },
        public: publicProfile
          ? {
              slug: publicProfile.slug,
              fullName: publicProfile.fullName,
              knownAs: publicProfile.knownAs,
              birthDate: publicProfile.birthDate,
              age: publicProfile.age,
              nationality: publicProfile.nationality,
              appointedOn: publicProfile.appointedOn,
              contractExpiresOn: publicProfile.contractExpiresOn,
              currentRole: publicProfile.currentRole?.overviewLabel ?? publicProfile.currentRole?.role,
              currentTeam: publicProfile.currentRole?.teamName,
              honours: publicProfile.honours.length,
              awards: publicProfile.awards.length,
              assignments: publicProfile.assignments.length,
              careerPlayed: publicProfile.careerRecord.played,
              careerWins: publicProfile.careerRecord.wins,
              majorHonours: publicProfile.majorHonoursCount,
              snapshot: publicProfile.careerSnapshot,
              imageUrl: publicProfile.imageUrl,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
