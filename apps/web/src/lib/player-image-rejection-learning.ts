/**
 * Extract learning proposals from editor-rejected Planet Rugby images.
 * Proposals never auto-apply — CMS approval required (engineering governance).
 */

import { filenameFromImageUrl } from "./planet-rugby-image-utils";

export type ImageLearningRuleKind =
  | "block_url_substring"
  | "block_alt_pattern"
  | "block_filename_pattern"
  | "penalty_filename_pattern";

export type ImageLearningRuleDraft = {
  kind: ImageLearningRuleKind;
  /** Lowercased match token / substring */
  pattern: string;
  /** Score penalty when kind is penalty_* (default 25) */
  penalty: number;
  scope: "global" | "player";
  rationale: string;
  ruleKey: string;
};

export type RejectedImageLearningInput = {
  playerId: string;
  playerName: string;
  imageId: string;
  imageUrl: string;
  canonicalUrl?: string | null;
  altText?: string | null;
  caption?: string | null;
  sourceArticleTitle?: string | null;
  rejectedReason?: string | null;
  status: "rejected" | "incorrect_player";
};

function normalize(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s%-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filenameStem(url: string): string {
  return filenameFromImageUrl(url).replace(/\.[a-z0-9]+$/i, "");
}

/**
 * Built-in negative filters from confirmed bad matches (promo banners, tickets).
 * These are product rules, not learned — safe to apply without CMS approval.
 */
export const BUILTIN_IMAGE_NEGATIVE_PATTERNS = {
  urlSubstrings: [
    "ticket-offer",
    "tickets-offer",
    "50-off",
    "-banner",
    "_banner",
    "player-ratings-key",
  ],
  altPatterns: [
    "ticket offer",
    "50% off",
    "50 off",
    "buy tickets",
    "get tickets",
  ],
  filenamePatterns: [
    "banner",
    "ticket",
    "player-ratings-key",
    "ratings-key",
  ],
} as const;

export function builtinNegativeMatch(candidate: {
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
}): { matched: boolean; reasons: string[] } {
  const url = candidate.imageUrl.toLowerCase();
  const alt = normalize(candidate.altText);
  const caption = normalize(candidate.caption);
  const file = normalize(filenameStem(candidate.imageUrl).replace(/[-_]/g, " "));
  const reasons: string[] = [];

  for (const part of BUILTIN_IMAGE_NEGATIVE_PATTERNS.urlSubstrings) {
    if (url.includes(part)) reasons.push(`Blocked URL pattern: ${part}`);
  }
  for (const part of BUILTIN_IMAGE_NEGATIVE_PATTERNS.altPatterns) {
    if (alt.includes(part) || caption.includes(part)) {
      reasons.push(`Blocked promo text: ${part}`);
    }
  }
  for (const part of BUILTIN_IMAGE_NEGATIVE_PATTERNS.filenamePatterns) {
    if (file.includes(part.replace(/-/g, " ")) || filenameStem(candidate.imageUrl).toLowerCase().includes(part)) {
      reasons.push(`Blocked filename pattern: ${part}`);
    }
  }

  return { matched: reasons.length > 0, reasons: [...new Set(reasons)] };
}

export function extractLearningDraftsFromRejection(
  input: RejectedImageLearningInput,
): ImageLearningRuleDraft[] {
  const drafts: ImageLearningRuleDraft[] = [];
  const url = input.canonicalUrl || input.imageUrl;
  const fileStem = filenameStem(url);
  const alt = normalize(input.altText);
  const caption = normalize(input.caption);
  const title = normalize(input.sourceArticleTitle);
  const blob = `${alt} ${caption} ${title}`;

  // Always propose blocking this exact asset globally (same promo reused across players)
  const urlKey = url.toLowerCase().replace(/^https?:\/\//, "");
  drafts.push({
    kind: "block_url_substring",
    pattern: urlKey.length > 80 ? fileStem.toLowerCase() : urlKey,
    penalty: 100,
    scope: "global",
    rationale: `Editors rejected this asset for ${input.playerName} (${input.status}).`,
    ruleKey: `block_url:${fileStem.toLowerCase()}`,
  });

  if (/banner|ticket|offer|50%|50 off|promo/i.test(fileStem) || /ticket|offer|50%|banner|promo/.test(blob)) {
    drafts.push({
      kind: "block_filename_pattern",
      pattern: fileStem.toLowerCase().replace(/[-_]/g, "-").slice(0, 60),
      penalty: 100,
      scope: "global",
      rationale: "Looks like promo / banner creative rather than a player portrait or action shot.",
      ruleKey: `block_file_promo:${fileStem.toLowerCase().slice(0, 40)}`,
    });
  }

  if (/player-ratings-key|ratings-key|split-image|montage|composite/i.test(fileStem)) {
    drafts.push({
      kind: "penalty_filename_pattern",
      pattern: fileStem.toLowerCase().replace(/[-_]+/g, "-").slice(0, 60),
      penalty: 40,
      scope: "global",
      rationale: "Generic ratings key / multi-player composite — weak identity signal.",
      ruleKey: `penalty_file:${/player-ratings-key|ratings-key/i.test(fileStem) ? "ratings-key" : "split-composite"}`,
    });
  }

  if (input.status === "incorrect_player") {
    drafts.push({
      kind: "penalty_filename_pattern",
      pattern: fileStem.toLowerCase().slice(0, 60),
      penalty: 35,
      scope: "player",
      rationale: `Marked incorrect player for ${input.playerName}.`,
      ruleKey: `penalty_player_file:${input.playerId}:${fileStem.toLowerCase().slice(0, 40)}`,
    });
  }

  // Deduplicate by ruleKey
  const byKey = new Map<string, ImageLearningRuleDraft>();
  for (const d of drafts) byKey.set(d.ruleKey, d);
  return [...byKey.values()];
}

export type ApprovedImageLearningRule = {
  kind: ImageLearningRuleKind;
  pattern: string;
  penalty: number;
  scope: "global" | "player";
  playerId?: string | null;
};

export function applyLearningRulesToScore(input: {
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  playerId?: string | null;
  baseScore: number;
  rules: ApprovedImageLearningRule[];
}): { score: number; excluded: boolean; reasons: string[] } {
  const url = input.imageUrl.toLowerCase();
  const alt = normalize(input.altText);
  const caption = normalize(input.caption);
  const file = filenameStem(input.imageUrl).toLowerCase();
  let score = input.baseScore;
  let excluded = false;
  const reasons: string[] = [];

  for (const rule of input.rules) {
    if (rule.scope === "player" && rule.playerId && rule.playerId !== input.playerId) continue;
    const pattern = rule.pattern.toLowerCase();
    let hit = false;
    if (rule.kind === "block_url_substring" || rule.kind === "block_filename_pattern") {
      hit = url.includes(pattern) || file.includes(pattern.replace(/\s+/g, "-"));
    } else if (rule.kind === "block_alt_pattern") {
      hit = alt.includes(pattern) || caption.includes(pattern);
    } else if (rule.kind === "penalty_filename_pattern") {
      hit = file.includes(pattern) || file.replace(/[-_]/g, " ").includes(pattern.replace(/[-_]/g, " "));
    }
    if (!hit) continue;

    if (rule.kind.startsWith("block_")) {
      excluded = true;
      reasons.push(`Learning rule blocked: ${rule.pattern}`);
    } else {
      score -= rule.penalty || 25;
      reasons.push(`Learning rule penalty (−${rule.penalty || 25}): ${rule.pattern}`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), excluded, reasons };
}
