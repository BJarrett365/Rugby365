/**
 * Squad / team intelligence for a coach's current side (value, XV, position ranks).
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, playerImages, playerRankingHistory, players, teams } from "@rugby365/db";
import { getDb } from "./db";
import { getTeamCompareSidePacket, type TeamSquadPlayerRow } from "./team-squad-intelligence-service";
import {
  normalizePositionFamily,
  type RadarPositionFamily,
} from "./player-radar-positions";
import { formatGbpCompact } from "./player-value-math";
import { nationalTeamNickname } from "./competition-player-stat-display";
import { isRankingRetired } from "./competition-ranking-math";
import { computeTeamRating } from "./team-rating-math";

const XV_SLOTS: Array<{
  slot: number;
  family: RadarPositionFamily;
  label: string;
  x: number;
  y: number;
}> = [
  { slot: 15, family: "full_back", label: "Full-back", x: 50, y: 10 },
  { slot: 14, family: "right_wing", label: "Right wing", x: 82, y: 18 },
  { slot: 13, family: "outside_centre", label: "Outside centre", x: 62, y: 28 },
  { slot: 12, family: "inside_centre", label: "Inside centre", x: 38, y: 28 },
  { slot: 11, family: "left_wing", label: "Left wing", x: 18, y: 18 },
  { slot: 10, family: "fly_half", label: "Fly-half", x: 50, y: 42 },
  { slot: 9, family: "scrum_half", label: "Scrum-half", x: 50, y: 54 },
  { slot: 7, family: "openside_flanker", label: "Openside", x: 72, y: 66 },
  { slot: 8, family: "number_eight", label: "No. 8", x: 50, y: 66 },
  { slot: 6, family: "blindside_flanker", label: "Blindside", x: 28, y: 66 },
  { slot: 5, family: "lock", label: "Lock", x: 60, y: 78 },
  { slot: 4, family: "lock", label: "Lock", x: 40, y: 78 },
  { slot: 3, family: "tighthead_prop", label: "Tighthead", x: 72, y: 90 },
  { slot: 2, family: "hooker", label: "Hooker", x: 50, y: 90 },
  { slot: 1, family: "loosehead_prop", label: "Loosehead", x: 28, y: 90 },
];

const POSITION_RANK_ORDER: Array<{ family: RadarPositionFamily; label: string }> = [
  { family: "loosehead_prop", label: "Loosehead Prop" },
  { family: "hooker", label: "Hooker" },
  { family: "tighthead_prop", label: "Tighthead Prop" },
  { family: "lock", label: "Lock" },
  { family: "blindside_flanker", label: "Blindside Flanker" },
  { family: "openside_flanker", label: "Openside Flanker" },
  { family: "number_eight", label: "Number Eight" },
  { family: "scrum_half", label: "Scrum-half" },
  { family: "fly_half", label: "Fly-half" },
  { family: "inside_centre", label: "Inside Centre" },
  { family: "outside_centre", label: "Outside Centre" },
  { family: "left_wing", label: "Left Wing" },
  { family: "right_wing", label: "Right Wing" },
  { family: "full_back", label: "Full-back" },
];

const FORWARD_FAMILIES = new Set<RadarPositionFamily>([
  "loosehead_prop",
  "tighthead_prop",
  "prop",
  "hooker",
  "lock",
  "blindside_flanker",
  "openside_flanker",
  "flanker",
  "number_eight",
]);

export type CoachDashboardPlayer = TeamSquadPlayerRow & {
  imageUrl: string | null;
  family: RadarPositionFamily;
};

const UNION_BY_TEAM: Record<string, string> = {
  ireland: "IRFU",
  "south africa": "SARU",
  "new zealand": "NZR",
  england: "RFU",
  wales: "WRU",
  scotland: "SRU",
  france: "FFR",
  australia: "Rugby Australia",
  argentina: "UAR",
  italy: "FIR",
  japan: "JRFU",
  fiji: "FRU",
  samoa: "SRU",
  tonga: "TRU",
  georgia: "GRU",
};

const NATION_DEFAULTS: Record<string, { foundedYear: number; homeVenueName: string }> = {
  ireland: { foundedYear: 1879, homeVenueName: "Aviva Stadium" },
  england: { foundedYear: 1871, homeVenueName: "Twickenham Stadium" },
  wales: { foundedYear: 1881, homeVenueName: "Principality Stadium" },
  scotland: { foundedYear: 1873, homeVenueName: "Murrayfield Stadium" },
  france: { foundedYear: 1919, homeVenueName: "Stade de France" },
  italy: { foundedYear: 1928, homeVenueName: "Stadio Olimpico" },
  "south africa": { foundedYear: 1889, homeVenueName: "Ellis Park Stadium" },
  "new zealand": { foundedYear: 1892, homeVenueName: "Eden Park" },
  australia: { foundedYear: 1949, homeVenueName: "Stadium Australia" },
  argentina: { foundedYear: 1899, homeVenueName: "José Amalfitani Stadium" },
  japan: { foundedYear: 1926, homeVenueName: "National Stadium" },
};

function unionForTeam(teamName: string, countryName: string | null): string | null {
  const keys = [teamName, countryName].filter(Boolean).map((v) => v!.trim().toLowerCase());
  for (const key of keys) {
    if (UNION_BY_TEAM[key]) return UNION_BY_TEAM[key];
  }
  return null;
}

function nationDefaults(teamName: string, countryName: string | null) {
  const keys = [teamName, countryName].filter(Boolean).map((v) => v!.trim().toLowerCase());
  for (const key of keys) {
    if (NATION_DEFAULTS[key]) return NATION_DEFAULTS[key];
  }
  return null;
}

export type CoachTeamDashboard = {
  teamId: string;
  teamSlug: string;
  teamName: string;
  teamShortName: string | null;
  teamImageUrl: string | null;
  countryName: string | null;
  nickname: string | null;
  unionName: string | null;
  foundedYear: number | null;
  homeVenueName: string | null;
  worldRank: number | null;
  worldRankPoints: number | null;
  teamRating: number | null;
  intelligence: Array<{ label: string; value: number | null; worldRank: number | null }>;
  keyStats: Array<{ label: string; value: string; sub: string | null }>;
  squadValueLabel: string;
  squadValueGbp: number;
  averagePlayerValueLabel: string | null;
  forwardsValueGbp: number;
  backsValueGbp: number;
  forwardsPct: number;
  backsPct: number;
  highestValuePlayer: CoachDashboardPlayer | null;
  youngestProspect: CoachDashboardPlayer | null;
  mostImproved: { id: string; slug: string; name: string; imageUrl: string | null; deltaLabel: string } | null;
  positionRanks: Array<{ family: RadarPositionFamily; label: string; worldRank: number | null; rating: number | null }>;
  topRated: CoachDashboardPlayer[];
  valuableXv: Array<CoachDashboardPlayer & { slot: number; x: number; y: number; slotLabel: string }>;
  risingStars: CoachDashboardPlayer[];
  form: Array<"W" | "D" | "L">;
};

function familyMatches(playerFamily: RadarPositionFamily, slotFamily: RadarPositionFamily): boolean {
  if (playerFamily === slotFamily) return true;
  if (slotFamily === "loosehead_prop" || slotFamily === "tighthead_prop") {
    return playerFamily === "prop";
  }
  if (slotFamily === "blindside_flanker" || slotFamily === "openside_flanker") {
    return playerFamily === "flanker";
  }
  if (slotFamily === "inside_centre" || slotFamily === "outside_centre") {
    return playerFamily === "centre";
  }
  if (slotFamily === "left_wing" || slotFamily === "right_wing") {
    return playerFamily === "wing";
  }
  if (slotFamily === "lock") return playerFamily === "lock";
  return false;
}

function pickXv(players: CoachDashboardPlayer[]): CoachTeamDashboard["valuableXv"] {
  const unused = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.marketValueGbp - a.marketValueGbp);
  const taken = new Set<string>();
  const out: CoachTeamDashboard["valuableXv"] = [];
  for (const slot of XV_SLOTS) {
    const idx = unused.findIndex((p) => !taken.has(p.id) && familyMatches(p.family, slot.family));
    const player = idx >= 0 ? unused[idx] : unused.find((p) => !taken.has(p.id)) ?? null;
    if (!player) continue;
    taken.add(player.id);
    out.push({ ...player, slot: slot.slot, x: slot.x, y: slot.y, slotLabel: slot.label });
  }
  return out;
}

async function persistWikipediaPlayerImage(playerId: string, imageUrl: string, playerName: string) {
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: playerImages.id })
      .from(playerImages)
      .where(and(eq(playerImages.playerId, playerId), eq(playerImages.imageUrl, imageUrl)))
      .limit(1);
    if (!existing) {
      await db.insert(playerImages).values({
        playerId,
        imageUrl,
        canonicalUrl: imageUrl,
        sourceProvider: "wikipedia",
        altText: playerName,
        credit: "Wikipedia",
        licence: "creative_commons",
        imageType: "headshot",
        role: "gallery",
        confidence: "medium",
        confidenceScore: 60,
        status: "approved",
        isPublic: true,
        approvedAt: new Date(),
      });
    }
    const [player] = await db
      .select({ imageUrl: players.imageUrl })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    if (!player?.imageUrl) {
      await db.update(players).set({ imageUrl }).where(eq(players.id, playerId));
    }
  } catch {
    // Unique collisions or missing columns should not break the dashboard.
  }
}

async function loadImages(
  ids: string[],
  namesById: Map<string, string>,
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!ids.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      imageUrl: players.imageUrl,
      badgeImageUrl: players.badgeImageUrl,
      wikipediaUrl: players.wikipediaUrl,
    })
    .from(players)
    .where(inArray(players.id, ids));
  for (const row of rows) {
    map.set(row.id, row.imageUrl || row.badgeImageUrl || null);
  }

  const gallery = await db
    .select({
      playerId: playerImages.playerId,
      imageUrl: playerImages.imageUrl,
      role: playerImages.role,
      imageType: playerImages.imageType,
      status: playerImages.status,
      isPublic: playerImages.isPublic,
      sourceProvider: playerImages.sourceProvider,
    })
    .from(playerImages)
    .where(
      and(
        inArray(playerImages.playerId, ids),
        sql`${playerImages.status} not in ('rejected', 'incorrect_player', 'removed')`,
      ),
    );
  const score = (row: {
    role: string | null;
    imageType: string | null;
    status: string | null;
    isPublic: boolean | null;
  }) =>
    (row.status === "approved" ? 6 : 1) +
    (row.isPublic ? 2 : 0) +
    (row.role === "primary" ? 4 : row.role === "current_international" ? 3 : row.role === "current_club" ? 2 : 1) +
    (row.imageType === "headshot" || row.imageType === "portrait" ? 2 : 0);
  const best = new Map<string, { url: string; score: number }>();
  for (const row of gallery) {
    if (!row.imageUrl) continue;
    const next = { url: row.imageUrl, score: score(row) };
    const prev = best.get(row.playerId);
    if (!prev || next.score > prev.score) best.set(row.playerId, next);
  }
  for (const [id, row] of best) {
    if (!map.get(id)) map.set(id, row.url);
  }

  const missing = ids.filter((id) => !map.get(id)).slice(0, 23);
  if (missing.length > 0) {
    const wikiTitleById = new Map<string, string[]>();
    for (const row of rows) {
      if (!missing.includes(row.id)) continue;
      const titles: string[] = [];
      const name = namesById.get(row.id);
      if (name) {
        titles.push(name);
        titles.push(`${name} rugby union`);
        titles.push(`${name} rugby player`);
      }
      const wikiPath = row.wikipediaUrl?.split("/wiki/")[1];
      if (wikiPath) titles.unshift(decodeURIComponent(wikiPath.replace(/_/g, " ")));
      wikiTitleById.set(row.id, [...new Set(titles)]);
    }
    const wikiTitles = [...new Set([...wikiTitleById.values()].flat())];
    if (wikiTitles.length > 0) {
      try {
        const { fetchWikipediaThumbnails } = await import("./wikipedia-page-image");
        const thumbs = await fetchWikipediaThumbnails(wikiTitles);
        for (const id of missing) {
          const titles = wikiTitleById.get(id) ?? [];
          const url = titles.map((title) => thumbs.get(title)).find(Boolean);
          if (!url) continue;
          map.set(id, url);
          const name = namesById.get(id) ?? titles[0] ?? "Player";
          void persistWikipediaPlayerImage(id, url, name);
        }
      } catch {
        // Keep the dashboard rendering even if Wikipedia thumbs are unavailable.
      }
    }
  }
  return map;
}

async function loadCurrentSquad(
  teamId: string,
  teamName: string,
  squad: TeamSquadPlayerRow[],
): Promise<TeamSquadPlayerRow[]> {
  if (squad.length === 0) return squad;
  const db = getDb();
  const ids = squad.map((p) => p.id);
  const statusRows = await db
    .select({ id: players.id, careerStatus: players.careerStatus, name: players.name })
    .from(players)
    .where(inArray(players.id, ids));
  const statusById = new Map(statusRows.map((row) => [row.id, row]));
  const active = squad.filter((p) => {
    const row = statusById.get(p.id);
    return !isRankingRetired({
      careerStatus: row?.careerStatus,
      name: row?.name ?? p.name,
    });
  });

  const siblingIds = (
    await db.select({ id: teams.id }).from(teams).where(eq(teams.name, teamName))
  ).map((row) => row.id);
  const teamIds = siblingIds.length > 0 ? siblingIds : [teamId];

  const since = new Date();
  since.setMonth(since.getMonth() - 18);
  const recent = await db
    .selectDistinct({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .where(and(inArray(fixturePlayers.teamId, teamIds), gte(fixtures.kickoffAt, since)));
  const recentIds = new Set(recent.map((row) => row.playerId).filter(Boolean));
  const ranked = [...active].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (recentIds.size >= 15) {
    const current = active.filter((p) => recentIds.has(p.id));
    if (current.length >= 23) return current;
    if (current.length >= 15) {
      const extras = ranked.filter((p) => !current.some((c) => c.id === p.id)).slice(0, 35 - current.length);
      return [...current, ...extras];
    }
  }
  return ranked.slice(0, 35);
}

export async function getCoachTeamDashboard(
  teamSlug: string | null | undefined,
  teamId?: string | null,
): Promise<CoachTeamDashboard | null> {
  let packet = teamSlug?.trim() ? await getTeamCompareSidePacket(teamSlug) : null;
  if (!packet && teamId) {
    const db = getDb();
    const [team] = await db
      .select({ slug: teams.slug })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (team?.slug) packet = await getTeamCompareSidePacket(team.slug);
  }
  if (!packet) return null;

  const currentSquad = await loadCurrentSquad(packet.id, packet.name, packet.squad);
  const namesById = new Map(currentSquad.map((p) => [p.id, p.name]));
  const imageById = await loadImages(
    currentSquad.map((p) => p.id),
    namesById,
  );
  const players: CoachDashboardPlayer[] = currentSquad.map((p) => ({
    ...p,
    imageUrl: imageById.get(p.id) ?? null,
    family: normalizePositionFamily(p.positionName),
  }));

  let forwardsValueGbp = 0;
  let backsValueGbp = 0;
  for (const p of players) {
    if (FORWARD_FAMILIES.has(p.family)) forwardsValueGbp += p.marketValueGbp;
    else backsValueGbp += p.marketValueGbp;
  }
  const splitTotal = forwardsValueGbp + backsValueGbp;
  const forwardsPct = splitTotal > 0 ? Math.round((forwardsValueGbp / splitTotal) * 100) : 0;
  const backsPct = splitTotal > 0 ? 100 - forwardsPct : 0;

  const highestValuePlayer =
    [...players].sort((a, b) => b.marketValueGbp - a.marketValueGbp)[0] ?? null;
  const youngestProspect =
    [...players]
      .filter((p) => p.age != null)
      .sort((a, b) => (a.age ?? 99) - (b.age ?? 99) || (b.rating ?? 0) - (a.rating ?? 0))[0] ??
    null;

  const positionRanks = POSITION_RANK_ORDER.map((row) => {
    const ratings = players
      .filter((p) => familyMatches(p.family, row.family) && p.rating != null)
      .map((p) => p.rating as number);
    return {
      family: row.family,
      label: row.label,
      worldRank: null as number | null,
      rating: ratings.length > 0 ? Math.max(...ratings) : null,
    };
  });
  const rankPlayerIds = players.map((p) => p.id);
  if (rankPlayerIds.length > 0) {
    try {
      const db = getDb();
      const rankRows = await db
        .select({
          playerId: playerRankingHistory.playerId,
          rank: playerRankingHistory.rank,
          positionKey: playerRankingHistory.positionKey,
          scope: playerRankingHistory.scope,
        })
        .from(playerRankingHistory)
        .where(
          and(
            inArray(playerRankingHistory.playerId, rankPlayerIds),
            eq(playerRankingHistory.isCurrent, true),
          ),
        );
      const familyByPlayer = new Map(players.map((p) => [p.id, p.family]));
      for (const row of rankRows) {
        if (row.rank == null || row.rank <= 0) continue;
        const family =
          (row.positionKey as RadarPositionFamily | null) &&
          POSITION_RANK_ORDER.some((p) => p.family === row.positionKey)
            ? (row.positionKey as RadarPositionFamily)
            : familyByPlayer.get(row.playerId);
        if (!family) continue;
        const slot = positionRanks.find((p) => p.family === family);
        if (!slot) continue;
        if (slot.worldRank == null || row.rank < slot.worldRank) slot.worldRank = row.rank;
      }
    } catch {
      // Ranking history table may be empty or missing in some environments.
    }
  }

  const topRated = [...players]
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 7);

  const risingStars = [...players]
    .filter((p) => (p.age == null || p.age <= 26) && (p.rating != null || p.marketValueGbp > 0))
    .sort(
      (a, b) =>
        (a.age ?? 99) - (b.age ?? 99) || (b.rating ?? 0) - (a.rating ?? 0) || b.marketValueGbp - a.marketValueGbp,
    )
    .slice(0, 5);

  const fallbackRising =
    risingStars.length >= 3
      ? risingStars
      : [...players]
          .sort(
            (a, b) =>
              (a.age ?? 99) - (b.age ?? 99) || (b.rating ?? 0) - (a.rating ?? 0) || b.marketValueGbp - a.marketValueGbp,
          )
          .slice(0, 5);

  const played = packet.form.played;
  const pfpg = played > 0 ? Math.round((packet.form.pointsFor / played) * 10) / 10 : null;
  const papg = played > 0 ? Math.round((packet.form.pointsAgainst / played) * 10) / 10 : null;
  const nickname =
    nationalTeamNickname(packet.name, packet.shortName) ??
    (/^ireland$/i.test(packet.name) ? "BOYS IN GREEN" : null);

  const squadValueGbp = players.reduce((sum, p) => sum + p.marketValueGbp, 0);
  const rated = players.filter((p) => p.rating != null);
  const ages = players.map((p) => p.age).filter((age): age is number => age != null);
  const avgRating =
    rated.length > 0
      ? Math.round((rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length) * 10) / 10
      : null;
  const avgAge =
    ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null;
  const avgValue = players.length > 0 ? Math.round(squadValueGbp / players.length) : null;
  const top23 = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 23);
  const avgTop23 =
    top23.length > 0
      ? top23.reduce((sum, p) => sum + (p.rating ?? 0), 0) / top23.length
      : avgRating;
  const liveRating = computeTeamRating({
    avgTop23Rating: avgTop23,
    formWinPct: packet.form.winPct,
    squadValueGbp,
    ratedPlayerCount: rated.length,
    trophyCount: packet.trophyCount,
  });
  const defaults = nationDefaults(packet.name, packet.countryName);
  const intel = liveRating.components;

  return {
    teamId: packet.id,
    teamSlug: packet.slug,
    teamName: packet.name,
    teamShortName: packet.shortName,
    teamImageUrl: packet.imageUrl,
    countryName: packet.countryName,
    nickname,
    unionName: unionForTeam(packet.name, packet.countryName),
    foundedYear: packet.foundedYear ?? defaults?.foundedYear ?? null,
    homeVenueName: packet.homeVenueName ?? defaults?.homeVenueName ?? null,
    worldRank: packet.worldRank,
    worldRankPoints: packet.worldRankPoints,
    teamRating: liveRating.overall,
    intelligence: [
      { label: "Team Rating", value: liveRating.overall, worldRank: packet.worldRank },
      { label: "Squad Strength", value: intel.squadStrength, worldRank: null },
      { label: "Form Rating", value: intel.form, worldRank: null },
      { label: "Value Rating", value: intel.value, worldRank: null },
      { label: "Depth Rating", value: intel.depth, worldRank: null },
      { label: "Honours Rating", value: intel.trophies, worldRank: null },
    ],
    keyStats: [
      {
        label: "Win Rate",
        value: packet.form.winPct != null ? `${Math.round(packet.form.winPct)}%` : "—",
        sub: played > 0 ? `Last ${played}` : null,
      },
      {
        label: "Points For / Game",
        value: pfpg != null ? String(pfpg) : "—",
        sub: packet.worldRank != null ? `World #${packet.worldRank}` : null,
      },
      {
        label: "Points Against / Game",
        value: papg != null ? String(papg) : "—",
        sub: null,
      },
      {
        label: "Average Age",
        value: avgAge != null ? String(avgAge) : "—",
        sub: null,
      },
      {
        label: "Average Rating",
        value: avgRating != null ? avgRating.toFixed(1) : "—",
        sub: null,
      },
      {
        label: "Trophies",
        value: String(packet.trophyCount),
        sub: "Recorded titles",
      },
    ],
    squadValueLabel: formatGbpCompact(squadValueGbp),
    squadValueGbp,
    averagePlayerValueLabel: avgValue != null ? formatGbpCompact(avgValue) : null,
    forwardsValueGbp,
    backsValueGbp,
    forwardsPct,
    backsPct,
    highestValuePlayer,
    youngestProspect,
    mostImproved: null,
    positionRanks,
    topRated,
    valuableXv: pickXv(players),
    risingStars: fallbackRising,
    form: packet.form.lastResults,
  };
}

export function formatDashboardGbp(value: number): string {
  return formatGbpCompact(value);
}
