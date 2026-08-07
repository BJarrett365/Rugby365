/**
 * Knockout-draw / stage placeholders often appear as fixture "teams"
 * (e.g. "1st Pool A", "Quarter-finals", "Winners") — exclude from pickers.
 */
export function isRealCompareRosterTeamName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  const lower = n.toLowerCase();

  if (
    /^(n\/a|tbd|tba|winners|runners-?up|champions|losers|bye)$/i.test(n) ||
    /^(pool\s*stage|group\s*stage)$/i.test(n) ||
    /^(round\s+of\s+16|last\s+16|quarter-?finals?|semi-?finals?|bronze\s+final|3rd\s+place|third\s+place|final)$/i.test(
      n,
    )
  ) {
    return false;
  }

  // "1st", "2nd Pool A", "3rd Pool A/E/F", "1st Pool B Winner", etc.
  if (/^\d+(st|nd|rd|th)\b/i.test(n)) return false;
  if (/\b(pool|group)\s*[a-f0-9]/i.test(lower) && /^(winner|loser|\d)/i.test(lower)) {
    return false;
  }
  // Plain pool / group labels mistaken for teams
  if (/^(pool|group)\s*[a-f0-9]$/i.test(n)) return false;

  return true;
}
