import type { PlayerBioPacket, PlayerBioType } from "./player-bio-types";

export const PLAYER_BIO_PROMPT_VERSION = "player-bio-v1";

const SHARED_RULES = `You are Rugby365's editorial bio writer.
OpenAI is NOT the source of truth. Only use facts from the supplied verified data packet.
Never invent caps, salary, contract expiry, agent details, injury history, medical history, sprint times, release clauses, or unverified milestones.
Use the stored ratingExplanation and rating inputs exactly for rating-aware text. Do not invent rating reasons.
If rating confidence is below 0.45, state clearly that the profile is based on limited verified data.
If manualOverrideRating is present, use displayRating in public-facing text and mention calculated rating only in admin-oriented notes if needed.
Return strict JSON with keys:
shortIntro, fullBio, playingStyle, strengths, areasToImprove, careerSummary, internationalSummary, currentSeasonSummary, scoutingSummary, ratingExplanation, legendSummary.
All values must be strings. Use empty string when insufficient verified data exists.`;

export function buildBioPrompt(bioType: PlayerBioType, packet: PlayerBioPacket) {
  const typeInstructions = bioTypeInstructions(bioType, packet);
  return {
    system: `${SHARED_RULES}\n\n${typeInstructions}`,
    user: `Verified player data packet:\n${JSON.stringify(packet, null, 2)}`,
    promptVersion: PLAYER_BIO_PROMPT_VERSION,
  };
}

function bioTypeInstructions(bioType: PlayerBioType, packet: PlayerBioPacket): string {
  switch (bioType) {
    case "domestic":
      return `Write a domestic club player bio.
Include current club, position, age/DOB, height/weight, nationality, club career, current season stats, recent form, strengths, playing style, latest verified transfer, and availability only if verified.
shortIntro should be 2-3 sentences suitable for weekly refresh.`;
    case "international":
      return `Write an international player bio for ${packet.name}.
Include country, international role, club team, major tournaments only if present in packet, current form, key strengths, and career highlights from verified data only.
Do not invent cap counts or debut dates unless explicitly present in the packet.`;
    case "scouting":
      return `Write a scouting-style analysis.
Include executive summary, position fit, tactical role, physical profile, strengths, weaknesses, recent stats, development potential, risk notes, and a bottom line.
Be analytical but stay within verified data.`;
    case "weekly_intro":
      return `Write only a refreshed short intro bio for ${packet.name}.
Example style: "${packet.name} is a ${packet.nationality ?? ""} ${packet.position ?? "rugby player"} currently playing for ${packet.currentClub ?? "their club"}. ..."
Mention that the Rugby365 profile is based on verified club, match and performance data.
Populate shortIntro fully; leave other section strings empty unless clearly supported.`;
    default:
      return "Write a verified player bio.";
  }
}

export function parseBioSections(raw: Record<string, unknown>) {
  return {
    shortIntro: stringField(raw.shortIntro),
    fullBio: stringField(raw.fullBio),
    playingStyle: stringField(raw.playingStyle),
    strengths: stringField(raw.strengths),
    areasToImprove: stringField(raw.areasToImprove),
    careerSummary: stringField(raw.careerSummary),
    internationalSummary: stringField(raw.internationalSummary),
    currentSeasonSummary: stringField(raw.currentSeasonSummary),
    scoutingSummary: stringField(raw.scoutingSummary),
    ratingExplanation: stringField(raw.ratingExplanation) || undefined,
    legendSummary: stringField(raw.legendSummary),
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function inferPrimaryBioType(packet: PlayerBioPacket): PlayerBioType {
  if (packet.isInternational) return "international";
  return "domestic";
}
