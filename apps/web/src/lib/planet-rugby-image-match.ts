/**
 * Confidence scoring for Planet Rugby player image matches.
 * Never auto-approve Low confidence.
 */

import { filenameFromImageUrl } from "./planet-rugby-image-utils";
import { namesLikelyMatch } from "./player-profile-enrichment-service";
import {
  applyLearningRulesToScore,
  builtinNegativeMatch,
  type ApprovedImageLearningRule,
} from "./player-image-rejection-learning";

export type ImageConfidenceLevel = "high" | "medium" | "low";

export type PlayerImageMatchContext = {
  playerName: string;
  aliases?: string[];
  clubName?: string | null;
  internationalTeamName?: string | null;
  previousClubs?: string[];
};

export type PlanetRugbyImageCandidateInput = {
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  credit?: string | null;
  articleTitle?: string | null;
  articleBodySnippet?: string | null;
  sourcePageUrl?: string | null;
};

export type PlanetRugbyImageMatchScore = {
  level: ImageConfidenceLevel;
  score: number;
  reasons: string[];
  nameInAltOrCaption: boolean;
  teamContextMatch: boolean;
};

function normalize(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameVariants(ctx: PlayerImageMatchContext): string[] {
  const names = [ctx.playerName, ...(ctx.aliases ?? [])]
    .map((n) => n.trim())
    .filter(Boolean);
  const out = new Set<string>();
  for (const name of names) {
    out.add(normalize(name));
    const parts = normalize(name).split(" ").filter(Boolean);
    if (parts.length >= 2) {
      out.add(`${parts[0]} ${parts.at(-1)}`);
      out.add(parts.at(-1)!);
    }
  }
  return [...out].filter((n) => n.length >= 3);
}

function textMentionsName(haystack: string, variants: string[]): boolean {
  if (!haystack) return false;
  return variants.some((variant) => {
    if (variant.split(" ").length >= 2) return haystack.includes(variant);
    // Last-name-only: require word boundary-ish (avoid matching inside other words poorly)
    return new RegExp(`(^|\\s)${variant}(\\s|$)`).test(haystack);
  });
}

function teamTokens(ctx: PlayerImageMatchContext): string[] {
  const teams = [
    ctx.clubName,
    ctx.internationalTeamName,
    ...(ctx.previousClubs ?? []),
  ]
    .map((t) => normalize(t))
    .filter(Boolean);
  const tokens = new Set<string>();
  for (const team of teams) {
    tokens.add(team);
    for (const part of team.split(" ")) {
      if (part.length >= 4) tokens.add(part);
    }
  }
  return [...tokens];
}

export function scorePlanetRugbyImageMatch(
  candidate: PlanetRugbyImageCandidateInput,
  ctx: PlayerImageMatchContext,
  options?: {
    playerId?: string | null;
    learningRules?: ApprovedImageLearningRule[];
  },
): PlanetRugbyImageMatchScore {
  const variants = nameVariants(ctx);
  const alt = normalize(candidate.altText);
  const caption = normalize(candidate.caption);
  const title = normalize(candidate.articleTitle);
  const body = normalize(candidate.articleBodySnippet);
  const credit = normalize(candidate.credit);
  const filename = normalize(filenameFromImageUrl(candidate.imageUrl).replace(/[-_]/g, " "));
  const page = normalize(candidate.sourcePageUrl);

  const nameInAlt = textMentionsName(alt, variants);
  const nameInCaption = textMentionsName(caption, variants);
  const nameInAltOrCaption = nameInAlt || nameInCaption;
  const nameInTitle = textMentionsName(title, variants);
  const nameInBody = textMentionsName(body, variants);
  const nameInFilename = textMentionsName(filename, variants);
  const nameInPage = variants.some((v) => v.includes(" ") && page.includes(v.replace(/\s+/g, "-")));

  const teams = teamTokens(ctx);
  const contextBlob = `${alt} ${caption} ${title} ${body} ${filename}`;
  const teamContextMatch = teams.some((t) => contextBlob.includes(t));

  let score = 0;
  const reasons: string[] = [];

  const builtin = builtinNegativeMatch({
    imageUrl: candidate.imageUrl,
    altText: candidate.altText,
    caption: candidate.caption,
  });
  if (builtin.matched) {
    return {
      level: "low",
      score: 0,
      reasons: builtin.reasons,
      nameInAltOrCaption,
      teamContextMatch,
    };
  }

  if (nameInAlt) {
    score += 45;
    reasons.push("Player name in alt text");
  }
  if (nameInCaption) {
    score += 40;
    reasons.push("Player name in caption");
  }
  if (nameInFilename) {
    score += 25;
    reasons.push("Player name in filename");
  }
  if (nameInTitle) {
    score += 20;
    reasons.push("Player name in article title");
  }
  if (nameInBody) {
    score += 10;
    reasons.push("Player name in article body");
  }
  if (nameInPage) {
    score += 15;
    reasons.push("Player name in page URL");
  }
  if (teamContextMatch) {
    score += 20;
    reasons.push("Team context matches");
  }
  if (credit.includes("alamy") || credit.includes("getty") || credit.includes("planet")) {
    score += 2;
  }

  // Ambiguous single-token name without team → penalise
  const fullNameHit = variants.some(
    (v) => v.includes(" ") && (alt.includes(v) || caption.includes(v) || title.includes(v) || filename.includes(v)),
  );
  if (!fullNameHit && (nameInAltOrCaption || nameInTitle || nameInFilename)) {
    score -= 15;
    reasons.push("Partial name match only — needs team context");
  }

  if (options?.learningRules?.length) {
    const learned = applyLearningRulesToScore({
      imageUrl: candidate.imageUrl,
      altText: candidate.altText,
      caption: candidate.caption,
      playerId: options.playerId,
      baseScore: score,
      rules: options.learningRules,
    });
    score = learned.score;
    reasons.push(...learned.reasons);
    if (learned.excluded) {
      return {
        level: "low",
        score: 0,
        reasons,
        nameInAltOrCaption,
        teamContextMatch,
      };
    }
  }

  let level: ImageConfidenceLevel = "low";
  if (nameInAltOrCaption && teamContextMatch && score >= 60) {
    level = "high";
  } else if ((nameInTitle || nameInBody || nameInFilename) && (teamContextMatch || nameInAltOrCaption) && score >= 40) {
    level = "medium";
  } else if (fullNameHit && score >= 50) {
    level = "medium";
  } else {
    level = "low";
  }

  // Spec: High requires name in caption/alt AND team context
  if (level === "high" && !(nameInAltOrCaption && teamContextMatch)) {
    level = "medium";
  }

  return {
    level,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    nameInAltOrCaption,
    teamContextMatch,
  };
}

export function canAutoApproveImageConfidence(level: ImageConfidenceLevel): boolean {
  return level === "high" || level === "medium";
}

/** True when candidate name is plausibly the same player (not name-alone for common surnames). */
export function candidateNameCompatible(
  candidateLabel: string,
  playerName: string,
  aliases: string[] = [],
): boolean {
  const labels = [playerName, ...aliases];
  return labels.some((label) => namesLikelyMatch(label, candidateLabel));
}
