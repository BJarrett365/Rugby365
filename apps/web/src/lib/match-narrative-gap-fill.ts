/**
 * Fill empty match minutes with meaningful commentary pads
 * (player data, score pulse, BI lean, territory/possession drips).
 */

import {
  formatBettingIntelligenceBody,
  liveBettingLean,
  scoreAsOfMinute,
} from "./match-narrative-betting-intel";
import type {
  NarrativeCommentaryLine,
  NarrativeMatchContext,
  NarrativeSquadPlayer,
} from "./match-narrative-commentary";

function starters(squad: NarrativeSquadPlayer[]): NarrativeSquadPlayer[] {
  return squad
    .filter((p) => /start/i.test(p.squadRole))
    .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99));
}

function scoreAt(
  ctx: NarrativeMatchContext,
  minute: number,
): { home: number; away: number } {
  const score = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, minute);
  if (
    minute >= 80 &&
    ctx.finalHomeScore != null &&
    ctx.finalAwayScore != null
  ) {
    return { home: ctx.finalHomeScore, away: ctx.finalAwayScore };
  }
  return score;
}

function biPad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const tip = ctx.winPrediction;
  if (!tip?.favoriteName) return null;
  const score = scoreAt(ctx, minute);
  const lean = liveBettingLean({
    homePercent: tip.homePercent,
    awayPercent: tip.awayPercent,
    drawPercent: tip.drawPercent,
    homeScore: score.home,
    awayScore: score.away,
    minute,
  });
  return {
    minute,
    second: 30,
    outputType: "match_fact",
    segment: "betting_intelligence",
    body: formatBettingIntelligenceBody({
      minute,
      homeName: ctx.homeName,
      awayName: ctx.awayName,
      prematchFavorite: tip.favoriteName,
      lean,
      homeScore: score.home,
      awayScore: score.away,
    }),
  };
}

function playerPad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const highlights = ctx.playerStatHighlights ?? [];
  if (highlights.length) {
    const h = highlights[minute % highlights.length]!;
    const unit = /metre/i.test(h.label) ? "m" : "";
    return {
      minute,
      second: 20,
      outputType: "match_fact",
      segment: "player_spotlight",
      body: `${minute}' — Keep an eye on ${h.playerName} (${h.teamName}) — ${h.value}${unit} ${h.label.toLowerCase()} so far is catching the eye.`,
    };
  }

  const pool = [...starters(ctx.homeSquad), ...starters(ctx.awaySquad)];
  if (!pool.length) return null;
  const p = pool[minute % pool.length]!;
  const team =
    ctx.homeSquad.some((s) => s.name === p.name) ? ctx.homeName : ctx.awayName;
  const roles = [
    "looking sharp in the carry",
    "busy around the collisions",
    "offering a useful option in midfield",
    "working hard without the ball",
    "asking questions of the defence",
  ];
  return {
    minute,
    second: 20,
    outputType: "match_fact",
    segment: "player_spotlight",
    body: `${minute}' — ${p.name} (${team}) ${roles[minute % roles.length]}.`,
  };
}

function scorePad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const score = scoreAt(ctx, minute);
  if (score.home === 0 && score.away === 0 && minute < 10) {
    return {
      minute,
      second: 15,
      outputType: "phase_play_update",
      segment: "score_pulse",
      body: `${minute}' — Still scoreless — both sides probing for the first opening.`,
    };
  }
  if (score.home === score.away) {
    return {
      minute,
      second: 15,
      outputType: "phase_play_update",
      segment: "score_pulse",
      body: `${minute}' — Locked at ${score.home}–${score.away}. One moment could swing this.`,
    };
  }
  const lead = score.home > score.away ? ctx.homeName : ctx.awayName;
  const trail = score.home > score.away ? ctx.awayName : ctx.homeName;
  const margin = Math.abs(score.home - score.away);
  return {
    minute,
    second: 15,
    outputType: "phase_play_update",
    segment: "score_pulse",
    body: `${minute}' — ${ctx.homeName} ${score.home}–${score.away} ${ctx.awayName}. ${lead} hold a ${margin}-point edge; ${trail} need a response.`,
  };
}

function pressurePad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const score = scoreAt(ctx, minute);
  if (score.home === score.away) return null;
  const trailing = score.home > score.away ? ctx.awayName : ctx.homeName;
  const coach =
    trailing === ctx.homeName
      ? ctx.homeCoachName?.trim()
      : ctx.awayCoachName?.trim();
  const coachBit = coach ? ` — ${coach} will want composure` : "";
  return {
    minute,
    second: 18,
    outputType: "phase_play_update",
    segment: "pressure_pad",
    body: `${minute}' — Pressure building on ${trailing}${coachBit} as the clock ticks on.`,
  };
}

