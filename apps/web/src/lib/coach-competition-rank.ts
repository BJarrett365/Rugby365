/**
 * Competition-scoped coach rankings (Currie Cup Premier + Hilux NPC).
 * Separate from World Rank — useful while the global coach set is still thin.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { coachRatingSnapshots, coaches, teamCoachingStaff, teams } from "@rugby365/db";
import { getDb } from "./db";

/** 2026 Currie Cup Premier Division side IDs (CMS teams). */
export const CURRIE_CUP_PREMIER_2026_TEAM_IDS = [
  "41af3238-709f-4539-9d11-6b3176528950", // Boland Cavaliers
  "99f818a1-794f-4e9f-a7bb-41d259c68337", // Bulls (Bulls XV)
  "32324b5d-f326-4e4d-b1f7-a5562c917ae3", // Cheetahs
  "9b0939ae-e515-4815-9a71-b1b64cc9c031", // Griquas
  "cd89c524-a07d-4ee3-aa6a-959e22fe9a98", // Lions
  "2cba5c69-6d45-463e-9141-801697473ed7", // Pumas
  "a4907a68-de2d-4faa-8a12-6883ad6142ba", // Sharks (Sharks XV)
  "9c7ff5c6-e6e6-4067-bf22-0cd154aaba4d", // DHL Stormers XXIII
] as const;

/** 2026/27 Gallagher Premiership (PREM) side IDs (CMS teams). */
export const PREM_2026_27_TEAM_IDS = [
  "95ae893d-5429-4dd6-8990-ae898c200eef", // Bath
  "5c8f53ef-4a9e-46c4-b603-697289fbdf95", // Bristol Bears
  "7d2713fa-ee50-46f5-9a76-cfca88dbec94", // Exeter Chiefs
  "0495a0e5-b1ba-4cb9-878f-1de13893ecad", // Gloucester
  "80571a64-5088-4284-863c-ca85a7dc1bb1", // Harlequins
  "1d1bcadf-006f-45bd-85e2-91e50b9bb843", // Leicester Tigers
  "4cb571a0-f199-4ff0-ad13-3c3f20547cf7", // Newcastle (Red Bulls)
  "cfcdc2cc-0f92-48dd-84bc-ef1b40c686f8", // Northampton Saints
  "5c4f05ae-6fa2-44bb-99d2-44615d29ff00", // Sale Sharks
  "fbd298b9-79eb-4b8c-8438-eec55eb4d06d", // Saracens
] as const;

/** 2026 Hilux NPC provincial side IDs (CMS teams). */
export const NPC_2026_TEAM_IDS = [
  "cf089a23-184a-47ab-98eb-acdae82e199c", // Auckland
  "086b5bda-26c3-4855-a93c-21a76503f985", // Bay of Plenty
  "141ce8f7-2ac4-4283-b44e-5aaf62e54d9d", // Canterbury
  "d54c3618-057e-4d34-80a9-2bbb12eca0c5", // Counties Manukau
  "cfd41b38-e1d0-4e5e-84cd-4fb512908e0c", // Hawke's Bay
  "36517f4a-58e5-40b0-810c-5448c4ad272d", // Manawatu
  "671eba41-08f5-4e14-bcf9-9ddf59d8ffea", // North Harbour
  "e9cd8279-448e-459e-a7fd-f2938256ec37", // Northland
  "492165e7-2f82-40bb-9315-709839bf32e1", // Otago
  "8c037df8-45cb-463d-a816-c825c13ad2af", // Southland
  "7b1ee9db-a8ee-4db6-88a5-425212c63001", // Taranaki
  "be756fbc-9abb-4bde-9076-a414dabe8e3f", // Tasman
  "21e51635-42eb-492f-a4e4-6154a727f6e0", // Waikato
  "6b9c5528-43ef-48a0-9255-2e3561638fac", // Wellington
] as const;

export const CURRIE_CUP_RANK_LABEL = "Currie Cup Coach Rank";
export const CURRIE_CUP_RANK_SUB = "2026 Premier Division";
export const NPC_RANK_LABEL = "NPC Coach Rank";
export const NPC_RANK_SUB = "2026 Hilux NPC";
export const PREM_RANK_LABEL = "PREM Coach Rank";
export const PREM_RANK_SUB = "2026/27 Premiership";

export type CompetitionCoachRankRow = {
  rank: number;
  coachId: string;
  name: string;
  slug: string;
  nationality: string | null;
  imageUrl: string | null;
  teamId: string;
  teamName: string;
  /** Null when Coach Rating is not yet publishable (tiny match sample). */
  rating: number | null;
  powerIndex: number | null;
  momentum: number | null;
};

export type CompetitionRankResult = {
  rank: number | null;
  rankedOutOf: number | null;
  label: string;
  sub: string;
};

async function listPremierCoachIds(
  teamIds: readonly string[],
): Promise<Array<{ coachId: string; teamId: string; teamName: string }>> {
  const db = getDb();
  const rows = await db
    .select({
      coachId: teamCoachingStaff.coachId,
      teamId: teamCoachingStaff.teamId,
      teamName: teams.name,
      isPrimary: teamCoachingStaff.isPrimaryCoach,
      isCurrent: teamCoachingStaff.isCurrent,
      role: teamCoachingStaff.role,
    })
    .from(teamCoachingStaff)
    .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
    .where(
      and(
        inArray(teamCoachingStaff.teamId, [...teamIds]),
        eq(teamCoachingStaff.isCurrent, true),
      ),
    );

  const byTeam = new Map<string, (typeof rows)[number]>();
  const rolePriority = (role: string) => {
    if (role === "head_coach") return 0;
    if (role === "head_of_rugby") return 1;
    if (role === "director_of_rugby") return 2;
    return 9;
  };
  const preferred = [...rows].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return rolePriority(a.role) - rolePriority(b.role);
  });
  for (const r of preferred) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, r);
  }
  return [...byTeam.values()].map((r) => ({
    coachId: r.coachId,
    teamId: r.teamId,
    teamName: r.teamName,
  }));
}

