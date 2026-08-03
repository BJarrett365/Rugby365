/**
 * Rugby365 Commentary Intelligence Engine.
 *
 * 10 independent layers × style options × rotating personalities ×
 * multi-layer blending, with anti-Opta publishing rules.
 */

import { liveBettingLean, scoreAsOfMinute } from "./match-narrative-betting-intel";
import type {
  NarrativeCommentaryLine,
  NarrativeEventInput,
  NarrativeMatchContext,
} from "./match-narrative-commentary";
import {
  BREAKDOWN_GOOD,
  DEFENCE_STAND,
  INSIGHT_OPENINGS,
  LINEOUT_CONCERN,
  LIVE_STYLES,
  MOMENTUM_LEVEL,
  PERSONALITY_OPENERS,
  PERSONALITY_ROTATION,
  POSSESSION_WITHOUT_POINTS,
  SCRUM_GOOD,
  TERRITORY_CONTROL,
  TRY_BUILDERS,
  WHATS_NEXT_OPENERS,
  momentumLeadPhrases,
  pickFreshPhrase,
  pickPhrase,
  type LiveStyle,
  type PersonalityMode,
} from "./match-narrative-phrases";

export type CommentaryLayer =
  | "live_match"
  | "match_story"
  | "momentum"
  | "tactical_analysis"
  | "player_watch"
  | "coach_watch"
  | "statistical_insight"
  | "defensive_analysis"
  | "match_context"
  | "whats_next";

export type CommentaryPriority = 1 | 2 | 3 | 4 | 5;

type StoryState = {
  homeScore: number;
  awayScore: number;
  lastScoreMinute: number;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  narrativeBeat: string;
  personalityIndex: number;
  recentOpenings: string[];
  lastStatKeys: string[];
  lastInsightMinute: number;
  lastSpotlightMinute: number;
  lastTacticalMinute: number;
  lastMomentumMinute: number;
  earlyStory: boolean;
  midStory: boolean;
  hourStory: boolean;
};

function line(
  minute: number,
  second: number,
  segment: string,
  body: string,
  priority: CommentaryPriority,
  layers?: CommentaryLayer[],
  personality?: PersonalityMode,
): NarrativeCommentaryLine {
  const layerTag = layers?.length ? ` [${layers.join("+")}]` : "";
  const voiceTag = personality ? ` · ${personality}` : "";
  void layerTag;
  void voiceTag;
  return {
    minute,
    second,
    outputType: priority >= 4 ? "score_update" : "match_fact",
    segment,
    body,
  };
}

function scoreText(ctx: NarrativeMatchContext, home: number, away: number): string {
  return `${ctx.homeName} ${home}–${away} ${ctx.awayName}`;
}

function applyScore(
  ctx: NarrativeMatchContext,
  running: { home: number; away: number },
  event: NarrativeEventInput,
  delta: number,
) {
  if (typeof event.homeScore === "number" && typeof event.awayScore === "number") {
    running.home = event.homeScore;
    running.away = event.awayScore;
    return;
  }
  const team = (event.teamName ?? "").trim();
  if (team === ctx.homeName) running.home += delta;
  else if (team === ctx.awayName) running.away += delta;
}

function coachFor(ctx: NarrativeMatchContext, teamName: string): string | null {
  if (teamName === ctx.homeName) return ctx.homeCoachName?.trim() || null;
  if (teamName === ctx.awayName) return ctx.awayCoachName?.trim() || null;
  return null;
}

function nextPersonality(story: StoryState): PersonalityMode {
  const mode = PERSONALITY_ROTATION[story.personalityIndex % PERSONALITY_ROTATION.length]!;
  story.personalityIndex += 1;
  return mode;
}

function takeOpening(story: StoryState, seed: number, phrases: string[]): string {
  const opening = pickFreshPhrase(seed, phrases, story.recentOpenings, 10);
  story.recentOpenings.push(opening);
  if (story.recentOpenings.length > 24) story.recentOpenings.shift();
  return opening;
}

function rememberStat(story: StoryState, key: string): boolean {
  if (story.lastStatKeys.includes(key)) return false;
  story.lastStatKeys.push(key);
  if (story.lastStatKeys.length > 12) story.lastStatKeys.shift();
  return true;
}

function liveStyleFor(minute: number): LiveStyle {
  return LIVE_STYLES[minute % LIVE_STYLES.length]!;
}

