/** True when fixture round is a playoff / knockout match (not regular season). */
export function isPlayoffRound(round: string | null | undefined): boolean {
  if (!round?.trim()) return false;
  const value = round.trim().toLowerCase();
  if (/^round\s+\d+$/i.test(round.trim())) return false;
  return /play-?off|playoff|semi-?final|quarter-?final|\bqf\b|\bsf\b|final\b|knockout|eliminator|bronze/.test(
    value,
  );
}

export function isRegularSeasonRound(round: string | null | undefined): boolean {
  if (!round?.trim()) return true;
  return !isPlayoffRound(round);
}