async function listCompetitionRankings(
  teamIds: readonly string[],
  limit: number,
): Promise<CompetitionCoachRankRow[]> {
  const linked = await listPremierCoachIds(teamIds);
  if (!linked.length) return [];

  const db = getDb();
  const coachIds = linked.map((l) => l.coachId);
  const snaps = await db
    .select({
      coachId: coachRatingSnapshots.coachId,
      overallRating: coachRatingSnapshots.overallRating,
      powerIndex: coachRatingSnapshots.powerIndex,
      momentum: coachRatingSnapshots.momentum,
      calculatedAt: coachRatingSnapshots.calculatedAt,
      name: coaches.name,
      slug: coaches.slug,
      nationality: coaches.nationality,
      imageUrl: coaches.imageUrl,
    })
    .from(coachRatingSnapshots)
    .innerJoin(coaches, eq(coachRatingSnapshots.coachId, coaches.id))
    .where(inArray(coachRatingSnapshots.coachId, coachIds))
    .orderBy(desc(coachRatingSnapshots.calculatedAt))
    .limit(400);

  const best = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) {
    if (!best.has(s.coachId)) best.set(s.coachId, s);
  }

  const dbCoaches = await db
    .select({
      id: coaches.id,
      name: coaches.name,
      slug: coaches.slug,
      nationality: coaches.nationality,
      imageUrl: coaches.imageUrl,
    })
    .from(coaches)
    .where(inArray(coaches.id, coachIds));
  const coachMeta = new Map(dbCoaches.map((c) => [c.id, c]));
  const teamByCoach = new Map(linked.map((l) => [l.coachId, l]));

  // Include every linked competition coach so boards stay complete early-season
  // (null ratings sort last; still counted in rankedOutOf).
  const rows: CompetitionCoachRankRow[] = linked.map((link) => {
    const snap = best.get(link.coachId);
    const meta = coachMeta.get(link.coachId);
    return {
      rank: 0,
      coachId: link.coachId,
      name: meta?.name ?? snap?.name ?? "—",
      slug: meta?.slug ?? snap?.slug ?? "",
      nationality: meta?.nationality ?? snap?.nationality ?? null,
      imageUrl: meta?.imageUrl ?? snap?.imageUrl ?? null,
      teamId: link.teamId,
      teamName: link.teamName,
      rating: snap?.overallRating ?? null,
      powerIndex: snap?.powerIndex ?? null,
      momentum: snap?.momentum ?? null,
    };
  });

  return rows
    .sort((a, b) => {
      if (a.rating == null && b.rating == null) return a.name.localeCompare(b.name);
      if (a.rating == null) return 1;
      if (b.rating == null) return -1;
      return b.rating - a.rating;
    })
    .slice(0, limit)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function rankFromBoard(
  board: CompetitionCoachRankRow[],
  coachId: string,
  label: string,
  sub: string,
): CompetitionRankResult | null {
  if (!board.length) return null;
  const idx = board.findIndex((r) => r.coachId === coachId);
  if (idx < 0) return null;
  return {
    rank: idx + 1,
    rankedOutOf: board.length,
    label,
    sub,
  };
}

/** Current primary coaches linked to Currie Cup Premier 2026 sides. */
export async function listCurrieCupPremierCoachIds() {
  return listPremierCoachIds(CURRIE_CUP_PREMIER_2026_TEAM_IDS);
}

export async function listNpc2026CoachIds() {
  return listPremierCoachIds(NPC_2026_TEAM_IDS);
}

export async function listPrem202627CoachIds() {
  return listPremierCoachIds(PREM_2026_27_TEAM_IDS);
}

export async function listCurrieCupCoachRankings(limit = 8) {
  return listCompetitionRankings(CURRIE_CUP_PREMIER_2026_TEAM_IDS, limit);
}

export async function listNpcCoachRankings(limit = 14) {
  return listCompetitionRankings(NPC_2026_TEAM_IDS, limit);
}

export async function listPremCoachRankings(limit = 10) {
  return listCompetitionRankings(PREM_2026_27_TEAM_IDS, limit);
}

export async function getCurrieCupCoachRank(
  coachId: string,
): Promise<CompetitionRankResult | null> {
  const board = await listCurrieCupCoachRankings(8);
  return rankFromBoard(board, coachId, CURRIE_CUP_RANK_LABEL, CURRIE_CUP_RANK_SUB);
}

export async function getNpcCoachRank(
  coachId: string,
): Promise<CompetitionRankResult | null> {
  const board = await listNpcCoachRankings(14);
  return rankFromBoard(board, coachId, NPC_RANK_LABEL, NPC_RANK_SUB);
}

export async function getPremCoachRank(
  coachId: string,
): Promise<CompetitionRankResult | null> {
  const board = await listPremCoachRankings(10);
  return rankFromBoard(board, coachId, PREM_RANK_LABEL, PREM_RANK_SUB);
}

/**
 * Prefer competition board membership: Currie Cup → NPC → PREM.
 * Nations / other coaches return null (World Rank only).
 */
export async function getCompetitionCoachRank(
  coachId: string,
): Promise<CompetitionRankResult | null> {
  const currie = await getCurrieCupCoachRank(coachId);
  if (currie) return currie;
  const npc = await getNpcCoachRank(coachId);
  if (npc) return npc;
  return getPremCoachRank(coachId);
}