/** Layer 1 — Live Match Commentary (priority events). */
function buildLiveEventClause(
  ctx: NarrativeMatchContext,
  event: NarrativeEventInput,
  running: { home: number; away: number },
  story: StoryState,
): { body: string | null; priority: CommentaryPriority; scored: boolean; skipForStory?: boolean } {
  const type = event.eventType.toLowerCase().replace(/[\s-]+/g, "_");
  const minute = Math.max(0, event.minute);
  const second = Math.max(0, Math.min(59, event.second ?? 0));
  const team = (event.teamName ?? "").trim();
  const player = (event.playerName ?? "").trim();
  const label = (event.label ?? "").trim();
  const periodText = `${type} ${label} ${player}`;
  const prev = { ...running };
  const style = liveStyleFor(minute + second);
  let scored = false;
  let priority: CommentaryPriority = 3;
  let body: string | null = null;

  const tryFlavour = pickPhrase(minute + second, TRY_BUILDERS);

  if (type.includes("penalty_try")) {
    applyScore(ctx, running, event, 7);
    scored = true;
    priority = 5;
    body =
      style === "excited"
        ? `${minute}' — PENALTY TRY! Straight under the posts for ${team || "the attackers"}! ${scoreText(ctx, running.home, running.away)}.`
        : `${minute}' — Penalty try. The referee marches under the posts for ${team || "the attacking side"}. ${scoreText(ctx, running.home, running.away)}.`;
  } else if (type === "try" || (type.includes("try") && !type.includes("conversion"))) {
    applyScore(ctx, running, event, 5);
    scored = true;
    priority = 5;
    if (style === "storytelling") {
      body = player
        ? `${minute}' — TRY! The move finally cracks open and ${player} finishes for ${team || "their side"} ${tryFlavour}. ${scoreText(ctx, running.home, running.away)}.`
        : `${minute}' — TRY ${tryFlavour}. ${scoreText(ctx, running.home, running.away)}.`;
    } else if (style === "calm") {
      body = player
        ? `${minute}' — Try to ${player} (${team || "attacking side"}). ${scoreText(ctx, running.home, running.away)}.`
        : `${minute}' — Try scored. ${scoreText(ctx, running.home, running.away)}.`;
    } else {
      body = player
        ? `${minute}' — TRY! ${player} crosses for ${team || "their side"} ${tryFlavour}. ${scoreText(ctx, running.home, running.away)}.`
        : `${minute}' — TRY for ${team || "the attacking side"} ${tryFlavour}. ${scoreText(ctx, running.home, running.away)}.`;
    }
  } else if (type.includes("missed_conversion") || (type.includes("conversion") && type.includes("miss"))) {
    priority = 3;
    body = player
      ? `${minute}' — ${player} pushes the conversion wide — still ${scoreText(ctx, running.home, running.away)}.`
      : `${minute}' — The conversion drifts wide.`;
  } else if (type.includes("conversion")) {
    applyScore(ctx, running, event, 2);
    scored = running.home !== prev.home || running.away !== prev.away;
    priority = 4;
    body = player
      ? `${minute}' — ${player} adds the extras and it's ${scoreText(ctx, running.home, running.away)}.`
      : `${minute}' — Conversion good. ${scoreText(ctx, running.home, running.away)}.`;
  } else if (type.includes("penalty_goal")) {
    applyScore(ctx, running, event, 3);
    scored = true;
    priority = 5;
    body = player
      ? `${minute}' — ${player} slots the penalty for ${team || "their side"}. ${scoreText(ctx, running.home, running.away)}.`
      : `${minute}' — Penalty goal. ${scoreText(ctx, running.home, running.away)}.`;
  } else if (type === "penalty" || type.includes("penalty_awarded")) {
    priority = 3;
    body = `${minute}' — Penalty to ${team || "the attacking side"} after the opposition are caught on the wrong side of the law.`;
  } else if (type.includes("drop_goal")) {
    applyScore(ctx, running, event, 3);
    scored = true;
    priority = 5;
    body = player
      ? `${minute}' — Drop goal! ${player} for ${team || "their side"}. ${scoreText(ctx, running.home, running.away)}.`
      : `${minute}' — Drop goal. ${scoreText(ctx, running.home, running.away)}.`;
  } else if (type.includes("yellow")) {
    priority = 4;
    body = player
      ? `${minute}' — Yellow card for ${player}${team ? ` (${team})` : ""}. Ten minutes in the sin-bin and the shape of the contest shifts.`
      : `${minute}' — Yellow card shown${team ? ` to ${team}` : ""}.`;
  } else if (type.includes("red")) {
    priority = 5;
    body = player
      ? `${minute}' — Red card! ${player} is sent off${team ? ` for ${team}` : ""}. That changes everything.`
      : `${minute}' — Red card shown${team ? ` to ${team}` : ""}.`;
  } else if (type.includes("sub") || type.includes("replacement")) {
    return { body: null, priority: 1, scored: false };
  } else if (type.includes("half_time") || /first.?half.?end|half.?time/i.test(periodText)) {
    story.halfTimeHome = running.home;
    story.halfTimeAway = running.away;
    return { body: null, priority: 5, scored: false, skipForStory: true };
  } else if (/second.?half.?start/i.test(periodText) || type.includes("second_half_start")) {
    priority = 4;
    body = `${minute}' — Second half underway. ${scoreText(ctx, running.home, running.away)}.`;
  } else if (type.includes("full_time") || type === "ft" || type.includes("end_of_match")) {
    return { body: null, priority: 5, scored: false, skipForStory: true };
  } else if (type === "period") {
    if (/first.?half.?end|half.?time/i.test(periodText)) {
      story.halfTimeHome = running.home;
      story.halfTimeAway = running.away;
      return { body: null, priority: 5, scored: false, skipForStory: true };
    }
    if (/second.?half.?start/i.test(periodText)) {
      priority = 4;
      body = `${minute}' — Second half underway. ${scoreText(ctx, running.home, running.away)}.`;
    } else {
      return { body: null, priority: 1, scored: false };
    }
  } else {
    return { body: null, priority: 1, scored: false };
  }

  if (scored) {
    story.lastScoreMinute = minute;
    story.homeScore = running.home;
    story.awayScore = running.away;
  }

  return { body, priority, scored };
}

