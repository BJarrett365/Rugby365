/**
 * Match Alamy lightbox / search candidates to players.
 * HTML discovery usually needs an authenticated browser session; this module
 * scores and normalizes candidates extracted from that session.
 */

import {
  alamyImageIdFromUrl,
  canonicalizeAlamyImageUrl,
  isAllowedAlamyImageUrl,
} from "./alamy-image-utils";
import {
  scorePlanetRugbyImageMatch,
  type PlayerImageMatchContext,
  type PlanetRugbyImageMatchScore,
} from "./planet-rugby-image-match";

export type AlamyImageCandidate = {
  imageUrl: string;
  canonicalUrl: string;
  alamyId: string | null;
  sourcePageUrl: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  match: PlanetRugbyImageMatchScore;
};

export type RawAlamyImage = {
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  credit?: string | null;
  sourcePageUrl?: string | null;
};

function normalizeCredit(alt: string | null | undefined, credit?: string | null): string {
  if (credit?.trim()) return credit.trim();
  const blob = alt ?? "";
  const m = blob.match(/credit[:\s]+(.+)$/i);
  if (m?.[1]) return `Alamy / ${m[1].trim().slice(0, 160)}`;
  return "Alamy";
}

/** Score browser-extracted Alamy images for a player context. */
export function scoreAlamyCandidatesForPlayer(
  raw: RawAlamyImage[],
  ctx: PlayerImageMatchContext,
): AlamyImageCandidate[] {
  const out: AlamyImageCandidate[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!isAllowedAlamyImageUrl(item.imageUrl)) continue;
    const canonicalUrl = canonicalizeAlamyImageUrl(item.imageUrl);
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);

    const altText = item.altText?.trim() || null;
    const caption = item.caption?.trim() || altText;
    const match = scorePlanetRugbyImageMatch(
      {
        imageUrl: item.imageUrl,
        altText,
        caption,
        credit: item.credit ?? "Alamy",
        articleTitle: altText,
        sourcePageUrl: item.sourcePageUrl ?? null,
      },
      ctx,
    );

    // Require the player name in alt/caption — Alamy results are noisy.
    if (!match.nameInAltOrCaption) continue;
    if (match.level === "low" && match.score < 40) continue;

    out.push({
      imageUrl: item.imageUrl,
      canonicalUrl,
      alamyId: alamyImageIdFromUrl(item.imageUrl),
      sourcePageUrl: item.sourcePageUrl ?? null,
      altText,
      caption,
      credit: normalizeCredit(altText, item.credit),
      match,
    });
  }

  return out.sort((a, b) => b.match.score - a.match.score);
}

/**
 * Given a mixed lightbox dump (many players), return candidates per playerId
 * using each player's name/context.
 */
export function groupAlamyImagesByPlayer(
  raw: RawAlamyImage[],
  players: Array<{ id: string; ctx: PlayerImageMatchContext }>,
): Map<string, AlamyImageCandidate[]> {
  const byPlayer = new Map<string, AlamyImageCandidate[]>();
  for (const p of players) {
    const scored = scoreAlamyCandidatesForPlayer(raw, p.ctx);
    if (scored.length) byPlayer.set(p.id, scored);
  }
  return byPlayer;
}
