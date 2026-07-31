import { normalizePositionFamily } from "./player-radar-positions";

const FAMILY_ABBREV: Record<string, string> = {
  loosehead_prop: "LH",
  hooker: "HK",
  tighthead_prop: "TH",
  lock: "LO",
  blindside_flanker: "FL",
  openside_flanker: "FL",
  number_eight: "N8",
  scrum_half: "SH",
  fly_half: "FH",
  inside_centre: "CE",
  outside_centre: "CE",
  left_wing: "WT",
  right_wing: "WT",
  full_back: "FB",
  flanker: "FL",
  prop: "PR",
  centre: "CE",
  wing: "WT",
  unknown: "PL",
};

/** Two-letter position code for Player Badge (e.g. SH, FH, LO). */
export function playerPositionAbbrev(positionName: string | null | undefined): string {
  const family = normalizePositionFamily(positionName);
  if (family !== "unknown") return FAMILY_ABBREV[family] ?? "PL";
  const raw = (positionName ?? "").trim().toUpperCase();
  if (/^[A-Z0-9]{1,3}$/.test(raw)) return raw.slice(0, 3);
  const letters = raw.replace(/[^A-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2);
  return "PL";
}