function possessionPad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  const useFirst = minute <= 40;
  const homePct = useFirst
    ? stats.home.possessionFirstHalfPct ?? stats.home.possessionOverallPct
    : stats.home.possessionSecondHalfPct ?? stats.home.possessionOverallPct;
  const awayPct = useFirst
    ? stats.away.possessionFirstHalfPct ?? stats.away.possessionOverallPct
    : stats.away.possessionSecondHalfPct ?? stats.away.possessionOverallPct;
  if (homePct == null || awayPct == null) return null;
  const halfLabel = useFirst ? "first-half" : "second-half";
  return {
    minute,
    second: 22,
    outputType: "match_fact",
    segment: "possession_pad",
    body: `${minute}' — ${halfLabel[0]!.toUpperCase()}${halfLabel.slice(1)} possession picture: ${ctx.homeName} ${homePct}%, ${ctx.awayName} ${awayPct}%.`,
  };
}

function territoryPad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  const useFirst = minute <= 40;
  const homePct = useFirst
    ? stats.home.territoryFirstHalfPct ?? stats.home.territoryOverallPct
    : stats.home.territorySecondHalfPct ?? stats.home.territoryOverallPct;
  const awayPct = useFirst
    ? stats.away.territoryFirstHalfPct ?? stats.away.territoryOverallPct
    : stats.away.territorySecondHalfPct ?? stats.away.territoryOverallPct;
  if (homePct == null || awayPct == null) return null;
  const leader = homePct >= awayPct ? ctx.homeName : ctx.awayName;
  return {
    minute,
    second: 24,
    outputType: "match_fact",
    segment: "territory_pad",
    body: `${minute}' — Territory favours ${leader} right now (${ctx.homeName} ${homePct}% / ${ctx.awayName} ${awayPct}%).`,
  };
}

function defencePad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  if (stats.home.tackles + stats.away.tackles <= 0) return null;
  const focusHome = minute % 2 === 0;
  const side = focusHome ? stats.home : stats.away;
  const name = focusHome ? ctx.homeName : ctx.awayName;
  const missed = side.missedTackles;
  const missBit = missed != null ? `, ${missed} missed` : "";
  return {
    minute,
    second: 26,
    outputType: "match_fact",
    segment: "defence_pad",
    body: `${minute}' — Defensive workload: ${name} up to ${side.tackles} tackles${missBit}.`,
  };
}

function attackPad(ctx: NarrativeMatchContext, minute: number): NarrativeCommentaryLine | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  if (stats.home.metres + stats.away.metres <= 0) return null;
  const focusHome = minute % 2 === 1;
  const side = focusHome ? stats.home : stats.away;
  const name = focusHome ? ctx.homeName : ctx.awayName;
  return {
    minute,
    second: 28,
    outputType: "match_fact",
    segment: "attack_pad",
    body: `${minute}' — ${name} have made ${side.metres}m from ${side.carries} carries — looking for a soft shoulder.`,
  };
}

/** Build one meaningful pad for an empty minute. */
export function buildMeaningfulMinutePad(
  ctx: NarrativeMatchContext,
  minute: number,
): NarrativeCommentaryLine | null {
  const builders = [
    () => biPad(ctx, minute),
    () => playerPad(ctx, minute),
    () => scorePad(ctx, minute),
    () => pressurePad(ctx, minute),
    () => possessionPad(ctx, minute),
    () => territoryPad(ctx, minute),
    () => defencePad(ctx, minute),
    () => attackPad(ctx, minute),
  ];

  // Rotate start index so consecutive empty minutes get variety.
  const start = minute % builders.length;
  for (let i = 0; i < builders.length; i += 1) {
    const line = builders[(start + i) % builders.length]!();
    if (line) return line;
  }
  return {
    minute,
    second: 30,
    outputType: "phase_play_update",
    segment: "minute_pulse",
    body: `${minute}' — Still plenty to play for between ${ctx.homeName} and ${ctx.awayName}.`,
  };
}

/**
 * Ensure every minute from 1..maxMinute has at least one commentary line.
 * Existing event/stat lines win; only empty minutes get pads.
 */
export function fillCommentaryMinuteGaps(
  lines: NarrativeCommentaryLine[],
  ctx: NarrativeMatchContext,
  maxMinute: number,
): NarrativeCommentaryLine[] {
  const covered = new Set<number>();
  for (const line of lines) {
    if (line.minute >= 1 && line.minute <= maxMinute) covered.add(line.minute);
  }

  const pads: NarrativeCommentaryLine[] = [];
  const cap = Math.max(1, Math.min(80, maxMinute));
  for (let minute = 1; minute <= cap; minute += 1) {
    if (covered.has(minute)) continue;
    const pad = buildMeaningfulMinutePad(ctx, minute);
    if (pad) pads.push(pad);
  }
  return pads.length ? [...lines, ...pads] : lines;
}