/** Layer 6 — Coach Watch. */
function buildCoachWatchLines(
  ctx: NarrativeMatchContext,
  events: NarrativeEventInput[],
): NarrativeCommentaryLine[] {
  const subs = events.filter((e) => /sub|replacement/i.test(e.eventType));
  if (!subs.length) return [];

  const byKey = new Map<string, NarrativeEventInput[]>();
  for (const sub of subs) {
    const key = `${sub.minute}|${sub.teamName ?? ""}`;
    const list = byKey.get(key) ?? [];
    list.push(sub);
    byKey.set(key, list);
  }

  const lines: NarrativeCommentaryLine[] = [];
  for (const group of byKey.values()) {
    const first = group[0]!;
    const team = (first.teamName ?? "").trim();
    const coach = coachFor(ctx, team) || team || "The coaching staff";
    const minute = first.minute;

    if (group.length >= 3 && minute >= 50) {
      const names = group
        .map((g) => (g.playerOn ?? g.playerName ?? "").trim())
        .filter(Boolean)
        .slice(0, 3);
      lines.push(
        line(
          minute,
          first.second ?? 0,
          "coach_watch",
          `${minute}' — ${coach} has emptied the bench: ${names.join(", ")}${
            group.length > 3 ? " and more" : ""
          }. Fresh legs suggest one final push.`,
          3,
          ["coach_watch", "momentum"],
        ),
      );
      continue;
    }

    for (const sub of group) {
      const on = (sub.playerOn ?? sub.playerName ?? "").trim();
      const off = (sub.playerOff ?? "").trim();
      if (!on && !off) continue;
      let body: string;
      if (minute >= 50 && on && off) {
        body = `${minute}' — ${coach} turns to the bench: ${on} on for ${off}. Fresh legs with the contest still there to be won.`;
      } else if (on && off) {
        body = `${minute}' — Early change from ${coach}: ${on} replaces ${off}. A tactical tweak rather than a panic move.`;
      } else {
        body = `${minute}' — ${coach} makes a change, with ${on || "a fresh body"} entering the fray.`;
      }
      lines.push(line(minute, sub.second ?? 0, "coach_watch", body, 3, ["coach_watch"]));
    }
  }
  return lines;
}

type LayerClause = { layer: CommentaryLayer; text: string; statKey?: string };

function clauseMomentum(
  ctx: NarrativeMatchContext,
  minute: number,
  score: { home: number; away: number },
): LayerClause {
  if (score.home === score.away) {
    return { layer: "momentum", text: pickPhrase(minute, MOMENTUM_LEVEL) };
  }
  const homeLead = score.home > score.away;
  const lead = homeLead ? ctx.homeName : ctx.awayName;
  const trail = homeLead ? ctx.awayName : ctx.homeName;
  const opener = pickPhrase(
    minute + score.home + score.away,
    momentumLeadPhrases(homeLead, ctx.homeName, ctx.awayName),
  );
  const detail = pickPhrase(minute, [
    `Their forwards are winning collisions and ${trail} haven't had much clean ball.`,
    `${trail} are being asked to make tackle after tackle.`,
    `The breakdown has become the key battleground and ${lead} are winning it.`,
    `Carries and go-forward are with ${lead} right now.`,
  ]);
  return { layer: "momentum", text: `${opener} ${detail}` };
}

function clauseTactical(ctx: NarrativeMatchContext, minute: number, story: StoryState): LayerClause | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  const home = stats.home;
  const away = stats.away;

  if ((home.kickingMetres ?? 0) + (away.kickingMetres ?? 0) > 200) {
    const bootLeader =
      (home.kickingMetres ?? 0) >= (away.kickingMetres ?? 0) ? ctx.homeName : ctx.awayName;
    const key = `kick:${bootLeader}`;
    if (rememberStat(story, key)) {
      return {
        layer: "tactical_analysis",
        text: `${bootLeader}'s kicking game is shaping the field — they're winning the territorial arm-wrestle through the boot rather than endless phases.`,
        statKey: key,
      };
    }
  }

  if (home.scrumSuccessPct != null && home.scrumSuccessPct >= 90 && rememberStat(story, "scrum:home")) {
    return {
      layer: "tactical_analysis",
      text: `${ctx.homeName} ${pickPhrase(minute, SCRUM_GOOD)}, which matters when they need a platform in the opposition half.`,
      statKey: "scrum:home",
    };
  }
  if (away.scrumSuccessPct != null && away.scrumSuccessPct >= 90 && rememberStat(story, "scrum:away")) {
    return {
      layer: "tactical_analysis",
      text: `${ctx.awayName} ${pickPhrase(minute, SCRUM_GOOD)}.`,
      statKey: "scrum:away",
    };
  }

  if (
    home.lineoutSuccessPct != null &&
    home.lineoutSuccessPct <= 60 &&
    rememberStat(story, "lo:home")
  ) {
    return {
      layer: "tactical_analysis",
      text: `For ${ctx.homeName}, the lineout ${pickPhrase(minute, LINEOUT_CONCERN)} — clean ball has been hard to find.`,
      statKey: "lo:home",
    };
  }
  if (
    away.lineoutSuccessPct != null &&
    away.lineoutSuccessPct <= 60 &&
    rememberStat(story, "lo:away")
  ) {
    return {
      layer: "tactical_analysis",
      text: `For ${ctx.awayName}, the lineout ${pickPhrase(minute, LINEOUT_CONCERN)}.`,
      statKey: "lo:away",
    };
  }

  if (home.rucksSuccessPct != null && home.rucksSuccessPct >= 95 && (home.totalRucks ?? 0) >= 20) {
    const key = "ruck:home";
    if (rememberStat(story, key)) {
      return {
        layer: "tactical_analysis",
        text: `${ctx.homeName} ${pickPhrase(minute, BREAKDOWN_GOOD)}.`,
        statKey: key,
      };
    }
  }

  return null;
}

