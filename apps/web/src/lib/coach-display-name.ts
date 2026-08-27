export type CoachHeroNameLines = { line1: string; line2: string };

/**
 * Two-line public hero, e.g. JOHAN "RASSIE" / ERASMUS.
 * Prefer full name + known-as; fall back to the CMS display name.
 */
export function coachHeroNameLines(input: {
  name: string;
  knownAs?: string | null;
  fullName?: string | null;
}): CoachHeroNameLines {
  const knownAs = input.knownAs?.trim();
  const fullName = input.fullName?.trim();
  if (knownAs && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const last = parts.at(-1) ?? "";
    const first = parts.slice(0, -1).join(" ");
    if (first && last) {
      const firstAlreadyQuoted = new RegExp(`["“”']${knownAs}["“”']`, "i").test(first);
      return {
        line1: (firstAlreadyQuoted ? first : `${first} "${knownAs}"`).toUpperCase(),
        line2: last.toUpperCase(),
      };
    }
  }
  const words = input.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return {
      line1: words.slice(0, -1).join(" ").toUpperCase(),
      line2: words[words.length - 1]!.toUpperCase(),
    };
  }
  return { line1: input.name.toUpperCase(), line2: "" };
}
