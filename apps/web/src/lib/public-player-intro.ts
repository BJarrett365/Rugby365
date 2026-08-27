/**
 * Structured public player intro — facts only, no invented claims.
 */

export type PublicPlayerIntroInput = {
  name: string;
  positionName?: string | null;
  countryName?: string | null;
  clubName?: string | null;
  competitionName?: string | null;
  birthDate?: string | null;
  careerAppearances?: number | null;
  internationalCaps?: number | null;
  /** CMS override — used as-is when non-empty. */
  override?: string | null;
};

function formatBirthDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Build a short factual intro from structured fields.
 * Returns null when there is not enough data for a useful sentence.
 */
export function buildPublicPlayerIntro(input: PublicPlayerIntroInput): string | null {
  const override = input.override?.trim();
  if (override) return override;

  const name = input.name.trim();
  if (!name) return null;

  const position = input.positionName?.trim() || null;
  const nation = input.countryName?.trim() || null;
  const club = input.clubName?.trim() || null;
  const competition = input.competitionName?.trim() || null;
  const born = input.birthDate ? formatBirthDate(input.birthDate) : null;
  const apps =
    input.careerAppearances != null && input.careerAppearances > 0
      ? input.careerAppearances
      : null;
  const caps =
    input.internationalCaps != null && input.internationalCaps > 0
      ? input.internationalCaps
      : null;

  const parts: string[] = [];

  if (nation && position) {
    const article = /^[aeiou]/i.test(nation) ? "an" : "a";
    parts.push(`${name} is ${article} ${nation} international ${position}`);
  } else if (position) {
    const article = /^[aeiou]/i.test(position) ? "an" : "a";
    parts.push(`${name} is ${article} ${position}`);
  } else if (nation) {
    const article = /^[aeiou]/i.test(nation) ? "an" : "a";
    parts.push(`${name} is ${article} ${nation} rugby player`);
  } else {
    parts.push(`${name} is a rugby player`);
  }

  if (club && competition) {
    parts.push(`who plays for ${club} in ${competition}`);
  } else if (club) {
    parts.push(`who plays for ${club}`);
  }

  let sentence = parts.join(" ");
  if (!sentence.endsWith(".")) sentence += ".";

  const extras: string[] = [];
  if (born) extras.push(`Born on ${born}`);
  if (apps != null) {
    extras.push(
      extras.length
        ? `he has made ${apps} senior club ${apps === 1 ? "appearance" : "appearances"}`
        : `He has made ${apps} senior club ${apps === 1 ? "appearance" : "appearances"}`,
    );
  }
  if (caps != null) {
    const capPhrase = `${caps} international ${caps === 1 ? "cap" : "caps"}`;
    if (extras.length === 0) extras.push(`He has won ${capPhrase}`);
    else if (apps != null) extras.push(`and won ${capPhrase}`);
    else extras.push(`he has won ${capPhrase}`);
  }

  if (extras.length) {
    sentence += ` ${extras.join(", ")}.`;
  }

  return sentence;
}

/** Display helper: missing numeric stats show as "0" (confirmed zeros and unknowns). */
export function formatStatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0";
  return String(value);
}