function clauseStatistical(
  ctx: NarrativeMatchContext,
  minute: number,
  score: { home: number; away: number },
  story: StoryState,
): LayerClause | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  const useFirst = minute <= 40;
  const homeTerr = useFirst
    ? stats.home.territoryFirstHalfPct ?? stats.home.territoryOverallPct
    : stats.home.territorySecondHalfPct ?? stats.home.territoryOverallPct;
  const awayTerr = useFirst
    ? stats.away.territoryFirstHalfPct ?? stats.away.territoryOverallPct
    : stats.away.territorySecondHalfPct ?? stats.away.territoryOverallPct;
  if (homeTerr == null || awayTerr == null) return null;

  const gap = Math.abs(homeTerr - awayTerr);
  if (gap < 8) return null;

  const leader = homeTerr >= awayTerr ? ctx.homeName : ctx.awayName;
  const trail = leader === ctx.homeName ? ctx.awayName : ctx.homeName;
  const leaderAhead =
    leader === ctx.homeName ? score.home >= score.away : score.away >= score.home;
  const key = `terr:${leader}:${Math.round(gap / 5)}`;
  if (!rememberStat(story, key)) return null;

  const control = `${leader} ${pickPhrase(minute, TERRITORY_CONTROL).replace(/^are /, "are ")}`;
  if (!leaderAhead) {
    return {
      layer: "statistical_insight",
      text: `${control}, ${pickPhrase(minute + 1, POSSESSION_WITHOUT_POINTS)}. That gap between field position and the scoreboard is the story.`,
      statKey: key,
    };
  }
  return {
    layer: "statistical_insight",
    text: `${leader} have enjoyed the better territory while ${trail} are being asked to dig in — and that pressure is starting to show.`,
    statKey: key,
  };
}

function clauseDefensive(ctx: NarrativeMatchContext, minute: number, story: StoryState): LayerClause | null {
  const stats = ctx.teamStats;
  if (!stats) return null;
  const home = stats.home;
  const away = stats.away;

  if (home.tackleSuccessPct != null && home.tackleSuccessPct >= 75 && rememberStat(story, "def:home")) {
    return {
      layer: "defensive_analysis",
      text: `${ctx.homeName}'s defence has stood up — high completion in the tackle and few soft metres conceded.`,
      statKey: "def:home",
    };
  }
  if (away.tackleSuccessPct != null && away.tackleSuccessPct >= 75 && rememberStat(story, "def:away")) {
    return {
      layer: "defensive_analysis",
      text: `${ctx.awayName}'s defensive organisation has kept them in the fight when the ball has gone against them.`,
      statKey: "def:away",
    };
  }
  if ((home.missedTackles ?? 0) >= 15 || (away.missedTackles ?? 0) >= 15) {
    const soft =
      (home.missedTackles ?? 0) >= (away.missedTackles ?? 0) ? ctx.homeName : ctx.awayName;
    const key = `miss:${soft}`;
    if (rememberStat(story, key)) {
      return {
        layer: "defensive_analysis",
        text: `${soft} have missed too many tackles; that softness in contact is inviting pressure.`,
        statKey: key,
      };
    }
  }
  if ((home.turnoversWon ?? 0) + (away.turnoversWon ?? 0) > 0) {
    const jackal =
      (home.turnoversWon ?? 0) >= (away.turnoversWon ?? 0) ? ctx.homeName : ctx.awayName;
    const key = `to:${jackal}`;
    if (rememberStat(story, key)) {
      return {
        layer: "defensive_analysis",
        text: `${jackal} are winning turnovers that stop attacks before they breathe — classic defensive disruption.`,
        statKey: key,
      };
    }
  }

  return {
    layer: "defensive_analysis",
    text: `${pickPhrase(minute, DEFENCE_STAND)} as both sides refuse to gift easy metres.`,
  };
}

