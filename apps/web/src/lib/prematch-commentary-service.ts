import { eq } from "drizzle-orm";
import { commentarySuggestions } from "@rugby365/db";
import type { MatchSnapshot, Sport365HeadToHead, Sport365Lineups } from "@rugby365/match-operator-agent";
import { chatCompletion, getOpenAiApiKey, parseJsonObject } from "./openai-client";
import { getDb } from "./db";
import { getFixtureById } from "./fixture-admin-service";

export type PrematchSegment =
  | "team_announcement_home"
  | "team_announcement_away"
  | "match_intro"
  | "interesting_facts"
  | "head_to_head";

const SEGMENT_LABELS: Record<PrematchSegment, string> = {
  team_announcement_home: "Team announcement — home",
  team_announcement_away: "Team announcement — away",
  match_intro: "Match introduction",
  interesting_facts: "Interesting facts",
  head_to_head: "Head to head",
};

const SEGMENT_OUTPUT_TYPES: Record<PrematchSegment, string> = {
  team_announcement_home: "team_announcement",
  team_announcement_away: "team_announcement",
  match_intro: "match_intro",
  interesting_facts: "match_fact",
  head_to_head: "head_to_head",
};

type PrematchAiResponse = {
  team_announcement_home?: string;
  team_announcement_away?: string;
  match_intro?: string[];
  interesting_facts?: string[];
  head_to_head?: string[];
};

async function prematchSegmentExists(fixtureId: string, segment: PrematchSegment): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ facts: commentarySuggestions.facts })
    .from(commentarySuggestions)
    .where(eq(commentarySuggestions.fixtureId, fixtureId));

  return rows.some((row) => {
    const facts = row.facts as Record<string, unknown> | null;
    return facts?.segment === segment;
  });
}

async function insertPrematchSuggestion(
  fixtureId: string,
  segment: PrematchSegment,
  options: string[],
  extraFacts: Record<string, unknown>,
) {
  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  if (!cleaned.length) return null;

  const db = getDb();
  const [suggestion] = await db
    .insert(commentarySuggestions)
    .values({
      fixtureId,
      triggerEventId: null,
      facts: {
        segment,
        segment_label: SEGMENT_LABELS[segment],
        output_type: SEGMENT_OUTPUT_TYPES[segment],
        minute: 0,
        second: 0,
        event_type: segment,
        ...extraFacts,
      },
      renderedOptions: cleaned,
      status: "pending",
    })
    .returning();

  return suggestion;
}

function formatLineupForPrompt(teamName: string, lineups: Sport365Lineups | undefined, side: "home" | "away") {
  const lineup = lineups?.[side];
  if (!lineup?.starting.length) return undefined;
  const starters = lineup.starting.map((p) => `${p.jerseyNumber}. ${p.name}`).join(", ");
  return `${teamName} starting XV: ${starters}`;
}

function formatHeadToHeadForPrompt(h2h: Sport365HeadToHead | undefined, home: string, away: string) {
  if (!h2h) return undefined;
  if (h2h.totalMeetings === 0) {
    return `No previous meetings between ${home} and ${away} in Sport365 head-to-head records.`;
  }
  const summary = `${home} ${h2h.homeWins} wins, ${away} ${h2h.awayWins} wins, ${h2h.draws} draws in ${h2h.totalMeetings} meetings.`;
  const recent = h2h.meetings
    .slice(0, 5)
    .map((m) => {
      const date = m.date ? new Date(m.date).toLocaleDateString("en-GB") : "unknown date";
      return `${date}: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`;
    })
    .join("; ");
  return `${summary} Recent: ${recent}`;
}

function headToHeadOptionsFromImport(
  h2h: Sport365HeadToHead | undefined,
  home: string,
  away: string,
): string[] {
  if (!h2h) return [];
  if (h2h.totalMeetings === 0) {
    return [
      `This is the first recorded meeting between ${home} and ${away} in Sport365's head-to-head data.`,
    ];
  }

  const options = [
    `Head to head: ${home} have won ${h2h.homeWins}, ${away} have won ${h2h.awayWins}, with ${h2h.draws} draw${h2h.draws === 1 ? "" : "s"} across ${h2h.totalMeetings} meetings.`,
  ];

  const latest = h2h.meetings[0];
  if (latest) {
    const date = latest.date ? new Date(latest.date).toLocaleDateString("en-GB") : "their last meeting";
    options.push(
      `Last met on ${date}: ${latest.homeTeam} ${latest.homeScore}-${latest.awayScore} ${latest.awayTeam}.`,
    );
  }

  return options.slice(0, 2);
}

