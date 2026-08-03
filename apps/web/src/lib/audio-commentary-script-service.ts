/**
 * Live Audio Commentary — Lead + Analyst broadcast rewrite.
 *
 * Written Intelligence Engine prose stays on screen.
 * Audio scripts are a separate dual-commentator rewrite — never TTS of body word-for-word.
 */

import { and, asc, eq } from "drizzle-orm";
import { audioCommentaryScripts, matchCommentary } from "@rugby365/db";
import { getDb } from "./db";
import { pickFreshPhrase, pickPhrase } from "./match-narrative-phrases";

export type AudioCombinationType =
  | "major_event"
  | "quiet_minute"
  | "player_spotlight"
  | "momentum"
  | "coaching_change"
  | "card"
  | "half_time"
  | "full_time"
  | "prematch"
  | "kick_off"
  | "set_piece"
  | "insight";

export type AudioScriptDraft = {
  minute: number;
  second: number;
  combinationType: AudioCombinationType;
  priority: number;
  layers: string[];
  lead: string;
  analyst: string;
  sideline: string;
  guest: string;
  presenterCount: number;
  sourceBody: string;
  commentaryId?: string;
  segment?: string;
};

export type StoredAudioScript = {
  id: string;
  fixtureId: string;
  commentaryId: string | null;
  minute: number;
  second: number;
  combinationType: string;
  priority: number;
  layers: unknown;
  leadScript: string;
  analystScript: string;
  sidelineScript: string;
  guestScript: string;
  presenterCount: number;
  status: string;
  sourceBody: string | null;
  facts: unknown;
};

/** Must match match-narrative-commentary-service NARRATIVE_SOURCE. */
const NARRATIVE_SOURCE = "match_narrative";

const FORBIDDEN_CLAIM =
  /\b(injur(?:y|ed|ies)|heartbroken|devastat|furious|livid|said after|told us|coach said|quotes?)\b/i;

