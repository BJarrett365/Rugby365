import type { LiveSportMatchRow, LiveSportStandingRow, LiveSportTournamentMeta, LiveSportTournamentPreview } from "./types";
import { isRegularSeasonRound } from "./round-utils";

const FEED_CHUNK_RE = /(?:[A-Z]{2}÷[^"'<>]{1,200}¬){5,}/g;

function parseFeedFields(record: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of record.split("¬")) {
    const divider = part.indexOf("÷");
    if (divider <= 0) continue;
    fields[part.slice(0, divider)] = part.slice(divider + 1);
  }
  return fields;
}

function parseKickoff(unix?: string): string | null {
  if (!unix || !/^\d+$/.test(unix)) return null;
  const seconds = Number(unix);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function parseScore(value?: string): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function matchStatus(fields: Record<string, string>): LiveSportMatchRow["status"] {
  const homeScore = parseScore(fields.AG ?? fields.AT);
  const awayScore = parseScore(fields.AH ?? fields.AU);
  if (homeScore != null && awayScore != null) return "full_time";
  if (fields.AB === "2" || fields.CR === "2") return "live";
  return "scheduled";
}

export function extractEmbeddedFeeds(html: string): string[] {
  return html.match(FEED_CHUNK_RE) ?? [];
}

export function parseTournamentMetaFromFeed(feed: string): Partial<LiveSportTournamentMeta> {
  const header = feed.split("~")[0] ?? feed;
  const fields = parseFeedFields(header);
  return {
    competitionName: fields.ZA?.replace(/^[^:]+:\s*/, "") ?? null,
    tournamentId: fields.ZC ?? null,
    seasonTournamentId: fields.ZE ?? null,
  };
}

export function parseLiveSportMatchesFromFeed(
  feed: string,
  meta: Pick<LiveSportTournamentMeta, "competitionSlug" | "seasonLabel" | "sourceUrl">,
): LiveSportMatchRow[] {
  const rows: LiveSportMatchRow[] = [];
  for (const record of feed.split("~")) {
    const fields = parseFeedFields(record);
    const matchId = fields.AA;
    if (!matchId) continue;

    const homeTeam = fields.AE ?? fields.CX ?? fields.FH;
    const awayTeam = fields.AF ?? fields.FK;
    if (!homeTeam || !awayTeam) continue;

    const homeScore = parseScore(fields.AG ?? fields.AT);
    const awayScore = parseScore(fields.AH ?? fields.AU);
    const status = matchStatus(fields);

    rows.push({
      matchId,
      sourceUrl: meta.sourceUrl,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status,
      round: fields.ER ?? null,
      kickoffAt: parseKickoff(fields.AD ?? fields.ADE),
    });
  }

  const deduped = new Map<string, LiveSportMatchRow>();
  for (const row of rows) {
    deduped.set(row.matchId, row);
  }

  return [...deduped.values()].sort((a, b) => {
    const ak = a.kickoffAt ?? "";
    const bk = b.kickoffAt ?? "";
    return ak.localeCompare(bk) || a.homeTeam.localeCompare(b.homeTeam);
  });
}

export function buildStandingsFromMatches(matches: LiveSportMatchRow[]): LiveSportStandingRow[] {
  const table = new Map<
    string,
    {
      teamName: string;
      played: number;
      won: number;
      draw: number;
      lost: number;
      pointsFor: number;
      pointsAgainst: number;
      points: number;
    }
  >();

  function ensureTeam(name: string) {
    if (!table.has(name)) {
      table.set(name, {
        teamName: name,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        points: 0,
      });
    }
    return table.get(name)!;
  }

  for (const match of matches) {
    if (match.status !== "full_time" || match.homeScore == null || match.awayScore == null) continue;
    if (!isRegularSeasonRound(match.round)) continue;
    const home = ensureTeam(match.homeTeam);
    const away = ensureTeam(match.awayTeam);
    home.played += 1;
    away.played += 1;
    home.pointsFor += match.homeScore;
    home.pointsAgainst += match.awayScore;
    away.pointsFor += match.awayScore;
    away.pointsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 4;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += 4;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 2;
      away.points += 2;
    }
  }

  return [...table.values()]
    .map((row) => ({
      rank: 0,
      teamName: row.teamName,
      played: row.played,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointsDiff: row.pointsFor - row.pointsAgainst,
      points: row.points,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.teamName.localeCompare(b.teamName);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function parseLiveSportPage(html: string, meta: LiveSportTournamentMeta): LiveSportTournamentPreview {
  const feeds = extractEmbeddedFeeds(html);
  const combined = feeds.join("");
  const feedMeta = parseTournamentMetaFromFeed(combined);
  const matches = parseLiveSportMatchesFromFeed(combined, meta);
  return {
    kind: "tournament",
    meta: {
      ...meta,
      competitionName: feedMeta.competitionName ?? meta.competitionName,
      tournamentId: feedMeta.tournamentId ?? meta.tournamentId,
      seasonTournamentId: feedMeta.seasonTournamentId ?? meta.seasonTournamentId,
    },
    matches,
    standings: buildStandingsFromMatches(matches),
  };
}