function buildPrematchContext(
  fixture: NonNullable<Awaited<ReturnType<typeof getFixtureById>>>,
  snapshot?: MatchSnapshot,
) {
  const home = fixture.homeTeam?.name ?? snapshot?.homeTeam ?? "Home";
  const away = fixture.awayTeam?.name ?? snapshot?.awayTeam ?? "Away";
  const snap = (fixture.providerSnapshot ?? {}) as Record<string, unknown>;
  const venue = snap.venue as { name?: string; city?: string } | undefined;
  const lineups = (snapshot?.lineups ?? snap.lineups) as Sport365Lineups | undefined;
  const headToHead = (snapshot?.headToHead ?? snap.headToHead) as Sport365HeadToHead | undefined;

  return {
    home,
    away,
    competition: fixture.competitionName ?? (typeof snap.competition === "string" ? snap.competition : "International"),
    kickoffAt: fixture.kickoffAt?.toISOString?.() ?? snapshot?.kickoffAt,
    venue: venue ? [venue.name, venue.city].filter(Boolean).join(", ") : undefined,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    status: fixture.status,
    homeLineup: formatLineupForPrompt(home, lineups, "home"),
    awayLineup: formatLineupForPrompt(away, lineups, "away"),
    headToHeadSummary: formatHeadToHeadForPrompt(headToHead, home, away),
    headToHead,
    lineups,
  };
}

async function ensureImportedHeadToHeadCommentary(
  fixtureId: string,
  snapshot?: MatchSnapshot,
): Promise<number> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return 0;
  if (await prematchSegmentExists(fixtureId, "head_to_head")) return 0;

  const ctx = buildPrematchContext(fixture, snapshot);
  const options = headToHeadOptionsFromImport(ctx.headToHead, ctx.home, ctx.away);
  if (!options.length) return 0;

  const row = await insertPrematchSuggestion(fixtureId, "head_to_head", options, {
    source: "sport365",
    home_team: ctx.home,
    away_team: ctx.away,
    team: ctx.home,
    opponent: ctx.away,
    imported_head_to_head: true,
  });
  return row ? 1 : 0;
}

export async function ensurePrematchCommentary(
  fixtureId: string,
  snapshot?: MatchSnapshot,
): Promise<number> {
  let created = await ensureImportedHeadToHeadCommentary(fixtureId, snapshot);

  if (!(await getOpenAiApiKey())) return created;

  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return created;

  const ctx = buildPrematchContext(fixture, snapshot);
  const segmentsNeeded: PrematchSegment[] = [];

  for (const segment of Object.keys(SEGMENT_LABELS) as PrematchSegment[]) {
    if (!(await prematchSegmentExists(fixtureId, segment))) segmentsNeeded.push(segment);
  }
  if (!segmentsNeeded.length) return created;

  const content = await chatCompletion({
    json: true,
    system: `You are Rugby365 live broadcast commentary. Write polished stadium PA and broadcast copy for rugby union.
Return strict JSON only with these keys:
- team_announcement_home: string (30-60 words, welcoming the home team to the field)
- team_announcement_away: string (30-60 words, welcoming the away team)
- match_intro: array of 2 strings (45-80 words each, setting the scene for the match)
- interesting_facts: array of 3 strings (one sharp fact each, under 35 words)
- head_to_head: array of 2 strings (historical or narrative head-to-head angles, under 45 words each)
Use the line-up and head-to-head facts provided when available. Do not invent specific player names unless they appear in the line-ups.`,
    user: `Match: ${ctx.home} vs ${ctx.away}
Competition: ${ctx.competition}
Kickoff: ${ctx.kickoffAt ?? "TBC"}
Venue: ${ctx.venue ?? "TBC"}
Current score (if played): ${ctx.homeScore}-${ctx.awayScore}
Status: ${ctx.status}
${ctx.homeLineup ? `\n${ctx.homeLineup}` : ""}
${ctx.awayLineup ? `\n${ctx.awayLineup}` : ""}
${ctx.headToHeadSummary ? `\nHead to head: ${ctx.headToHeadSummary}` : ""}`,
  });

  const parsed = parseJsonObject<PrematchAiResponse>(content, {});

  const baseFacts = {
    source: "openai",
    home_team: ctx.home,
    away_team: ctx.away,
    team: ctx.home,
    opponent: ctx.away,
  };

  if (segmentsNeeded.includes("team_announcement_home") && parsed.team_announcement_home) {
    const row = await insertPrematchSuggestion(fixtureId, "team_announcement_home", [parsed.team_announcement_home], {
      ...baseFacts,
      team: ctx.home,
      opponent: ctx.away,
    });
    if (row) created += 1;
  }

  if (segmentsNeeded.includes("team_announcement_away") && parsed.team_announcement_away) {
    const row = await insertPrematchSuggestion(fixtureId, "team_announcement_away", [parsed.team_announcement_away], {
      ...baseFacts,
      team: ctx.away,
      opponent: ctx.home,
    });
    if (row) created += 1;
  }

  if (segmentsNeeded.includes("match_intro") && parsed.match_intro?.length) {
    const row = await insertPrematchSuggestion(fixtureId, "match_intro", parsed.match_intro.slice(0, 2), baseFacts);
    if (row) created += 1;
  }

  if (segmentsNeeded.includes("interesting_facts") && parsed.interesting_facts?.length) {
    const row = await insertPrematchSuggestion(
      fixtureId,
      "interesting_facts",
      parsed.interesting_facts.slice(0, 3),
      baseFacts,
    );
    if (row) created += 1;
  }

  if (segmentsNeeded.includes("head_to_head") && parsed.head_to_head?.length) {
    const row = await insertPrematchSuggestion(fixtureId, "head_to_head", parsed.head_to_head.slice(0, 2), baseFacts);
    if (row) created += 1;
  }

  return created;
}
