/**
 * Canonical XV position families for radar cohorts (never mix all players).
 */

export type RadarPositionFamily =
  | "loosehead_prop"
  | "hooker"
  | "tighthead_prop"
  | "lock"
  | "blindside_flanker"
  | "openside_flanker"
  | "number_eight"
  | "scrum_half"
  | "fly_half"
  | "inside_centre"
  | "outside_centre"
  | "left_wing"
  | "right_wing"
  | "full_back"
  | "flanker"
  | "prop"
  | "centre"
  | "wing"
  | "unknown";

export const RADAR_POSITION_LABELS: Record<RadarPositionFamily, string> = {
  loosehead_prop: "Loosehead Props",
  hooker: "Hookers",
  tighthead_prop: "Tighthead Props",
  lock: "Locks",
  blindside_flanker: "Blindside Flankers",
  openside_flanker: "Openside Flankers",
  number_eight: "Number Eights",
  scrum_half: "Scrum-halves",
  fly_half: "Fly-halves",
  inside_centre: "Inside Centres",
  outside_centre: "Outside Centres",
  left_wing: "Left Wings",
  right_wing: "Right Wings",
  full_back: "Full-backs",
  flanker: "Flankers",
  prop: "Props",
  centre: "Centres",
  wing: "Wings",
  unknown: "Players",
};

export function normalizePositionFamily(
  positionName: string | null | undefined,
): RadarPositionFamily {
  const n = (positionName ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!n) return "unknown";
  if (n.includes("loosehead") || n === "1" || n === "lh") return "loosehead_prop";
  if (n.includes("tighthead") || n === "3" || n === "th") return "tighthead_prop";
  if (n.includes("hooker") || n === "2" || n === "hk") return "hooker";
  if (n.includes("blindside") || n === "6") return "blindside_flanker";
  if (n.includes("openside") || n === "7") return "openside_flanker";
  if (
    n.includes("number eight") ||
    n.includes("number 8") ||
    n === "8" ||
    n.includes("no. 8") ||
    n === "eighth"
  ) {
    return "number_eight";
  }
  if (n.includes("scrum") || n === "9" || n.includes("halfback")) return "scrum_half";
  if (n.includes("fly") || n.includes("out half") || n.includes("outhalf") || n === "10") {
    return "fly_half";
  }
  if (n.includes("inside centre") || n.includes("inside center") || n === "12") {
    return "inside_centre";
  }
  if (n.includes("outside centre") || n.includes("outside center") || n === "13") {
    return "outside_centre";
  }
  if (n.includes("left wing") || n === "11") return "left_wing";
  if (n.includes("right wing") || n === "14") return "right_wing";
  if (n.includes("full") || n === "15") return "full_back";
  if (n.includes("lock") || n.includes("second row") || n === "4" || n === "5") return "lock";
  if (n.includes("flanker")) return "flanker";
  if (n.includes("prop")) return "prop";
  if (n.includes("centre") || n.includes("center")) return "centre";
  if (n.includes("wing")) return "wing";
  return "unknown";
}

/** Cohort matching: exact family, with fallbacks (e.g. openside → flanker). */
export function positionCohortFamilies(family: RadarPositionFamily): RadarPositionFamily[] {
  switch (family) {
    case "loosehead_prop":
    case "tighthead_prop":
      return [family, "prop"];
    case "blindside_flanker":
    case "openside_flanker":
      return [family, "flanker"];
    case "inside_centre":
    case "outside_centre":
      return [family, "centre"];
    case "left_wing":
    case "right_wing":
      return [family, "wing"];
    default:
      return [family];
  }
}