/** Strip clock prefixes and compress whitespace for comparison / rewrite. */
export function normalizeCommentaryBody(body: string): string {
  return body
    .replace(/^\d{1,3}'\s*[—–-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyAudioCombination(
  segment: string | undefined,
  body: string,
): { type: AudioCombinationType; priority: number; layers: string[] } {
  const seg = (segment ?? "").toLowerCase();
  const text = body.toLowerCase();

  if (
    seg.includes("full_time") ||
    seg === "man_of_the_match" ||
    /\bfull[- ]?time\b|\bft\b/.test(text)
  ) {
    return {
      type: "full_time",
      priority: 10,
      layers: ["live", "match_story", "whats_next"],
    };
  }
  if (seg.includes("half_time") || /\bhalf[- ]?time\b|\bht\b/.test(text)) {
    return {
      type: "half_time",
      priority: 9,
      layers: ["live", "match_story", "momentum"],
    };
  }
  if (
    seg === "play_by_play" ||
    seg === "match_event" ||
    /\btry\b|\btries\b|\bconversion\b|\bpenalty\b|\bdrop.?goal\b/.test(text)
  ) {
    if (/\byellow card\b|\bred card\b|\bsin[- ]?bin\b/.test(text)) {
      return { type: "card", priority: 9, layers: ["live", "match_context"] };
    }
    return {
      type: "major_event",
      priority: 8,
      layers: ["live", "match_story", "momentum"],
    };
  }
  if (/\byellow card\b|\bred card\b|\bsin[- ]?bin\b/.test(text) || seg.includes("card")) {
    return { type: "card", priority: 9, layers: ["live", "match_context"] };
  }
  if (seg.includes("coach") || /\bsubstitut|\bbench|\btactical change\b/.test(text)) {
    return {
      type: "coaching_change",
      priority: 6,
      layers: ["coach_watch", "tactical", "live"],
    };
  }
  if (
    seg.includes("player") ||
    seg === "player_stats" ||
    seg === "man_of_the_match" ||
    /\bmetres\b|\btackles\b|\bcarries\b/.test(text)
  ) {
    return {
      type: "player_spotlight",
      priority: 5,
      layers: ["player_watch", "statistical", "live"],
    };
  }
  if (seg.includes("momentum") || /\bmomentum\b|\bterritory\b|\bpossession\b/.test(text)) {
    return {
      type: "momentum",
      priority: 4,
      layers: ["momentum", "tactical", "defensive"],
    };
  }
  if (seg === "kick_off") {
    return { type: "kick_off", priority: 7, layers: ["live", "match_context"] };
  }
  if (
    seg.startsWith("welcome") ||
    seg.includes("weather") ||
    seg.includes("table") ||
    seg.includes("head_to_head") ||
    seg.includes("team_announcement") ||
    seg.includes("referee") ||
    seg.includes("betting")
  ) {
    return {
      type: "prematch",
      priority: 3,
      layers: ["match_context", "whats_next"],
    };
  }
  if (seg.includes("scrum") || seg.includes("lineout") || /\bscrum\b|\blineout\b/.test(text)) {
    return { type: "set_piece", priority: 4, layers: ["tactical", "live"] };
  }
  if (seg.includes("journalist") || seg.includes("insight") || seg.includes("match_story")) {
    return {
      type: "insight",
      priority: 4,
      layers: ["match_story", "tactical", "momentum"],
    };
  }

  // Quiet / filler minutes — still story-first, not unused-stat rotation.
  return {
    type: "quiet_minute",
    priority: 2,
    layers: ["live", "momentum"],
  };
}

const LEAD_OPENERS = [
  "Right,",
  "And there it is —",
  "Listen,",
  "From here,",
  "You can feel it —",
  "Straight away,",
  "On the park,",
];

const ANALYST_OPENERS = [
  "Exactly,",
  "Look,",
  "That's the key,",
  "From the coaching box,",
  "Technically,",
  "What stands out,",
  "I'd add this —",
];

const LEAD_MAJOR = [
  "that's the scoreboard moving — biggest story of the minute.",
  "the crowd tells you how big that is.",
  "that changes the arithmetic of this contest.",
  "that's the moment the game tilts.",
];

const ANALYST_MAJOR = [
  "watch the support lines — that finish was earned, not gifted.",
  "the defence was stretched one phase too many.",
  "that's clinical finishing after the pressure spell.",
  "credit the build-up; the last pass did the damage.",
];

const LEAD_CARD = [
  "discipline bites — numbers change for ten minutes.",
  "the referee's had enough of that contest.",
  "that's a big swing in personnel.",
];

const ANALYST_CARD = [
  "expect the attacking side to go to the corners and force the scrum.",
  "shape shifts immediately — extra space out wide if they keep the ball.",
  "the pack has to stay disciplined now; another card would be ruinous.",
];

const LEAD_MOMENTUM = [
  "one side is camping in the right half of the field.",
  "the arm-wrestle is leaning — territory tells the story.",
  "pressure is stacking, even without a score yet.",
];

const ANALYST_MOMENTUM = [
  "they're winning the collisions and the exit game is under stress.",
  "if this spell continues, points are inevitable.",
  "look at the tackle count rising — fatigue becomes a factor.",
];

const LEAD_COACH = [
  "change from the bench — the coach is reshaping the midfield.",
  "fresh legs, fresh instructions.",
  "that's a statement substitution.",
];

const ANALYST_COACH = [
  "they'll be hunting a different kick-pass balance with that personnel.",
  "expect a tighter ruck focus for the next ten minutes.",
  "that's about tempo as much as fatigue.",
];

const LEAD_PLAYER = [
  "one name keeps appearing in the good work.",
  "there's your influence player in this stretch.",
  "individual class showing in a team contest.",
];

const ANALYST_PLAYER = [
  "metres after contact, plus the right decisions — that's the complete package tonight.",
  "defenders are starting to sit off him, and that opens space elsewhere.",
  "keep an eye on the next carry; the defence is marking him hard.",
];

const LEAD_PREMATCH = [
  "we're set for a proper Currie Cup scrap.",
  "the scene is ready — teams, officials, and a story to tell.",
  "pre-match threads are clear; now it's about who executes.",
];

const ANALYST_PREMATCH = [
  "the tactical battle starts at the set piece and the first exit.",
  "whichever side settles first usually writes the opening chapter.",
  "don't invent the drama — let the first twenty minutes reveal it.",
];

const LEAD_KICKOFF = [
  "we're underway.",
  "ball's live — contest starts now.",
  "kick-off, and the shape will show quickly.",
];

const ANALYST_KICKOFF = [
  "watch the first chase line; it sets the tone for territory.",
  "early exits matter more than early fireworks.",
  "both sides will want a clean first possession.",
];

const LEAD_HT = [
  "half-time — time to reset the story.",
  "that's the break; plenty still to settle.",
  "into the sheds with the narrative half-written.",
];

const ANALYST_HT = [
  "adjustments will be about exits and who wins the middle third.",
  "the coaching notes write themselves after that first half.",
  "second half needs cleaner discipline if the scoreboard's tight.",
];

const LEAD_FT = [
  "full-time — that's the result.",
  "the whistle ends it; the story is complete.",
  "done and dusted — final chapter closed.",
];

const ANALYST_FT = [
  "the decisive moments were earned, not lucky.",
  "look back at the middle third — that's where it was won.",
  "credit the winners; the losers will know exactly where it slipped.",
];

const LEAD_QUIET = [
  "a quieter spell — still a story in the territory fight.",
  "no fireworks, but the arm-wrestle continues.",
  "patience game now; both sides probing.",
];

const ANALYST_QUIET = [
  "they're not chasing unused stats — they're hunting the next mistake.",
  "keep watching the kick length; that's the subtle pressure.",
  "the next score often comes from spells like this.",
];

const LEAD_INSIGHT = [
  "the bigger picture is coming into focus.",
  "zoom out for a second — here's the match story.",
  "this is the thread running through the contest.",
];

const ANALYST_INSIGHT = [
  "tactically it's about who controls the gain line after the kick.",
  "the numbers only matter when they explain the pressure — and they do here.",
  "that's why the scoreboard looks the way it does.",
];

const LEAD_SET = [
  "set-piece platform — everything starts here.",
  "the pack wants a platform; the backs want space.",
];

const ANALYST_SET = [
  "win the ball clean and the attack has options; mess it up and you're exiting under heat.",
  "referees watch the bind and the drive — discipline wins these battles.",
];

function phrasePools(type: AudioCombinationType): {
  lead: string[];
  analyst: string[];
} {
  switch (type) {
    case "major_event":
      return { lead: LEAD_MAJOR, analyst: ANALYST_MAJOR };
    case "card":
      return { lead: LEAD_CARD, analyst: ANALYST_CARD };
    case "momentum":
      return { lead: LEAD_MOMENTUM, analyst: ANALYST_MOMENTUM };
    case "coaching_change":
      return { lead: LEAD_COACH, analyst: ANALYST_COACH };
    case "player_spotlight":
      return { lead: LEAD_PLAYER, analyst: ANALYST_PLAYER };
    case "prematch":
      return { lead: LEAD_PREMATCH, analyst: ANALYST_PREMATCH };
    case "kick_off":
      return { lead: LEAD_KICKOFF, analyst: ANALYST_KICKOFF };
    case "half_time":
      return { lead: LEAD_HT, analyst: ANALYST_HT };
    case "full_time":
      return { lead: LEAD_FT, analyst: ANALYST_FT };
    case "set_piece":
      return { lead: LEAD_SET, analyst: ANALYST_SET };
    case "insight":
      return { lead: LEAD_INSIGHT, analyst: ANALYST_INSIGHT };
    case "quiet_minute":
    default:
      return { lead: LEAD_QUIET, analyst: ANALYST_QUIET };
  }
}

/** Pull a short factual hook from prose without copying the full sentence. */
function extractStoryHook(body: string): string {
  const clean = normalizeCommentaryBody(body);
  if (!clean) return "the contest";

  // Prefer named try / score / card fragments.
  const tryMatch = clean.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b[^.]{0,40}\b(?:try|tries|crosses|finishes)\b/i,
  );
  if (tryMatch?.[1]) return `${tryMatch[1]}'s score`;

  const teamTry = clean.match(/\btry\b[^.]{0,30}\bfor\s+([A-Z][\w\s'-]{2,30})/i);
  if (teamTry?.[1]) return `the score for ${teamTry[1].trim()}`;

  const cardMatch = clean.match(
    /\b((?:yellow|red) card)\b[^.]{0,40}\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)?/i,
  );
  if (cardMatch) {
    return cardMatch[2] ? `${cardMatch[1]} for ${cardMatch[2]}` : cardMatch[1]!;
  }

  // First clause, truncated — hook only, not full prose.
  const clause = clean.split(/[.!?]/)[0]?.trim() ?? clean;
  const words = clause.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 3 ? words : "this passage of play";
}

function sanitizeBroadcastLine(line: string): string {
  let out = line.replace(/\s+/g, " ").trim();
  if (FORBIDDEN_CLAIM.test(out)) {
    out = out
      .replace(FORBIDDEN_CLAIM, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+,/g, ",")
      .trim();
  }
  // Never invent certainty about injuries/emotions.
  out = out.replace(/\bdefinitely injured\b/gi, "in a contest");
  return out;
}

function scriptsTooSimilar(script: string, sourceBody: string): boolean {
  const a = normalizeCommentaryBody(script).toLowerCase();
  const b = normalizeCommentaryBody(sourceBody).toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  // If >70% of source words appear in order as a contiguous chunk, treat as too close.
  if (b.length > 40 && a.includes(b.slice(0, Math.min(80, b.length)))) return true;
  const sourceWords = b.split(/\s+/).filter((w) => w.length > 3);
  if (sourceWords.length < 6) return a === b;
  const overlap = sourceWords.filter((w) => a.includes(w)).length;
  return overlap / sourceWords.length >= 0.85;
}

export type BuildAudioScriptsOptions = {
  /** Recent lead openings to avoid repeating. */
  recentLeadOpeners?: string[];
  recentAnalystOpeners?: string[];
};

const SIDELINE_OPENERS = [
  "From the touchline,",
  "Down here,",
  "Close to the action,",
  "I'm hearing,",
];

const GUEST_OPENERS = [
  "Quick take —",
  "I'd add,",
  "From the gallery,",
  "One more angle —",
];

const SIDELINE_BEATS = [
  "the energy on the park is unmistakable.",
  "you can feel the set-piece intensity up close.",
  "the bench is buzzing after that passage.",
];

const GUEST_BEATS = [
  "that's the clip supporters will replay.",
  "keep it clean — story first, noise second.",
  "the scoreboard pressure is doing the talking.",
];

/**
 * Allocate speaker lines for 1–4 presenters.
 * Short/quiet events may leave sideline/guest empty even when count is 3–4.
 */
export function applyPresenterCountToDraft(
  draft: AudioScriptDraft,
  presenterCount: number,
): AudioScriptDraft {
  const count = Math.min(4, Math.max(1, Math.round(presenterCount) || 2));
  const seed = draft.minute * 60 + draft.second + draft.priority * 11;
  const major =
    draft.priority >= 7 ||
    draft.combinationType === "major_event" ||
    draft.combinationType === "card" ||
    draft.combinationType === "half_time" ||
    draft.combinationType === "full_time" ||
    draft.combinationType === "kick_off";

  let lead = draft.lead;
  let analyst = draft.analyst;
  let sideline = "";
  let guest = "";

  if (count === 1) {
    // Solo: fold analyst colour into lead when useful; clear analyst.
    if (analyst.trim() && draft.priority >= 5) {
      lead = sanitizeBroadcastLine(`${lead} ${analyst}`.replace(/\s+/g, " "));
    }
    analyst = "";
  } else if (count >= 3 && major) {
    sideline = sanitizeBroadcastLine(
      `${pickPhrase(seed + 21, SIDELINE_OPENERS)} ${pickPhrase(seed + 23, SIDELINE_BEATS)}`,
    );
  }

  if (count >= 4 && (major || draft.combinationType === "insight")) {
    guest = sanitizeBroadcastLine(
      `${pickPhrase(seed + 29, GUEST_OPENERS)} ${pickPhrase(seed + 31, GUEST_BEATS)}`,
    );
  }

  return {
    ...draft,
    lead,
    analyst,
    sideline,
    guest,
    presenterCount: count,
  };
}

/**
 * Pure rewrite: one written commentary line → Lead + Analyst broadcast pair.
 * Guarantees both speakers non-empty and scripts ≠ body (for default 2-presenter).
 * Pass presenterCount to allocate 1–4 presenters.
 */
export function buildAudioScriptFromCommentaryLine(
  input: {
    minute: number;
    second?: number;
    body: string;
    segment?: string;
    commentaryId?: string;
    presenterCount?: number;
  },
  options?: BuildAudioScriptsOptions,
): AudioScriptDraft {
  const minute = Math.max(0, Math.floor(input.minute));
  const second = Math.max(0, Math.min(59, Math.floor(input.second ?? 0)));
  const body = input.body?.trim() || "The contest continues.";
  const classified = classifyAudioCombination(input.segment, body);
  const pools = phrasePools(classified.type);
  const seed = minute * 60 + second + classified.priority * 17;

  const recentLead = options?.recentLeadOpeners ?? [];
  const recentAnalyst = options?.recentAnalystOpeners ?? [];

  const leadOpener = pickFreshPhrase(seed, LEAD_OPENERS, recentLead, 8);
  const analystOpener = pickFreshPhrase(seed + 3, ANALYST_OPENERS, recentAnalyst, 8);
  const leadBeat = pickPhrase(seed + 5, pools.lead);
  const analystBeat = pickPhrase(seed + 7, pools.analyst);
  const hook = extractStoryHook(body);

  let lead = sanitizeBroadcastLine(`${leadOpener} ${hook} — ${leadBeat}`);
  let analyst = sanitizeBroadcastLine(`${analystOpener} ${analystBeat}`);

  // Ensure rewrite is not word-for-word TTS of written prose.
  if (scriptsTooSimilar(lead, body) || scriptsTooSimilar(analyst, body)) {
    lead = sanitizeBroadcastLine(
      `${leadOpener} biggest story now is ${hook}. ${pickPhrase(seed + 11, pools.lead)}`,
    );
    analyst = sanitizeBroadcastLine(
      `${analystOpener} ${pickPhrase(seed + 13, pools.analyst)} Not reading the page — calling the game.`,
    );
  }

  if (!lead.trim()) {
    lead = "Right, the contest moves on — stay with the biggest story.";
  }
  if (!analyst.trim()) {
    analyst = "Look, keep it simple: pressure, platform, points.";
  }

  const base: AudioScriptDraft = {
    minute,
    second,
    combinationType: classified.type,
    priority: classified.priority,
    layers: classified.layers,
    lead,
    analyst,
    sideline: "",
    guest: "",
    presenterCount: 2,
    sourceBody: body,
    commentaryId: input.commentaryId,
    segment: input.segment,
  };

  return applyPresenterCountToDraft(base, input.presenterCount ?? 2);
}

/** Build ordered Lead/Analyst drafts for a full published narrative feed. */
export function buildAudioScriptsForCommentaryLines(
  lines: Array<{
    id?: string;
    minute: number;
    second?: number | null;
    body: string;
    facts?: { segment?: string } | null;
    segment?: string;
  }>,
): AudioScriptDraft[] {
  const recentLead: string[] = [];
  const recentAnalyst: string[] = [];
  const drafts: AudioScriptDraft[] = [];

  // Chronological for anti-repetition (admin feed may be newest-first).
  const ordered = [...lines].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return (a.second ?? 0) - (b.second ?? 0);
  });

  for (const line of ordered) {
    const segment =
      line.segment ??
      (line.facts && typeof line.facts === "object" && "segment" in line.facts
        ? String((line.facts as { segment?: string }).segment ?? "")
        : undefined);
    const draft = buildAudioScriptFromCommentaryLine(
      {
        minute: line.minute,
        second: line.second ?? 0,
        body: line.body,
        segment,
        commentaryId: line.id,
      },
      { recentLeadOpeners: recentLead, recentAnalystOpeners: recentAnalyst },
    );
    const leadOp = draft.lead.split(/\s+/).slice(0, 2).join(" ");
    const analystOp = draft.analyst.split(/\s+/).slice(0, 2).join(" ");
    recentLead.push(leadOp);
    recentAnalyst.push(analystOp);
    drafts.push(draft);
  }

  return drafts;
}

