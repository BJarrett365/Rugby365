/** Deterministic accent colour from a team name when kit colours are unavailable. */
export function teamAccentColor(name: string, side: "home" | "away"): string {
  const paletteHome = ["#c62828", "#1565c0", "#2e7d32", "#6a1b9a", "#e65100", "#00838f", "#ad1457"];
  const paletteAway = ["#43a047", "#0277bd", "#ef6c00", "#5e35b1", "#00897b", "#c62828", "#546e7a"];
  const palette = side === "home" ? paletteHome : paletteAway;
  let hash = 0;
  const key = name.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length]!;
}