function clausePlayerWatch(ctx: NarrativeMatchContext, minute: number): LayerClause | null {
  const highlights = ctx.playerStatHighlights ?? [];
  if (!highlights.length) return null;
  const h = highlights[minute % highlights.length]!;
  const opener = pickPhrase(minute, [
    `${h.playerName} continues to influence everything for ${h.teamName}.`,
    `${h.playerName} is everywhere for ${h.teamName}.`,
    `Keep an eye on ${h.playerName} — central to ${h.teamName}'s afternoon.`,
    `${h.playerName} is causing problems whenever he gets involved.`,
  ]);
  const label = h.label.toLowerCase();
  let detail: string;
  if (/point/.test(label)) {
    detail = `Already the leading points man with ${h.value}.`;
  } else if (/\btries\b|\btry\b/.test(label)) {
    detail = `${h.value} tr${h.value === 1 ? "y" : "ies"} already underline his impact.`;
  } else if (/tackle/.test(label)) {
    detail = `Already into ${h.value} tackles — a huge defensive shift.`;
  } else if (/metre|meter/.test(label)) {
    detail = `${h.value}m made tells its own story about his go-forward.`;
  } else {
    detail = `That ${label} count (${h.value}) tells its own story.`;
  }
  return { layer: "player_watch", text: `${opener} ${detail}` };
}

function clauseMatchContext(ctx: NarrativeMatchContext, minute: number): LayerClause | null {
  const bits: string[] = [];
  if (ctx.homeTable && ctx.awayTable) {
    bits.push(
      `Table context still hangs over this ${ctx.competitionName} meeting — ${ctx.homeName} came in ${ordinal(ctx.homeTable.rank)}, ${ctx.awayName} ${ordinal(ctx.awayTable.rank)}.`,
    );
  } else if (ctx.competitionName) {
    bits.push(`There's plenty riding on these ${ctx.competitionName} points.`);
  }
  if (ctx.venueName?.trim() && minute <= 25) {
    bits.push(`Conditions at ${ctx.venueName.trim()} continue to favour the side that manages the ball.`);
  }
  if (!bits.length) return null;
  return { layer: "match_context", text: pickPhrase(minute, bits) };
}

function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

function clauseWhatsNext(
  ctx: NarrativeMatchContext,
  minute: number,
  score: { home: number; away: number },
): LayerClause {
  const tip = ctx.winPrediction;
  if (tip?.favoriteName && minute >= 50 && minute <= 75) {
    const lean = liveBettingLean({
      homePercent: tip.homePercent,
      awayPercent: tip.awayPercent,
      drawPercent: tip.drawPercent,
      homeScore: score.home,
      awayScore: score.away,
      minute,
    });
    const fav =
      lean.favoriteSide === "home"
        ? ctx.homeName
        : lean.favoriteSide === "away"
          ? ctx.awayName
          : tip.favoriteName;
    return {
      layer: "whats_next",
      text: `If the pattern holds, ${fav} look better placed — but one break against the grain would rewrite that quickly.`,
    };
  }
  return {
    layer: "whats_next",
    text: pickPhrase(minute, WHATS_NEXT_OPENERS),
  };
}

