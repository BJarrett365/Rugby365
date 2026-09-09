/**
 * Team vs team compare packet + CMS head-to-head for Compare Teams.
 */
import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, playerImages, players, teams } from "@rugby365/db";
import { getDb } from "./db";
import { getTeamCompareSidePacket } from "./team-squad-intelligence-service";
import { buildTeamCompareMetrics } from "./team-compare-metrics";
import {
  buildDepthSummary,
  buildLastMatchStartingXv,
  buildModelledStartingXv,
  buildPositionBattles,
  filledXvCount,
  summarizeXv,
} from "./team-compare-intelligence";
import type { TeamXvSource } from "./team-squad-intelligence-types";
import { formatGbpCompact } from "./player-value-math";
import type {
  TeamComparePayload,
  TeamH2HHighlight,
  TeamH2HMeeting,
  TeamH2HNextMeeting,
  TeamH2HTopPerformer,
  TeamH2HWinPoint,
  TeamHeadToHeadSummary,
} from "./team-compare-types";
import { normalizePlayerName } from "./entity-normalize";

export type { TeamComparePayload, TeamHeadToHeadSummary } from "./team-compare-types";

/** All CMS team ids that represent the same senior side (legacy clones + provider id). */
async function resolveTeamLineageIds(team: TeamCompareSidePacket): Promise<string[]> {
  const db = getDb();
  const [row] = await db
    .select({
      id: teams.id,
      name: teams.name,
      externalProviderId: teams.externalProviderId,
      teamType: teams.teamType,
    })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  const ids = new Set<string>([team.id]);
  if (!row) return [...ids];

  const ext = row.externalProviderId?.trim();
  if (ext) {
    const siblings = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.externalProviderId, ext));
    for (const s of siblings) ids.add(s.id);
  }

  // Exact display-name clones (common for internationals with legacy rows).
  const name = (row.name || team.name).trim();
  if (name) {
    const byName = await db
      .select({ id: teams.id, slug: teams.slug })
      .from(teams)
      .where(eq(teams.name, name));
    for (const s of byName) {
      // Skip age-grade / sevens when the selected side looks senior.
      if (/\bu\d|under|sevens|7'?s|women|schools/i.test(s.slug)) continue;
      ids.add(s.id);
    }
  }

  return [...ids];
}

function formatKickoffLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function preferPortraitUrl(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = a?.trim() || null;
  const right = b?.trim() || null;
  if (!left) return right;
  if (!right) return left;
  const score = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes("/player-avatars/")) return 60;
    if (lower.includes("cortextech.io") || lower.includes("springboks.rugby")) return 55;
    if (lower.includes("wikipedia") || lower.includes("wikimedia")) return 50;
    if (lower.includes("ultimaterugby.com")) return 42;
    if (lower.includes("alamy.com/zooms")) return 8; // often wide match action, poor in tiny circles
    if (/^https?:\/\//i.test(url)) return 24;
    if (url.startsWith("/")) return 30;
    return 2;
  };
  return score(right) > score(left) ? right : left;
}

