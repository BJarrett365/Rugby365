import { teamCodeFromName } from "@rugby365/import-sdk";
import { chatCompletion, parseJsonObject } from "./openai-client";
import { isKnownInternationalCountryName, isAgeGradeInternationalTeamName } from "./international-team-classify";
import { isPlaceholderNationLabel } from "./nation-code-utils";

export type PlayerNationalityHint = {
  name: string;
  clubName?: string | null;
  fromClub?: string | null;
  toClub?: string | null;
  birthPlace?: string | null;
  countryName?: string | null;
  nationCode?: string | null;
};

export type PlayerNationalityResearch = {
  countryName: string;
  nationCode: string | null;
  confidence: number;
  rationale: string;
};

const SYSTEM = `You are a rugby union researcher for Planet Rugby / Rugby365.
Return JSON only: { "countryName": string|null, "confidence": number, "rationale": string }.
countryName must be the player's nationality / country of origin (England, Wales, South Africa, Ireland, …),
NOT their current club, NOT "UN", NOT an age-grade side (U20, Ireland A).
If the player is English-born, use England even if they later played for another union's A side.
If you are not reasonably sure, set countryName to null and confidence below 0.5.
Never invent a country.`;

export async function researchPlayerNationality(
  hint: PlayerNationalityHint,
): Promise<PlayerNationalityResearch | null> {
  if (
    hint.countryName &&
    !isPlaceholderNationLabel(hint.countryName) &&
    isKnownInternationalCountryName(hint.countryName) &&
    !isAgeGradeInternationalTeamName(hint.countryName)
  ) {
    return {
      countryName: hint.countryName.trim(),
      nationCode: teamCodeFromName(hint.countryName.trim()),
      confidence: 1,
      rationale: "Already stored as a valid rugby nation.",
    };
  }

  const user = [
    `Player: ${hint.name}`,
    hint.clubName ? `Current club: ${hint.clubName}` : null,
    hint.fromClub ? `From club: ${hint.fromClub}` : null,
    hint.toClub ? `To club: ${hint.toClub}` : null,
    hint.birthPlace ? `Birth place on file: ${hint.birthPlace}` : null,
    hint.countryName ? `Stored country (treat as unknown if UN): ${hint.countryName}` : null,
    hint.nationCode ? `Stored nation code: ${hint.nationCode}` : null,
    "What is this rugby player's international origin / nationality?",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await chatCompletion({
    system: SYSTEM,
    user,
    json: true,
    maxTokens: 400,
  });
  const parsed = parseJsonObject<{
    countryName?: string | null;
    confidence?: number;
    rationale?: string;
  }>(raw, {});
  const country = parsed.countryName?.trim() || null;
  const confidence = Number(parsed.confidence ?? 0);
  if (!country || confidence < 0.7) return null;
  if (isPlaceholderNationLabel(country) || isAgeGradeInternationalTeamName(country)) return null;
  if (!isKnownInternationalCountryName(country)) return null;

  return {
    countryName: country,
    nationCode: teamCodeFromName(country),
    confidence,
    rationale: parsed.rationale?.trim() || "OpenAI research",
  };
}