function clauseMatchStory(
  ctx: NarrativeMatchContext,
  minute: number,
  score: { home: number; away: number },
  story: StoryState,
  kind: "early" | "mid" | "hour" | "half_time" | "full_time",
): string {
  const stats = ctx.teamStats;
  const homeTerr = stats?.home.territoryOverallPct;
  const awayTerr = stats?.away.territoryOverallPct;
  const terrLeader =
    homeTerr != null && awayTerr != null
      ? homeTerr >= awayTerr
        ? ctx.homeName
        : ctx.awayName
      : null;

  if (kind === "early") {
    const leader =
      score.home === score.away ? null : score.home > score.away ? ctx.homeName : ctx.awayName;
    story.narrativeBeat = leader ? `${leader}_early_edge` : "even_opening";
    return leader
      ? `${leader} have started brighter and deserve their early edge after controlling the opening exchanges${
          terrLeader === leader ? " of territory and possession" : ""
        }.`
      : `An even opening. Neither side has seized the contest yet, but the patterns are beginning to emerge.`;
  }

  if (kind === "mid") {
    story.narrativeBeat = "second_quarter";
    return score.home === score.away
      ? `Through the second quarter it's still locked together — patience and discipline will decide who blinks first.`
      : `${score.home > score.away ? ctx.homeName : ctx.awayName} have the scoreboard, but the contest is far from settled.`;
  }

  if (kind === "half_time") {
    const htH = story.halfTimeHome ?? score.home;
    const htA = story.halfTimeAway ?? score.away;
    const leader = htH === htA ? null : htH > htA ? ctx.homeName : ctx.awayName;
    story.narrativeBeat = leader ? `ht_lead_${leader}` : "ht_level";
    return leader
      ? `Half-time and ${leader} deserve their advantage at ${htH}–${htA}. They've enjoyed more of the ball and the right areas of the field, but ${
          leader === ctx.homeName ? ctx.awayName : ctx.homeName
        } remain firmly in the game.`
      : `Half-time and it's all square at ${htH}–${htA}. A fascinating contest awaits after the break.`;
  }

  if (kind === "hour") {
    const lead =
      score.home === score.away ? null : score.home > score.away ? ctx.homeName : ctx.awayName;
    const trail =
      score.home === score.away ? null : score.home > score.away ? ctx.awayName : ctx.homeName;
    story.narrativeBeat = lead ? `hour_${lead}` : "hour_level";
    return trail && lead
      ? `This is finely balanced. ${
          terrLeader && terrLeader !== lead
            ? `${terrLeader} have dominated spells without the lead — `
            : ""
        }${lead} still lead ${scoreText(ctx, score.home, score.away)}, setting up a fascinating final quarter.`
      : `Still locked together. The next score could decide who seizes the final quarter.`;
  }

  // full_time
  const home = ctx.finalHomeScore ?? score.home;
  const away = ctx.finalAwayScore ?? score.away;
  const winner = home === away ? null : home > away ? ctx.homeName : ctx.awayName;
  const loser = winner === ctx.homeName ? ctx.awayName : winner === ctx.awayName ? ctx.homeName : null;
  const motm = ctx.manOfTheMatch;
  const htH = story.halfTimeHome;
  const htA = story.halfTimeAway;
  let arc = "";
  if (winner && htH != null && htA != null) {
    const htLeader = htH === htA ? null : htH > htA ? ctx.homeName : ctx.awayName;
    if (htLeader && htLeader !== winner) arc = `${winner} turned around a half-time deficit`;
    else if (htLeader === winner) arc = `${winner} held off a spirited fightback`;
    else arc = `${winner} edged a tight contest`;
  } else if (winner) {
    arc = `${winner} claimed an important victory`;
  } else {
    arc = `${ctx.homeName} and ${ctx.awayName} shared the spoils`;
  }
  const motmBit = motm
    ? ` ${motm.playerName} proved decisive${motm.reasons[0] ? ` (${motm.reasons.slice(0, 2).join(", ")})` : ""}.`
    : "";
  const fightback =
    winner && loser
      ? ` ${loser} dominated long spells without quite finding enough cutting edge.`
      : "";
  story.narrativeBeat = "full_time";
  return `FULL-TIME — ${ctx.homeName} ${home}–${away} ${ctx.awayName}. ${arc} over ${
    loser ?? "their rivals"
  } in the ${ctx.competitionName}.${motmBit}${fightback}`;
}

function blendClauses(
  minute: number,
  clauses: LayerClause[],
  personality: PersonalityMode,
  story: StoryState,
): { body: string; layers: CommentaryLayer[] } {
  const usable = clauses.filter((c) => c.text.trim().length > 0).slice(0, 4);
  const layers = usable.map((c) => c.layer);
  const opening = takeOpening(story, minute + story.personalityIndex, INSIGHT_OPENINGS);
  // Keep each layer as its own sentence — never force-lowercase (breaks names).
  const sentences = usable.map((c) => {
    const t = c.text.trim().replace(/\s+/g, " ");
    return /[.!?]$/.test(t) ? t : `${t}.`;
  });
  // Personality colour is light — soft opener OR insight opening, not both.
  const useSoft = minute % 4 === 0;
  const lead = useSoft
    ? pickPhrase(minute, PERSONALITY_OPENERS[personality])
    : opening;
  // If the lead ends with a comma, lowercase the next sentence start for flow.
  let first = sentences[0] ?? "";
  if (/,\s*$/.test(lead) && first) {
    first = first.charAt(0).toLowerCase() + first.slice(1);
  }
  const rest = sentences.slice(1);
  const body = `${minute}' — ${lead} ${[first, ...rest].join(" ")}`;
  return { body: body.replace(/\s+/g, " ").trim(), layers };
}

function buildBlendedInsight(
  ctx: NarrativeMatchContext,
  minute: number,
  score: { home: number; away: number },
  story: StoryState,
  preferred: CommentaryLayer[],
): NarrativeCommentaryLine | null {
  const personality = nextPersonality(story);
  const pool: LayerClause[] = [];

  const builders: Record<CommentaryLayer, () => LayerClause | null> = {
    live_match: () => ({
      layer: "live_match",
      text: `The scoreboard reads ${scoreText(ctx, score.home, score.away)}`,
    }),
    match_story: () => ({
      layer: "match_story",
      text:
        story.narrativeBeat === "opening"
          ? clauseMatchStory(ctx, minute, score, story, "early")
          : `The match story so far sits with ${
              score.home === score.away
                ? "neither side"
                : score.home > score.away
                  ? ctx.homeName
                  : ctx.awayName
            } as the narrative builds`,
    }),
    momentum: () => clauseMomentum(ctx, minute, score),
    tactical_analysis: () => clauseTactical(ctx, minute, story),
    player_watch: () => clausePlayerWatch(ctx, minute),
    coach_watch: () => null,
    statistical_insight: () => clauseStatistical(ctx, minute, score, story),
    defensive_analysis: () => clauseDefensive(ctx, minute, story),
    match_context: () => clauseMatchContext(ctx, minute),
    whats_next: () => clauseWhatsNext(ctx, minute, score),
  };

  for (const layer of preferred) {
    const c = builders[layer]();
    if (c) pool.push(c);
  }

  // Ensure 2–4 layers; fill from a rotating secondary set.
  const fillers: CommentaryLayer[] = [
    "momentum",
    "tactical_analysis",
    "player_watch",
    "statistical_insight",
    "defensive_analysis",
    "match_context",
    "whats_next",
    "match_story",
  ];
  for (const layer of fillers) {
    if (pool.length >= 4) break;
    if (pool.some((p) => p.layer === layer)) continue;
    const c = builders[layer]();
    if (c) pool.push(c);
  }

  if (pool.length < 2) {
    pool.push(clauseMomentum(ctx, minute, score));
    pool.push(clauseWhatsNext(ctx, minute, score));
  }

  const blended = blendClauses(minute, pool.slice(0, 4), personality, story);
  return line(
    minute,
    28,
    "journalist_insight",
    blended.body,
    3,
    blended.layers,
    personality,
  );
}

