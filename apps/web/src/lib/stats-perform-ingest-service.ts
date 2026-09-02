/**
 * Parse and import Stats Perform Rugby Union SDAPI squads + match stats
 * onto existing Rugby365 entities (mappings, memberships, extra stats).
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  playerMatchPerformanceStats,
  players,
  sports,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { emptyParsedPlayerMatchPerformance } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { normalizePlayerName, normalizedEntityKey, teamDedupTier, isJunkTeamName } from "./entity-normalize";
import { buildFixtureSlug, normalizeSlug } from "./fixture-slug";
import { confirmMapping } from "./provider-mapping-service";
import { upsertPlayerTeamMembership } from "./player-membership-service";
import { upsertMatchPerformanceStat } from "./player-season-stats-service";
import { upsertTeamMatchStat } from "./team-match-stats-service";
import { captureRawResponse } from "./provider-raw-response-service";
import { PROVIDER_STATS_PERFORM } from "./provider-mapping-types";
import { fetchWikipediaThumbnails } from "./wikipedia-page-image";
import { registerWikipediaHeadshotIfMissing } from "./player-image-service";
import {
  STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
  STATS_PERFORM_DOCS_SAMPLE_TOURNAMENT_CALENDAR_ID,
  STATS_PERFORM_TOP14_2024_25_CALENDAR_ID,
  fetchStatsPerformMatchStatsFeed,
  fetchStatsPerformSquadsFeed,
  summariseStatsPerformMatches,
} from "./stats-perform-sdapi-client";

export type StatsPerformPerson = {
  id: string;
  firstName: string;
  lastName: string;
  matchName?: string;
  nationality?: string;
  position?: string;
  active?: string;
};

export type StatsPerformSquadContestant = {
  contestantId: string;
  contestantName: string;
  contestantShortName?: string;
  type?: string;
  person: StatsPerformPerson[];
};

export type ParsedStatsPerformSquads = {
  competitionId: string | null;
  competitionName: string | null;
  calendarId: string | null;
  calendarName: string | null;
  startDate: string | null;
  endDate: string | null;
  contestants: StatsPerformSquadContestant[];
};

export type StatsPerformIngestReport = {
  audit: {
    players: number;
    withImage: number;
    withMembership: number;
    rankingSnapshots: number;
    statsPerformMappings: number;
  };
  rankings: string;
  images: string;
  squadsImported: number;
  peopleSeen: number;
  playersMatched: number;
  playersCreated: number;
  fieldsFilled: number;
  membershipsUpserted: number;
  imagesFilled: number;
  matchStatsPlayers: number;
  teamStats: number;
  fixtureMatched: boolean;
  fixtureCreated: boolean;
  unmappedTeams: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseStatsPerformSquadsPayload(payload: unknown): ParsedStatsPerformSquads {
  const root = asRecord(payload) ?? {};
  const competition = asRecord(root.competition);
  const calendar = asRecord(root.tournamentCalendar);
  const raw = Array.isArray(root.squad) ? root.squad : [];
  const contestants: StatsPerformSquadContestant[] = [];
  for (const row of raw) {
    const rec = asRecord(row);
    if (!rec) continue;
    const people = Array.isArray(rec.person) ? rec.person : [];
    contestants.push({
      contestantId: asString(rec.contestantId) ?? "",
      contestantName: asString(rec.contestantName) ?? "Unknown",
      contestantShortName: asString(rec.contestantShortName) ?? undefined,
      type: asString(rec.type) ?? undefined,
      person: people
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          id: asString(item.id) ?? "",
          firstName: asString(item.firstName) ?? "",
          lastName: asString(item.lastName) ?? "",
          matchName: asString(item.matchName) ?? undefined,
          nationality: asString(item.nationality) ?? undefined,
          position: asString(item.position) ?? undefined,
          active: asString(item.active) ?? undefined,
        }))
        .filter((item) => item.id && (item.firstName || item.lastName)),
    });
  }
  return {
    competitionId: asString(competition?.id),
    competitionName: asString(competition?.name),
    calendarId: asString(calendar?.id),
    calendarName: asString(calendar?.value) ?? asString(calendar?.name),
    startDate: asString(calendar?.startDate),
    endDate: asString(calendar?.endDate),
    contestants,
  };
}

export function statsPerformPersonDisplayName(person: StatsPerformPerson): string {
  const full = `${person.firstName} ${person.lastName}`.trim();
  return normalizePlayerName(full || person.matchName || "");
}

export function statsMapFromStatList(stat: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(stat)) return out;
  for (const row of stat) {
    const rec = asRecord(row);
    if (!rec) continue;
    const type = asString(rec.type);
    if (!type) continue;
    out[type] = num(rec.value);
  }
  return out;
}

export function mapStatsPerformPlayerStats(stat: unknown) {
  const map = statsMapFromStatList(stat);
  const parsed = emptyParsedPlayerMatchPerformance();
  parsed.minutesPlayed = map.minsPlayed || map.minutesPlayed || map.mins || 0;
  parsed.carries = map.runs || map.carries || 0;
  parsed.metresCarried = map.carriesMetres || map.metres || 0;
  parsed.tacklesMade = map.tackles || 0;
  parsed.tacklesCompleted = map.tackles || 0;
  parsed.missedTackles = map.missedTackles || 0;
  parsed.dominantTackles = map.dominantTackles || 0;
  parsed.turnoversWon = map.turnoversWon || map.turnoverWon || 0;
  parsed.tryAssists = map.tryAssists || 0;
  parsed.lineBreaks = map.cleanBreaks || map.lineBreaks || 0;
  parsed.defendersBeaten = map.defendersBeaten || 0;
  parsed.touches = map.collectionSuccess || map.touches || 0;
  parsed.passes = map.passes || 0;
  parsed.offloads = map.offload || map.offloads || 0;
  parsed.kicks = map.totalKicks || map.kicksFromHand || 0;
  parsed.kicksFromHand = map.kicksFromHand || 0;
  parsed.kickFromHandMetres = map.kickFromHandMetres || 0;
  parsed.badPasses = map.badPasses || 0;
  parsed.droppedCatch = map.droppedCatch || 0;
  parsed.handlingError = map.handlingError || 0;
  parsed.turnoversConceded = map.turnoversConceded || 0;
  parsed.runs = map.runs || 0;
  parsed.gainLine = map.gainLine || map.carriesCrossedGainLine || 0;
  parsed.carriesMetres = map.carriesMetres || 0;
  parsed.carriesCrossedGainLine = map.carriesCrossedGainLine || 0;
  parsed.carriesNotMadeGainLine = map.carriesNotMadeGainLine || 0;
  parsed.postContactMetres = map.postContactMetres || 0;
  return { parsed, map, tries: map.tries || 0, points: map.points || 0 };
}

const GENERIC_LABEL_TOKENS = new Set([
  "championship",
  "cup",
  "rugby",
  "league",
  "tournament",
  "series",
  "club",
  "team",
  "football",
  "union",
]);

export function foldStatsPerformLabel(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/^t=/i, "")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/[-_'’]/g, " ")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function statsPerformLabelsMatch(left: string, right: string): boolean {
  const a = foldStatsPerformLabel(left);
  const b = foldStatsPerformLabel(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const tokens = (value: string) =>
    value.split(" ").filter((token) => token.length > 2 && !GENERIC_LABEL_TOKENS.has(token));
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (!aTokens.length || !bTokens.length) return false;
  const [shorter, longer] = aTokens.length <= bTokens.length ? [aTokens, bTokens] : [bTokens, aTokens];
  if (shorter.length >= 2) return shorter.every((token) => longer.includes(token));
  const [only] = shorter;
  return Boolean(only && only.length >= 6 && (a === only || b === only) && longer.includes(only));
}

function expandTeamLabels(name: string): string[] {
  const folded = foldStatsPerformLabel(name);
  const extra: string[] = [];
  if (folded.includes("rochelais") || folded.includes("la rochelle")) extra.push("La Rochelle", "Stade Rochelais");
  if (folded === "lyon ou" || folded === "lyon") extra.push("Lyon");
  if (folded.includes("toulonnais") || folded === "rc toulon" || folded === "toulon") {
    extra.push("Toulon", "RC Toulon");
  }
  if (folded.includes("vannes")) extra.push("Vannes", "RC Vannes");
  if (folded.includes("clermont")) extra.push("Clermont Auvergne", "ASM Clermont Auvergne");
  if (folded.includes("stade francais") || folded.includes("stade francais paris")) {
    extra.push("Stade Francais", "Stade Français Paris");
  }
  return extra;
}

function isUsableTeam(team: { name: string; slug?: string | null }) {
  if (isJunkTeamName(team.name)) return false;
  if (/^t=/i.test(team.name) || /\{\{/.test(team.name)) return false;
  if (team.slug?.startsWith("flagicon") || team.slug?.startsWith("t-") || team.slug?.startsWith("rut-")) {
    return false;
  }
  return teamDedupTier(team.name) === "senior";
}

async function auditLocalCoverage() {
  const db = getDb();
  const playerRows = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where coalesce(image_url, '') <> '')::int as with_image
    from players
  `);
  const membershipRows = await db.execute(sql`select count(*)::int as total from player_team_memberships`);
  const snapshotRows = await db.execute(sql`select count(*)::int as total from player_ranking_board_snapshots`);
  const mappingRows = await db.execute(sql`
    select count(*)::int as total
    from provider_entity_mappings
    where provider = ${PROVIDER_STATS_PERFORM}
  `);
  const first = <T,>(rows: unknown): T | undefined => {
    if (Array.isArray(rows)) return rows[0] as T;
    const nested = (rows as { rows?: T[] })?.rows;
    return nested?.[0];
  };
  const playersRow = first<{ total: number; with_image: number }>(playerRows);
  const memberships = first<{ total: number }>(membershipRows);
  const snapshots = first<{ total: number }>(snapshotRows);
  const mappings = first<{ total: number }>(mappingRows);
  return {
    players: Number(playersRow?.total ?? 0),
    withImage: Number(playersRow?.with_image ?? 0),
    withMembership: Number(memberships?.total ?? 0),
    rankingSnapshots: Number(snapshots?.total ?? 0),
    statsPerformMappings: Number(mappings?.total ?? 0),
  };
}

async function findCompetition(name: string | null) {
  if (!name) return null;
  const db = getDb();
  const rows = await db.select().from(competitions);
  const folded = foldStatsPerformLabel(name);
  return (
    rows.find((row) => foldStatsPerformLabel(row.name) === folded) ??
    rows.find(
      (row) =>
        statsPerformLabelsMatch(row.name, name) &&
        foldStatsPerformLabel(row.name).length >= folded.length,
    ) ??
    null
  );
}

function calendarYear(calendarName: string | null, startDate: string | null): number | null {
  const fromDate = startDate?.match(/20\d{2}/)?.[0];
  const fromName = calendarName?.match(/20\d{2}/)?.[0];
  const year = Number(fromDate ?? fromName ?? "");
  return Number.isFinite(year) && year >= 1990 ? year : null;
}

async function findSeason(competitionId: string, calendarName: string | null, startDate: string | null) {
  const db = getDb();
  const rows = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));
  if (calendarName) {
    const byLabel = rows.find((row) => row.label.toLowerCase() === calendarName.toLowerCase());
    if (byLabel) return byLabel;
    const year = calendarYear(calendarName, null);
    if (year) {
      const byYear = rows.find((row) => row.year === year || row.label.includes(String(year)));
      if (byYear) return byYear;
    }
  }
  if (startDate) {
    const year = Number(startDate.slice(0, 4));
    return rows.find((row) => row.year === year) ?? rows[0] ?? null;
  }
  return rows.find((row) => row.isActive) ?? rows[0] ?? null;
}

async function ensureCompetitionAndSeason(input: {
  name: string | null;
  calendarName: string | null;
  startDate: string | null;
  membershipType: "club" | "international";
}) {
  const db = getDb();
  let competition = await findCompetition(input.name);
  if (!competition && input.name) {
    const slug = normalizeSlug(input.name);
    try {
      const [created] = await db
        .insert(competitions)
        .values({
          name: input.name,
          slug,
          competitionType: input.membershipType === "international" ? "international" : "domestic",
          sourceProvider: PROVIDER_STATS_PERFORM,
          region: input.membershipType === "international" ? "europe" : "france",
        })
        .returning();
      competition = created ?? null;
    } catch {
      competition = await findCompetition(input.name);
    }
  }
  if (!competition) return { competition: null, season: null };
  let season = await findSeason(competition.id, input.calendarName, input.startDate);
  if (!season) {
    const year = calendarYear(input.calendarName, input.startDate) ?? new Date().getUTCFullYear();
    const label = input.calendarName?.replace(/^.*?((?:19|20)\d{2}.*)$/i, "$1").trim() || String(year);
    const slug = normalizeSlug(`${competition.slug}-${label}`);
    try {
      const [created] = await db
        .insert(competitionSeasons)
        .values({
          competitionId: competition.id,
          slug,
          label,
          year,
          isActive: false,
          sourceProvider: PROVIDER_STATS_PERFORM,
        })
        .returning();
      season = created ?? null;
    } catch {
      season = await findSeason(competition.id, input.calendarName, input.startDate);
    }
  }
  return { competition, season };
}

function findTeam(
  allTeams: Array<{ id: string; name: string; shortName?: string | null; slug?: string | null }>,
  name: string,
  aliases: string[] = [],
) {
  const labels = [...new Set([name, ...aliases, ...expandTeamLabels(name)])].filter(Boolean);
  const pool = allTeams.filter(isUsableTeam);
  const scored = pool
    .map((team) => {
      const exact = labels.some((label) => foldStatsPerformLabel(team.name) === foldStatsPerformLabel(label));
      const likely = labels.some(
        (label) =>
          statsPerformLabelsMatch(team.name, label) ||
          (team.shortName &&
            foldStatsPerformLabel(team.shortName).length >= 8 &&
            statsPerformLabelsMatch(team.shortName, label)),
      );
      if (!exact && !likely) return null;
      const legacyPenalty = team.slug?.includes("__legacy__") ? 20 : 0;
      return {
        team,
        score: (exact ? 10000 : 0) + foldStatsPerformLabel(team.name).length - legacyPenalty,
      };
    })
    .filter((row): row is { team: (typeof pool)[number]; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.team ?? null;
}

export async function importStatsPerformSdapi(options?: {
  fillImages?: boolean;
  createMissingPlayers?: boolean;
}): Promise<StatsPerformIngestReport> {
  const db = getDb();
  const fillImages = options?.fillImages !== false;
  const createMissingPlayers = options?.createMissingPlayers !== false;
  const audit = await auditLocalCoverage();

  const [europe, top14, matchStats] = await Promise.all([
    fetchStatsPerformSquadsFeed({
      tournamentCalendarId: STATS_PERFORM_DOCS_SAMPLE_TOURNAMENT_CALENDAR_ID,
    }),
    fetchStatsPerformSquadsFeed({
      tournamentCalendarId: STATS_PERFORM_TOP14_2024_25_CALENDAR_ID,
    }),
    fetchStatsPerformMatchStatsFeed({
      fixtureId: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
    }),
  ]);

  await captureRawResponse({
    provider: PROVIDER_STATS_PERFORM,
    endpoint: "rugbyuniondata/squads",
    entityType: "season",
    externalId: STATS_PERFORM_DOCS_SAMPLE_TOURNAMENT_CALENDAR_ID,
    responseStatus: europe.status,
    payload: europe.payload,
    importStatus: europe.ok ? "captured" : "error",
  });
  await captureRawResponse({
    provider: PROVIDER_STATS_PERFORM,
    endpoint: "rugbyuniondata/squads",
    entityType: "season",
    externalId: STATS_PERFORM_TOP14_2024_25_CALENDAR_ID,
    responseStatus: top14.status,
    payload: top14.payload,
    importStatus: top14.ok ? "captured" : "error",
  });
  await captureRawResponse({
    provider: PROVIDER_STATS_PERFORM,
    endpoint: "rugbyuniondata/matchstats",
    entityType: "match",
    externalId: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
    responseStatus: matchStats.status,
    payload: matchStats.payload,
    importStatus: matchStats.ok ? "captured" : "error",
  });

  const allPlayers = await db.select().from(players);
  const allTeams = await db.select().from(teams);
  await db.execute(sql`
    delete from player_team_memberships as m
    using teams t
    where m.team_id = t.id
      and m.source_provider = ${PROVIDER_STATS_PERFORM}
      and (
        t.name like 't=%'
        or t.name like '{{%'
        or t.slug like 'flagicon%'
        or t.slug like 't-%'
        or t.slug like 'rut-%'
      )
  `);
  await db.execute(sql`
    delete from provider_entity_mappings
    where provider = ${PROVIDER_STATS_PERFORM}
      and entity_type = 'team'
      and rugby365_id in (
        select id from teams
        where name like 't=%' or name like '{{%' or slug like 'flagicon%' or slug like 't-%' or slug like 'rut-%'
      )
  `);
  await db.execute(sql`
    delete from player_team_memberships as m
    using teams t
    where m.team_id = t.id
      and m.source_provider = ${PROVIDER_STATS_PERFORM}
      and t.name = 'Clermont'
      and exists (select 1 from teams t2 where t2.name = 'Clermont Auvergne')
  `);
  const playerByKey = new Map<string, (typeof allPlayers)[number][]>();
  for (const player of allPlayers) {
    const key = normalizedEntityKey(player.name, "player");
    const list = playerByKey.get(key) ?? [];
    list.push(player);
    playerByKey.set(key, list);
    if (player.fullName) {
      const fullKey = normalizedEntityKey(player.fullName, "player");
      if (fullKey !== key) {
        const extra = playerByKey.get(fullKey) ?? [];
        extra.push(player);
        playerByKey.set(fullKey, extra);
      }
    }
  }

  const report: StatsPerformIngestReport = {
    audit,
    rankings:
      "Stats Perform PE4 rankings feed is not authorised on the docs outlet key (403/10313). Rugby365 boards stay on the R365 rating model.",
    images:
      "Stats Perform squad and match-stat feeds do not include player photos. Images below are Wikipedia fills for matched players still missing a primary URL.",
    squadsImported: 0,
    peopleSeen: 0,
    playersMatched: 0,
    playersCreated: 0,
    fieldsFilled: 0,
    membershipsUpserted: 0,
    imagesFilled: 0,
    matchStatsPlayers: 0,
    teamStats: 0,
    fixtureMatched: false,
    fixtureCreated: false,
    unmappedTeams: [],
  };

  const imageCandidates: Array<{ id: string; name: string }> = [];

  async function importSquadFeed(
    payload: unknown,
    membershipType: "club" | "international",
  ) {
    const parsed = parseStatsPerformSquadsPayload(payload);
    report.squadsImported += parsed.contestants.length;
    const { competition, season } = await ensureCompetitionAndSeason({
      name: parsed.competitionName,
      calendarName: parsed.calendarName,
      startDate: parsed.startDate,
      membershipType,
    });
    if (parsed.competitionId && competition) {
      await confirmMapping({
        provider: PROVIDER_STATS_PERFORM,
        entityType: "competition",
        externalId: parsed.competitionId,
        rugby365Id: competition.id,
        rugby365Name: competition.name,
        confirmedBy: "stats-perform-ingest",
        notes: parsed.competitionName ?? undefined,
      });
    }
    if (parsed.calendarId && season) {
      await confirmMapping({
        provider: PROVIDER_STATS_PERFORM,
        entityType: "season",
        externalId: parsed.calendarId,
        rugby365Id: season.id,
        rugby365Name: season.label,
        confirmedBy: "stats-perform-ingest",
      });
    }
    if (membershipType === "international" && competition && season) {
      await db.execute(sql`
        update player_team_memberships as m
        set competition_id = ${competition.id}::uuid,
            season_id = ${season.id}::uuid,
            synced_at = now()
        where m.source_provider = ${PROVIDER_STATS_PERFORM}
          and exists (
            select 1 from competitions c
            where c.id = m.competition_id and c.name = 'Championship'
          )
      `);
    }

    for (const contestant of parsed.contestants) {
      const team = findTeam(allTeams, contestant.contestantName);
      if (!team) {
        report.unmappedTeams.push(contestant.contestantName);
      } else if (contestant.contestantId) {
        await confirmMapping({
          provider: PROVIDER_STATS_PERFORM,
          entityType: "team",
          externalId: contestant.contestantId,
          rugby365Id: team.id,
          rugby365Name: team.name,
          confirmedBy: "stats-perform-ingest",
          notes: contestant.contestantName,
        });
      }

      for (const person of contestant.person) {
        report.peopleSeen += 1;
        const display = statsPerformPersonDisplayName(person);
        if (!display) continue;
        const key = normalizedEntityKey(display, "player");
        const matches = playerByKey.get(key) ?? [];
        let player = matches.find((row) => row.name === display) ?? matches[0] ?? null;
        if (!player && createMissingPlayers) {
          const slugBase = normalizeSlug(display);
          const slug = `${slugBase}-${person.id.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase()}`;
          try {
            const [created] = await db
              .insert(players)
              .values({
                name: display,
                slug,
                fullName: display,
                positionName: person.position ?? null,
                countryName:
                  membershipType === "international" ? contestant.contestantName : person.nationality ?? null,
                clubName: membershipType === "club" ? contestant.contestantName : null,
                clubTeamId: membershipType === "club" ? (team?.id ?? null) : null,
                internationalTeamId: membershipType === "international" ? (team?.id ?? null) : null,
                sourceProvider: PROVIDER_STATS_PERFORM,
              })
              .returning();
            player = created ?? null;
            if (created) {
              report.playersCreated += 1;
              const list = playerByKey.get(key) ?? [];
              list.push(created);
              playerByKey.set(key, list);
            }
          } catch {
            const [existing] = await db.select().from(players).where(eq(players.slug, slug)).limit(1);
            player = existing ?? null;
          }
        }
        if (!player) continue;
        report.playersMatched += 1;

        const patch: Partial<typeof players.$inferInsert> = {};
        if (!player.positionName && person.position) patch.positionName = person.position;
        if (!player.countryName && person.nationality) patch.countryName = person.nationality;
        if (!player.fullName) patch.fullName = display;
        if (membershipType === "club" && !player.clubName) patch.clubName = contestant.contestantName;
        if (membershipType === "club" && !player.clubTeamId && team) patch.clubTeamId = team.id;
        if (membershipType === "international" && !player.internationalTeamId && team) {
          patch.internationalTeamId = team.id;
        }
        if (Object.keys(patch).length) {
          await db.update(players).set(patch).where(eq(players.id, player.id));
          report.fieldsFilled += 1;
          Object.assign(player, patch);
        }

        await confirmMapping({
          provider: PROVIDER_STATS_PERFORM,
          entityType: "player",
          externalId: person.id,
          rugby365Id: player.id,
          rugby365Name: player.name,
          confirmedBy: "stats-perform-ingest",
          notes: contestant.contestantName,
        });

        if (team && season && competition) {
          await upsertPlayerTeamMembership({
            playerId: player.id,
            teamId: team.id,
            seasonId: season.id,
            competitionId: competition.id,
            status: person.active === "no" ? "departed" : "active",
            startDate: parsed.startDate?.replace(/Z$/, "") ?? null,
            endDate: parsed.endDate?.replace(/Z$/, "") ?? null,
            sourceProvider: PROVIDER_STATS_PERFORM,
            sourceUrl: `stats-perform:${parsed.calendarId ?? "squad"}`,
            membershipType,
            isCurrent: false,
          });
          report.membershipsUpserted += 1;
        }

        if (!player.imageUrl) imageCandidates.push({ id: player.id, name: display });
      }
    }
  }

  if (europe.ok) await importSquadFeed(europe.payload, "international");
  if (top14.ok) await importSquadFeed(top14.payload, "club");

  if (fillImages && imageCandidates.length) {
    const unique = [...new Map(imageCandidates.map((row) => [row.id, row])).values()].slice(0, 120);
    const thumbs = await fetchWikipediaThumbnails(unique.map((row) => row.name));
    for (const row of unique) {
      const url = thumbs.get(row.name);
      if (!url) continue;
      const saved = await registerWikipediaHeadshotIfMissing(row.id, url, row.name);
      if (saved) report.imagesFilled += 1;
    }
  }

  if (matchStats.ok) {
    const payload = asRecord(matchStats.payload) ?? {};
    const info = asRecord(payload.matchInfo);
    const live = asRecord(payload.liveData);
    const date = asString(info?.date)?.slice(0, 10);
    const contestants = Array.isArray(info?.contestant)
      ? info.contestant
      : Array.isArray(info?.contestants)
        ? info.contestants
        : [];
    const home = contestants.find((row) => asString(asRecord(row)?.position) === "home");
    const away = contestants.find((row) => asString(asRecord(row)?.position) === "away");
    const homeName = asString(asRecord(home)?.name);
    const awayName = asString(asRecord(away)?.name);
    const homeShort = asString(asRecord(home)?.contestantShortName);
    const awayShort = asString(asRecord(away)?.contestantShortName);
    const resolvedHome = homeName ? findTeam(allTeams, homeName, homeShort ? [homeShort] : []) : null;
    const resolvedAway = awayName ? findTeam(allTeams, awayName, awayShort ? [awayShort] : []) : null;
    let fixture: (typeof fixtures.$inferSelect) | null = null;
    const [byExternal] = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.externalMatchId, STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID))
      .limit(1);
    fixture = byExternal ?? null;
    if (!fixture && date && homeName && awayName) {
      const start = new Date(`${date}T00:00:00Z`);
      const end = new Date(`${date}T23:59:59Z`);
      const rows = await db
        .select()
        .from(fixtures)
        .where(and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)));
      fixture =
        rows.find((row) => {
          const homeTeam = allTeams.find((team) => team.id === row.homeTeamId);
          const awayTeam = allTeams.find((team) => team.id === row.awayTeamId);
          return (
            Boolean(homeTeam && awayTeam) &&
            statsPerformLabelsMatch(homeTeam!.name, homeName) &&
            statsPerformLabelsMatch(awayTeam!.name, awayName)
          );
        }) ?? null;
    }
    if (!fixture && date && resolvedHome?.slug && resolvedAway?.slug) {
      const top14 = await findCompetition("Top 14");
      const season = top14 ? await findSeason(top14.id, "2024/2025", date) : null;
      const [sport] = await db.select().from(sports).limit(1);
      const summary = summariseStatsPerformMatches(payload)[0];
      const slug = buildFixtureSlug({
        homeSlug: resolvedHome.slug,
        awaySlug: resolvedAway.slug,
        kickoffAt: date,
        competitionName: "Top 14",
      });
      try {
        const [created] = await db
          .insert(fixtures)
          .values({
            slug,
            sportId: sport?.id ?? null,
            homeTeamId: resolvedHome.id,
            awayTeamId: resolvedAway.id,
            competitionId: top14?.id ?? null,
            seasonId: season?.id ?? null,
            competitionName: "Top 14",
            kickoffAt: new Date(`${date}T${(summary?.time || "15:00:00").replace(/Z$/, "")}Z`),
            status: "full_time",
            period: "full_time",
            homeScore: summary?.homeScore ?? 0,
            awayScore: summary?.awayScore ?? 0,
            externalMatchId: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
          })
          .returning();
        fixture = created ?? null;
        report.fixtureCreated = Boolean(created);
      } catch {
        const [existing] = await db.select().from(fixtures).where(eq(fixtures.slug, slug)).limit(1);
        fixture = existing ?? null;
      }
    }
    if (fixture && resolvedHome && resolvedAway) {
      const oldHome = fixture.homeTeamId;
      const oldAway = fixture.awayTeamId;
      if (oldHome !== resolvedHome.id || oldAway !== resolvedAway.id) {
        await db
          .update(fixtures)
          .set({ homeTeamId: resolvedHome.id, awayTeamId: resolvedAway.id })
          .where(eq(fixtures.id, fixture.id));
        if (oldHome && oldHome !== resolvedHome.id) {
          await db
            .update(teamMatchStats)
            .set({ teamId: resolvedHome.id })
            .where(and(eq(teamMatchStats.fixtureId, fixture.id), eq(teamMatchStats.teamId, oldHome)));
          await db
            .update(playerMatchPerformanceStats)
            .set({ teamId: resolvedHome.id })
            .where(
              and(
                eq(playerMatchPerformanceStats.fixtureId, fixture.id),
                eq(playerMatchPerformanceStats.teamId, oldHome),
              ),
            );
        }
        if (oldAway && oldAway !== resolvedAway.id) {
          await db
            .update(teamMatchStats)
            .set({ teamId: resolvedAway.id })
            .where(and(eq(teamMatchStats.fixtureId, fixture.id), eq(teamMatchStats.teamId, oldAway)));
          await db
            .update(playerMatchPerformanceStats)
            .set({ teamId: resolvedAway.id })
            .where(
              and(
                eq(playerMatchPerformanceStats.fixtureId, fixture.id),
                eq(playerMatchPerformanceStats.teamId, oldAway),
              ),
            );
        }
        fixture = { ...fixture, homeTeamId: resolvedHome.id, awayTeamId: resolvedAway.id };
      }
    }
    report.fixtureMatched = Boolean(fixture);
    if (fixture && live) {
      await confirmMapping({
        provider: PROVIDER_STATS_PERFORM,
        entityType: "match",
        externalId: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
        rugby365Id: fixture.id,
        rugby365Name: `${homeName} v ${awayName}`,
        confirmedBy: "stats-perform-ingest",
      });
      const lineups = Array.isArray(live.lineUp) ? live.lineUp : [];
      const homeId = asString(asRecord(home)?.id);
      for (const lineup of lineups) {
        const rec = asRecord(lineup);
        if (!rec) continue;
        const contestantId = asString(rec.contestantId);
        const side = contestantId === homeId ? "home" : "away";
        const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
        const teamStats = statsMapFromStatList(asRecord(rec.teamStats)?.stat);
        if (teamId && Object.keys(teamStats).length) {
          await upsertTeamMatchStat({
            fixtureId: fixture.id,
            teamId,
            side,
            seasonId: fixture.seasonId,
            competitionId: fixture.competitionId,
            externalMatchId: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
            sourceProvider: PROVIDER_STATS_PERFORM,
            skipCascade: true,
            stats: {
              side,
              tries: teamStats.tries || 0,
              conversions: teamStats.conversionGoals || 0,
              penalties: teamStats.penaltyGoals || 0,
              dropGoals: teamStats.dropGoalsConverted || 0,
              carries: teamStats.runs || 0,
              metres: teamStats.metres || teamStats.carriesMetres || 0,
              tackles: teamStats.tackles || 0,
              turnoversWon: teamStats.turnoversWon || 0,
              sections: { stats_perform: teamStats },
            },
          });
          report.teamStats += 1;
        }
        const lineupPlayers = Array.isArray(rec.player) ? rec.player : [];
        for (const row of lineupPlayers) {
          const person = asRecord(row);
          if (!person || !teamId) continue;
          const externalId = asString(person.id);
          const name = statsPerformPersonDisplayName({
            id: externalId ?? "",
            firstName: asString(person.firstName) ?? "",
            lastName: asString(person.lastName) ?? "",
            matchName: asString(person.knownName) ?? undefined,
          });
          if (!externalId || !name) continue;
          const key = normalizedEntityKey(name, "player");
          const matched = (playerByKey.get(key) ?? [])[0];
          if (!matched) continue;
          const mapped = mapStatsPerformPlayerStats(person.stat);
          await upsertMatchPerformanceStat({
            fixtureId: fixture.id,
            playerId: matched.id,
            teamId,
            seasonId: fixture.seasonId,
            competitionId: fixture.competitionId,
            externalMatchId: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID,
            externalPlayerId: externalId,
            sourceProvider: PROVIDER_STATS_PERFORM,
            skipBioRefresh: true,
            stats: {
              ...mapped.parsed,
              tries: mapped.tries,
              points: mapped.points,
              extraStats: { statsPerform: mapped.map, shirtNo: asString(person.shirtNo) },
            },
          });
          report.matchStatsPlayers += 1;
        }
      }
    }
  }

  return report;
}