export async function listAudioCommentaryScripts(
  fixtureId: string,
): Promise<StoredAudioScript[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.fixtureId, fixtureId))
    .orderBy(asc(audioCommentaryScripts.minute), asc(audioCommentaryScripts.second));

  return rows.map((row) => ({
    id: row.id,
    fixtureId: row.fixtureId,
    commentaryId: row.commentaryId,
    minute: row.minute,
    second: row.second,
    combinationType: row.combinationType,
    priority: row.priority,
    layers: row.layers,
    leadScript: row.leadScript,
    analystScript: row.analystScript,
    sidelineScript: row.sidelineScript ?? "",
    guestScript: row.guestScript ?? "",
    presenterCount: row.presenterCount ?? 2,
    status: row.status,
    sourceBody: row.sourceBody,
    facts: row.facts,
  }));
}

export async function generateAndStoreAudioScriptsForFixture(
  fixtureId: string,
  options?: { replace?: boolean; presenterCount?: number },
): Promise<{ created: number; scripts: StoredAudioScript[] }> {
  const db = getDb();

  let presenterCount = options?.presenterCount ?? 2;
  if (options?.presenterCount == null) {
    try {
      const { resolvePresenterCountForFixture } = await import(
        "./audio-voice-settings-service"
      );
      presenterCount = await resolvePresenterCountForFixture(fixtureId);
    } catch {
      presenterCount = 2;
    }
  }

  const commentary = await db
    .select()
    .from(matchCommentary)
    .where(
      and(
        eq(matchCommentary.fixtureId, fixtureId),
        eq(matchCommentary.source, NARRATIVE_SOURCE),
      ),
    )
    .orderBy(asc(matchCommentary.minute), asc(matchCommentary.publishedAt));

  if (options?.replace !== false) {
    await db
      .delete(audioCommentaryScripts)
      .where(eq(audioCommentaryScripts.fixtureId, fixtureId));
  }

  const drafts = buildAudioScriptsForCommentaryLines(
    commentary.map((row) => ({
      id: row.id,
      minute: row.minute,
      second: row.second,
      body: row.body,
      facts: row.facts as { segment?: string } | null,
    })),
  ).map((d) => applyPresenterCountToDraft(d, presenterCount));

  const speakers =
    presenterCount === 1
      ? ["lead"]
      : presenterCount === 3
        ? ["lead", "analyst", "sideline"]
        : presenterCount >= 4
          ? ["lead", "analyst", "sideline", "guest"]
          : ["lead", "analyst"];

  let created = 0;
  for (const draft of drafts) {
    await db.insert(audioCommentaryScripts).values({
      fixtureId,
      commentaryId: draft.commentaryId ?? null,
      minute: draft.minute,
      second: draft.second,
      combinationType: draft.combinationType,
      priority: draft.priority,
      layers: draft.layers,
      leadScript: draft.lead,
      analystScript: draft.analyst,
      sidelineScript: draft.sideline,
      guestScript: draft.guest,
      presenterCount: draft.presenterCount,
      status: "draft",
      sourceBody: draft.sourceBody,
      facts: {
        segment: draft.segment,
        combinationType: draft.combinationType,
        layers: draft.layers,
        speakers,
        presenterCount: draft.presenterCount,
        accent: "south_african_english",
      },
    });
    created += 1;
  }

  const scripts = await listAudioCommentaryScripts(fixtureId);
  return { created, scripts };
}