function lightBlendAfterScore(
  ctx: NarrativeMatchContext,
  minute: number,
  score: { home: number; away: number },
  story: StoryState,
): NarrativeCommentaryLine {
  const personality = nextPersonality(story);
  const mom = clauseMomentum(ctx, minute, score);
  const next = clauseWhatsNext(ctx, minute, score);
  const opening = takeOpening(story, minute + 3, INSIGHT_OPENINGS);
  const momText = /[.!?]$/.test(mom.text.trim()) ? mom.text.trim() : `${mom.text.trim()}.`;
  const nextText = /[.!?]$/.test(next.text.trim()) ? next.text.trim() : `${next.text.trim()}.`;
  const body = `${minute}' — ${opening} ${momText} ${nextText}`;
  return line(minute, 4, "momentum", body, 4, ["live_match", "momentum", "whats_next"], personality);
}

/**
 * Build in-play commentary via the Intelligence Engine
 * (kick-off onwards). Prematch stays in the outer builder.
 */
export function buildIntelligenceInPlayCommentary(
  ctx: NarrativeMatchContext,
): NarrativeCommentaryLine[] {
  const lines: NarrativeCommentaryLine[] = [];
  const running = { home: 0, away: 0 };
  const story: StoryState = {
    homeScore: 0,
    awayScore: 0,
    lastScoreMinute: -1,
    halfTimeHome: null,
    halfTimeAway: null,
    narrativeBeat: "opening",
    personalityIndex: 0,
    recentOpenings: [],
    lastStatKeys: [],
    lastInsightMinute: -99,
    lastSpotlightMinute: -99,
    lastTacticalMinute: -99,
    lastMomentumMinute: -99,
    earlyStory: false,
    midStory: false,
    hourStory: false,
  };

  let seenHalfTime = false;
  let seenFullTime = false;

  const coachLines = buildCoachWatchLines(ctx, ctx.events);

  for (const event of ctx.events) {
    const type = event.eventType.toLowerCase();
    const label = (event.label ?? "").toLowerCase();
    if (
      (/first.?half.?start|kick.?off/i.test(type) || /first.?half.?start/i.test(label)) &&
      event.minute <= 1
    ) {
      continue;
    }

    const before = { ...running };
    const play = buildLiveEventClause(ctx, event, running, story);

    if (/half.?time|first.?half.?end/i.test(`${type} ${label}`) && !seenHalfTime) {
      seenHalfTime = true;
      story.halfTimeHome = running.home;
      story.halfTimeAway = running.away;
      const htMinute = Math.max(event.minute, 40);
      const htBody = clauseMatchStory(ctx, htMinute, running, story, "half_time");
      lines.push(line(htMinute, 0, "match_story", htBody.startsWith("Half-time") ? htBody : `${htMinute}' — ${htBody}`, 5, ["match_story", "match_context"]));
      // HT multi-layer pack (not a stats dump).
      const htInsight = buildBlendedInsight(
        ctx,
        htMinute,
        running,
        story,
        ["tactical_analysis", "defensive_analysis", "statistical_insight", "whats_next"],
      );
      if (htInsight) lines.push(htInsight);
      story.lastTacticalMinute = htMinute;
      continue;
    }

    if ((/full_time|end_of_match/i.test(type) || type === "ft") && !seenFullTime) {
      seenFullTime = true;
      continue;
    }

    if (play.body) {
      lines.push(
        line(event.minute, event.second ?? 0, "play_by_play", play.body, play.priority, [
          "live_match",
        ]),
      );
    }

    const scored =
      play.scored || before.home !== running.home || before.away !== running.away;
    if (scored && event.minute - story.lastMomentumMinute >= 4) {
      lines.push(lightBlendAfterScore(ctx, event.minute, running, story));
      story.lastMomentumMinute = event.minute;
    }

    if (!story.earlyStory && event.minute >= 8 && event.minute <= 15) {
      const body = clauseMatchStory(ctx, event.minute, running, story, "early");
      lines.push(
        line(event.minute, 5, "match_story", `${event.minute}' — ${body}`, 4, [
          "match_story",
          "momentum",
        ]),
      );
      story.earlyStory = true;
    }
    if (!story.midStory && event.minute >= 22 && event.minute <= 28) {
      const body = clauseMatchStory(ctx, event.minute, running, story, "mid");
      lines.push(
        line(event.minute, 5, "match_story", `${event.minute}' — ${body}`, 4, [
          "match_story",
        ]),
      );
      story.midStory = true;
    }
    if (!story.hourStory && event.minute >= 55 && event.minute <= 65) {
      const body = clauseMatchStory(ctx, event.minute, running, story, "hour");
      lines.push(
        line(event.minute, 5, "match_story", `${event.minute}' — ${body}`, 4, [
          "match_story",
          "whats_next",
        ]),
      );
      story.hourStory = true;
    }
  }

  for (const coachLine of coachLines) {
    if (!lines.some((l) => l.minute === coachLine.minute && l.body === coachLine.body)) {
      lines.push(coachLine);
    }
  }

  if (!story.earlyStory) {
    const score = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, 10);
    const body = clauseMatchStory(ctx, 10, score, story, "early");
    lines.push(line(10, 5, "match_story", `10' — ${body}`, 4, ["match_story"]));
    story.earlyStory = true;
  }
  if (!story.midStory) {
    const score = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, 25);
    const body = clauseMatchStory(ctx, 25, score, story, "mid");
    lines.push(line(25, 5, "match_story", `25' — ${body}`, 4, ["match_story"]));
    story.midStory = true;
  }
  if (!seenHalfTime) {
    const ht = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, 40);
    story.halfTimeHome = ht.home;
    story.halfTimeAway = ht.away;
    const body = clauseMatchStory(ctx, 40, ht, story, "half_time");
    lines.push(line(40, 0, "match_story", body, 5, ["match_story"]));
    const htInsight = buildBlendedInsight(ctx, 40, ht, story, [
      "tactical_analysis",
      "defensive_analysis",
      "whats_next",
    ]);
    if (htInsight) lines.push(htInsight);
  }
  if (!story.hourStory) {
    const hour = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, 60);
    const body = clauseMatchStory(ctx, 60, hour, story, "hour");
    lines.push(line(60, 5, "match_story", `60' — ${body}`, 4, ["match_story", "whats_next"]));
  }

  const eventMax = ctx.events.reduce((m, e) => Math.max(m, e.minute), 0);
  const shouldClose =
    seenFullTime || /full_time|finished|result|complete|live/i.test(ctx.status ?? "");
  const maxMinute = Math.min(80, Math.max(eventMax, shouldClose ? 80 : eventMax));

  const busyMinutes = new Set(lines.filter((l) => l.minute >= 1).map((l) => l.minute));

  // Cadenced multi-layer insights — NOT every minute (target ~every 4').
  for (let minute = 4; minute <= maxMinute; minute += 4) {
    if (busyMinutes.has(minute)) continue;
    const score = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, minute);
    const rotate = Math.floor(minute / 4) % 3;
    const preferred: CommentaryLayer[] =
      rotate === 0
        ? ["tactical_analysis", "statistical_insight", "whats_next"]
        : rotate === 1
          ? ["momentum", "player_watch", "match_context"]
          : ["defensive_analysis", "momentum", "player_watch", "whats_next"];
    const insight = buildBlendedInsight(ctx, minute, score, story, preferred);
    if (insight) {
      lines.push(insight);
      busyMinutes.add(minute);
      story.lastInsightMinute = minute;
      if (preferred.includes("player_watch")) story.lastSpotlightMinute = minute;
    }
  }

  if (shouldClose && ctx.finalHomeScore != null && ctx.finalAwayScore != null) {
    const cleaned = lines.filter(
      (l) =>
        !(
          l.body.startsWith("FULL-TIME") ||
          l.segment === "full_time" ||
          l.segment === "full_time_summary"
        ),
    );
    lines.length = 0;
    lines.push(...cleaned);

    const finalScore = { home: ctx.finalHomeScore, away: ctx.finalAwayScore };
    const ftBody = clauseMatchStory(ctx, 80, finalScore, story, "full_time");
    lines.push(line(80, 0, "match_story", ftBody, 5, ["match_story", "live_match", "player_watch"]));

    const closing = buildBlendedInsight(ctx, 78, finalScore, story, [
      "tactical_analysis",
      "statistical_insight",
      "defensive_analysis",
      "whats_next",
    ]);
    if (closing) lines.push(closing);
  }

  // Sort chronologically for a readable feed (stable by second).
  lines.sort((a, b) => a.minute - b.minute || a.second - b.second || a.segment.localeCompare(b.segment));
  return lines;
}

/** @deprecated Prefer buildIntelligenceInPlayCommentary */
export function buildJournalistInPlayCommentary(
  ctx: NarrativeMatchContext,
): NarrativeCommentaryLine[] {
  return buildIntelligenceInPlayCommentary(ctx);
}

export function shouldPublishRawStatUpdate(): boolean {
  return false;
}