async function resolvePerformerPortraits(
  entries: Array<{ playerId: string; name: string; imageUrl?: string | null }>,
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!entries.length) return map;
  for (const entry of entries) {
    map.set(entry.playerId, entry.imageUrl?.trim() || null);
  }

  const db = getDb();
  const playerIds = entries.map((e) => e.playerId);
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      imageUrl: players.imageUrl,
      badgeImageUrl: players.badgeImageUrl,
    })
    .from(players)
    .where(inArray(players.id, playerIds));

  for (const row of rows) {
    const direct = preferPortraitUrl(row.imageUrl, row.badgeImageUrl);
    map.set(row.id, preferPortraitUrl(map.get(row.id), direct));
  }

  const missing = entries.filter((e) => !map.get(e.playerId));
  if (missing.length) {
    const gallery = await db
      .select({
        playerId: playerImages.playerId,
        imageUrl: playerImages.imageUrl,
        role: playerImages.role,
        imageType: playerImages.imageType,
        status: playerImages.status,
        isPublic: playerImages.isPublic,
      })
      .from(playerImages)
      .where(
        and(
          inArray(
            playerImages.playerId,
            missing.map((m) => m.playerId),
          ),
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
      (row.role === "primary" ? 4 : row.role === "current_international" ? 3 : 1) +
      (row.imageType === "headshot" || row.imageType === "portrait" ? 3 : 0);

    const best = new Map<string, { url: string; score: number }>();
    for (const row of gallery) {
      const url = row.imageUrl?.trim();
      if (!url) continue;
      const next = { url, score: score(row) };
      const prev = best.get(row.playerId);
      if (!prev || next.score > prev.score) best.set(row.playerId, next);
    }
    for (const [id, hit] of best) map.set(id, preferPortraitUrl(map.get(id), hit.url));
  }

  // Borrow portraits from same-name player records / galleries (legacy duplicates).
  const stillMissing = entries.filter((e) => !map.get(e.playerId));
  if (stillMissing.length) {
    const nameKeys = [
      ...new Set(
        stillMissing
          .map((e) => normalizePlayerName(e.name).toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (nameKeys.length) {
      const candidates = await db
        .select({
          id: players.id,
          name: players.name,
          imageUrl: players.imageUrl,
          badgeImageUrl: players.badgeImageUrl,
        })
        .from(players)
        .where(
          and(
            eq(players.isPublic, true),
            or(
              ...stillMissing.flatMap((m) => {
                const raw = m.name.trim();
                const normalized = normalizePlayerName(raw);
                return [
                  ilike(players.name, raw),
                  ...(normalized && normalized !== raw ? [ilike(players.name, normalized)] : []),
                ];
              }),
            ),
          ),
        )
        .limit(80);

      const byName = new Map<string, string>();
      for (const row of candidates) {
        const key = normalizePlayerName(row.name).toLowerCase();
        const url = preferPortraitUrl(row.imageUrl, row.badgeImageUrl);
        if (!url) continue;
        byName.set(key, preferPortraitUrl(byName.get(key), url) || url);
      }

      const candidateIds = candidates.map((c) => c.id);
      if (candidateIds.length) {
        const gallery = await db
          .select({
            playerId: playerImages.playerId,
            imageUrl: playerImages.imageUrl,
            status: playerImages.status,
          })
          .from(playerImages)
          .where(
            and(
              inArray(playerImages.playerId, candidateIds),
              sql`${playerImages.status} not in ('rejected', 'incorrect_player', 'removed')`,
            ),
          )
          .limit(200);
        const idToName = new Map(
          candidates.map((c) => [c.id, normalizePlayerName(c.name).toLowerCase()] as const),
        );
        for (const row of gallery) {
          const url = row.imageUrl?.trim();
          const key = idToName.get(row.playerId);
          if (!url || !key) continue;
          byName.set(key, preferPortraitUrl(byName.get(key), url) || url);
        }
      }

      for (const entry of stillMissing) {
        const key = normalizePlayerName(entry.name).toLowerCase();
        const url = byName.get(key) || null;
        if (url) map.set(entry.playerId, url);
      }
    }
  }

  return map;
}

async function h2hTopPerformers(
  fixtureIds: string[],
  teamIds: string[],
): Promise<TeamH2HTopPerformer[]> {
  if (!fixtureIds.length || !teamIds.length) return [];
  const db = getDb();
  const rows = await db
    .select({
      playerId: fixturePlayers.playerId,
      name: players.name,
      slug: players.slug,
      // Prefer portrait/headshot over badge crop for circular avatars.
      imageUrl: sql<string | null>`nullif(trim(coalesce(${players.imageUrl}, ${players.badgeImageUrl})), '')`,
      points: sql<number>`coalesce(sum(${fixturePlayers.points}), 0)::int`,
      tries: sql<number>`coalesce(sum(${fixturePlayers.tries}), 0)::int`,
      conversions: sql<number>`coalesce(sum(${fixturePlayers.conversions}), 0)::int`,
      penalties: sql<number>`coalesce(sum(${fixturePlayers.penalties}), 0)::int`,
      dropGoals: sql<number>`coalesce(sum(${fixturePlayers.dropGoals}), 0)::int`,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(players.id, fixturePlayers.playerId))
    .where(
      and(inArray(fixturePlayers.fixtureId, fixtureIds), inArray(fixturePlayers.teamId, teamIds)),
    )
    .groupBy(
      fixturePlayers.playerId,
      players.name,
      players.slug,
      players.badgeImageUrl,
      players.imageUrl,
    );

  const used = new Set<string>();
  const out: TeamH2HTopPerformer[] = [];

  const pushUnique = (
    label: string,
    key: "points" | "tries" | "conversions" | "penalties" | "dropGoals",
  ) => {
    const ranked = [...rows]
      .filter((r) => !used.has(r.playerId) && (r[key] ?? 0) > 0)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
    const top = ranked[0];
    if (!top) return;
    used.add(top.playerId);
    out.push({
      playerId: top.playerId,
      playerSlug: top.slug,
      name: top.name,
      label,
      value: top[key],
      imageUrl: top.imageUrl ?? null,
    });
  };

  // One player per slot so the board doesn't repeat the same face (e.g. kicker) five times.
  for (const [label, key] of [
    ["Points", "points"],
    ["Tries", "tries"],
    ["Conversions", "conversions"],
    ["Penalties", "penalties"],
    ["Drop goals", "dropGoals"],
  ] as const) {
    pushUnique(label, key);
    if (out.length >= 5) break;
  }

  return out;
}

/** Attach portraits to genuine H2H stat rows only. Never pad with ratings. */
async function finalizeTopPerformers(
  h2h: TeamH2HTopPerformer[],
): Promise<TeamH2HTopPerformer[]> {
  if (h2h.length === 0) return [];
  const portraits = await resolvePerformerPortraits(
    h2h
      .filter((p): p is TeamH2HTopPerformer & { playerId: string } => Boolean(p.playerId))
      .map((p) => ({
        playerId: p.playerId,
        name: p.name,
        imageUrl: p.imageUrl,
      })),
  );
  return h2h.map((p) => ({
    ...p,
    imageUrl: (p.playerId ? portraits.get(p.playerId) : null) || p.imageUrl || null,
  }));
}

async function loadCmsHeadToHead(
  teamA: TeamCompareSidePacket,
  teamB: TeamCompareSidePacket,
): Promise<TeamHeadToHeadSummary> {
  const db = getDb();
  const [idsA, idsB] = await Promise.all([
    resolveTeamLineageIds(teamA),
    resolveTeamLineageIds(teamB),
  ]);

  const rows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      venueName: fixtures.venueName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      status: fixtures.status,
      planetRugbyUrl: fixtures.planetRugbyUrl,
    })
    .from(fixtures)
    .where(
      and(
        inArray(fixtures.status, ["full_time", "finished", "completed", "ft", "result"]),
        or(
          and(inArray(fixtures.homeTeamId, idsA), inArray(fixtures.awayTeamId, idsB)),
          and(inArray(fixtures.homeTeamId, idsB), inArray(fixtures.awayTeamId, idsA)),
        ),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(400);

  // Deduplicate same calendar day + score (legacy clone fixtures).
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const day = row.kickoffAt?.toISOString().slice(0, 10) ?? row.id;
    const key = `${day}:${row.homeScore}-${row.awayScore}:${Math.min(
      row.homeScore ?? 0,
      row.awayScore ?? 0,
    )}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let teamAWins = 0;
  let teamBWins = 0;
  let draws = 0;
  let pointsForA = 0;
  let pointsForB = 0;
  let biggestWinForA: TeamH2HHighlight | null = null;
  let biggestWinForB: TeamH2HHighlight | null = null;
  let highestScoring: TeamH2HHighlight | null = null;
  let bestMarginA = 0;
  let bestMarginB = 0;
  let bestTotal = 0;

  const meetingsChronological: Array<{
    year: number;
    winner: "a" | "b" | "draw";
  }> = [];

  const toMeeting = (row: (typeof unique)[number]): TeamH2HMeeting => {
    const aIsHome = row.homeTeamId != null && idsA.includes(row.homeTeamId);
    const aScore = aIsHome ? (row.homeScore ?? 0) : (row.awayScore ?? 0);
    const bScore = aIsHome ? (row.awayScore ?? 0) : (row.homeScore ?? 0);
    const winner: "a" | "b" | "draw" =
      aScore > bScore ? "a" : bScore > aScore ? "b" : "draw";
    let matchHref: string | null = null;
    const url = row.planetRugbyUrl?.trim();
    if (url) {
      try {
        matchHref = new URL(url).pathname;
      } catch {
        matchHref = url.startsWith("/") ? url : null;
      }
    }
    return {
      id: row.id,
      date: row.kickoffAt?.toISOString() ?? null,
      competitionName: row.competitionName,
      venueName: row.venueName?.trim() || null,
      homeTeam: aIsHome ? teamA.name : teamB.name,
      awayTeam: aIsHome ? teamB.name : teamA.name,
      homeScore: row.homeScore ?? 0,
      awayScore: row.awayScore ?? 0,
      fixtureSlug: row.slug,
      matchHref,
      winner,
    };
  };

  for (const row of unique) {
    const aIsHome = row.homeTeamId != null && idsA.includes(row.homeTeamId);
    const aScore = aIsHome ? (row.homeScore ?? 0) : (row.awayScore ?? 0);
    const bScore = aIsHome ? (row.awayScore ?? 0) : (row.homeScore ?? 0);
    const margin = aScore - bScore;
    const total = aScore + bScore;
    pointsForA += aScore;
    pointsForB += bScore;

    const year = row.kickoffAt?.getUTCFullYear() ?? 0;
    if (margin > 0) {
      teamAWins += 1;
      meetingsChronological.push({ year, winner: "a" });
      if (margin > bestMarginA) {
        bestMarginA = margin;
        biggestWinForA = {
          score: `${aScore}-${bScore}`,
          margin,
          date: row.kickoffAt?.toISOString() ?? null,
          competitionName: row.competitionName,
          venueName: row.venueName?.trim() || null,
          winnerName: teamA.name,
        };
      }
    } else if (margin < 0) {
      teamBWins += 1;
      meetingsChronological.push({ year, winner: "b" });
      if (-margin > bestMarginB) {
        bestMarginB = -margin;
        biggestWinForB = {
          score: `${bScore}-${aScore}`,
          margin: -margin,
          date: row.kickoffAt?.toISOString() ?? null,
          competitionName: row.competitionName,
          venueName: row.venueName?.trim() || null,
          winnerName: teamB.name,
        };
      }
    } else {
      draws += 1;
      meetingsChronological.push({ year, winner: "draw" });
    }

    if (total > bestTotal) {
      bestTotal = total;
      highestScoring = {
        score: `${row.homeScore ?? 0}-${row.awayScore ?? 0}`,
        margin: Math.abs(margin),
        date: row.kickoffAt?.toISOString() ?? null,
        competitionName: row.competitionName,
        venueName: row.venueName?.trim() || null,
        winnerName:
          margin > 0 ? teamA.name : margin < 0 ? teamB.name : "Draw",
      };
    }
  }

  // Wins over time — chronological ascending.
  const chrono = [...meetingsChronological].reverse();
  let cumA = 0;
  let cumB = 0;
  const byYear = new Map<number, TeamH2HWinPoint>();
  for (const m of chrono) {
    if (!m.year) continue;
    if (m.winner === "a") cumA += 1;
    if (m.winner === "b") cumB += 1;
    byYear.set(m.year, {
      year: m.year,
      cumulativeWinsA: cumA,
      cumulativeWinsB: cumB,
    });
  }
  const winsOverTime = [...byYear.values()].sort((a, b) => a.year - b.year);

  const recentMeetings = unique.slice(0, 5).map(toMeeting);
  const lastMeeting = recentMeetings[0] ?? null;
  const played = unique.length;

  // Next scheduled meeting between lineages.
  const upcoming = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      venueName: fixtures.venueName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      planetRugbyUrl: fixtures.planetRugbyUrl,
    })
    .from(fixtures)
    .where(
      and(
        inArray(fixtures.status, ["scheduled", "fixture", "upcoming"]),
        sql`${fixtures.kickoffAt} > now()`,
        or(
          and(inArray(fixtures.homeTeamId, idsA), inArray(fixtures.awayTeamId, idsB)),
          and(inArray(fixtures.homeTeamId, idsB), inArray(fixtures.awayTeamId, idsA)),
        ),
      ),
    )
    .orderBy(asc(fixtures.kickoffAt))
    .limit(1);

  let nextMeeting: TeamH2HNextMeeting | null = null;
  const next = upcoming[0];
  if (next) {
    const aIsHome = next.homeTeamId != null && idsA.includes(next.homeTeamId);
    const iso = next.kickoffAt?.toISOString() ?? null;
    let matchPath: string | null = null;
    const url = next.planetRugbyUrl?.trim();
    if (url) {
      try {
        matchPath = new URL(url).pathname;
      } catch {
        matchPath = url.startsWith("/") ? url : null;
      }
    }
    nextMeeting = {
      date: iso,
      competitionName: next.competitionName,
      venueName: next.venueName?.trim() || null,
      homeTeam: aIsHome ? teamA.name : teamB.name,
      awayTeam: aIsHome ? teamB.name : teamA.name,
      fixtureSlug: matchPath ?? next.slug,
      kickoffLabel: formatKickoffLabel(iso),
    };
  }

  const fixtureIds = unique.map((r) => r.id);
  const [rawPerformersA, rawPerformersB] = await Promise.all([
    h2hTopPerformers(fixtureIds, idsA),
    h2hTopPerformers(fixtureIds, idsB),
  ]);
  const [topPerformersA, topPerformersB] = await Promise.all([
    finalizeTopPerformers(rawPerformersA),
    finalizeTopPerformers(rawPerformersB),
  ]);

  return {
    totalMeetings: played,
    teamAWins,
    teamBWins,
    draws,
    pointsForA,
    pointsForB,
    avgPointsForA: played ? Math.round((pointsForA / played) * 10) / 10 : null,
    avgPointsForB: played ? Math.round((pointsForB / played) * 10) / 10 : null,
    lastMeeting,
    recentMeetings,
    biggestWinForA,
    biggestWinForB,
    highestScoring,
    winsOverTime,
    nextMeeting,
    topPerformersA,
    topPerformersB,
  };
}

export async function compareTeamsBySlug(
  slugA: string,
  slugB: string,
): Promise<TeamComparePayload | null> {
  if (!slugA.trim() || !slugB.trim() || slugA.trim() === slugB.trim()) return null;

  const [teamA, teamB] = await Promise.all([
    getTeamCompareSidePacket(slugA),
    getTeamCompareSidePacket(slugB),
  ]);
  if (!teamA || !teamB) return null;

  const headToHead = await loadCmsHeadToHead(teamA, teamB);

  const pickXv = (side: typeof teamA): { slots: ReturnType<typeof buildModelledStartingXv>; source: TeamXvSource } => {
    if (side.squad.length === 0) {
      return { slots: buildModelledStartingXv([]), source: "unavailable" };
    }
    const last = buildLastMatchStartingXv(side.squad);
    if (filledXvCount(last) >= 10) return { slots: last, source: "last_match" };
    return { slots: buildModelledStartingXv(side.squad), source: "modelled" };
  };

  const xvPickA = pickXv(teamA);
  const xvPickB = pickXv(teamB);
  const startingXvA = xvPickA.slots;
  const startingXvB = xvPickB.slots;
  const xvA = summarizeXv(startingXvA);
  const xvB = summarizeXv(startingXvB);
  const positionBattles = buildPositionBattles(teamA.squad, teamB.squad);
  const depthA = buildDepthSummary(teamA.squad);
  const depthB = buildDepthSummary(teamB.squad);
  const positionScore = {
    a: positionBattles.filter((b) => b.winner === "a").length,
    b: positionBattles.filter((b) => b.winner === "b").length,
    draws: positionBattles.filter((b) => b.winner === "draw").length,
  };

  const baseMetrics = buildTeamCompareMetrics(teamA, teamB);
  const depthMetrics = [
    {
      key: "depthScore",
      label: "Modelled squad depth",
      group: "squad" as const,
      a: depthA.depthScore,
      b: depthB.depthScore,
      format: "number" as const,
    },
    {
      key: "experience",
      label: "Modelled Experience Score",
      group: "squad" as const,
      a: depthA.experienceScore,
      b: depthB.experienceScore,
      format: "number" as const,
    },
    {
      key: "youthPct",
      label: "Under-23 %",
      group: "squad" as const,
      a: depthA.youthPct,
      b: depthB.youthPct,
      format: "pct" as const,
    },
    {
      key: "xvValueCompare",
      label: "Rugby365 Estimated XV Value (£)",
      group: "value" as const,
      a: xvA.valueGbp,
      b: xvB.valueGbp,
      format: "gbp" as const,
    },
  ];

  // Screenshot-style comparison table rows (lead values highlighted in UI).
  const boardMetrics = [
    {
      key: "attack",
      label: "Squad Strength",
      group: "rating" as const,
      a: teamA.rating.components.squadStrength,
      b: teamB.rating.components.squadStrength,
      format: "number" as const,
    },
    {
      key: "defence",
      label: "Team Form Score",
      group: "rating" as const,
      a: teamA.rating.components.form,
      b: teamB.rating.components.form,
      format: "number" as const,
    },
    {
      key: "setPiece",
      label: "Modelled Squad-Size Score",
      group: "rating" as const,
      a: teamA.rating.components.depth,
      b: teamB.rating.components.depth,
      format: "number" as const,
    },
    {
      key: "avgPlayer",
      label: "Average Player Rating",
      group: "squad" as const,
      a: teamA.squadValue.averageRating,
      b: teamB.squadValue.averageRating,
      format: "number" as const,
    },
    {
      key: "xvRating",
      label: "XV Rating",
      group: "squad" as const,
      a: xvA.averageRating,
      b: xvB.averageRating,
      format: "number" as const,
    },
    {
      key: "experienceBoard",
      label: "Modelled Experience Score",
      group: "squad" as const,
      a: depthA.experienceScore,
      b: depthB.experienceScore,
      format: "number" as const,
    },
    {
      key: "squadValueBoard",
      label: "Rugby365 Estimated Value",
      group: "value" as const,
      a: teamA.squadValue.totalSquadValueGbp,
      b: teamB.squadValue.totalSquadValueGbp,
      format: "gbp" as const,
    },
  ];

  return {
    teamA,
    teamB,
    metrics: [...baseMetrics, ...depthMetrics, ...boardMetrics],
    headToHead,
    startingXvA,
    startingXvB,
    xvSummaryA: {
      valueGbp: xvA.valueGbp,
      valueLabel: xvA.valueGbp != null ? formatGbpCompact(xvA.valueGbp) : null,
      averageRating: xvA.averageRating,
      averageAge: xvA.averageAge,
      filled: xvA.filled,
      source: xvPickA.source,
    },
    xvSummaryB: {
      valueGbp: xvB.valueGbp,
      valueLabel: xvB.valueGbp != null ? formatGbpCompact(xvB.valueGbp) : null,
      averageRating: xvB.averageRating,
      averageAge: xvB.averageAge,
      filled: xvB.filled,
      source: xvPickB.source,
    },
    positionBattles,
    depthA,
    depthB,
    positionScore,
  };
}
