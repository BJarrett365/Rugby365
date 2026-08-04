/**
 * All-Ireland League home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type AllIrelandLeagueShirtSeed = {
  teamNames: string[];
  kits: Array<{
    kitType: ShirtKitType;
    bodyColour: string;
    secondaryColour: string;
    sleeveColour?: string;
    collarColour?: string;
    cuffColour?: string;
    sidePanelColour?: string;
    patternType: ShirtPatternType;
    patternColour?: string;
    patternSettings?: ShirtPatternSettings;
    numberColour: string;
  }>;
};

const subtle: ShirtPatternSettings = { fabricTexture: true, fabricTextureOpacity: 0.06 };
const hoops: ShirtPatternSettings = { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.92 };

const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  sky: "#6BB7E0",
  green: "#006B3C",
  red: "#C8102E",
  maroon: "#6B1D3A",
  purple: "#5B2C6F",
  gold: "#C5A572",
  amber: "#F5A623",
  white: "#FFFFFF",
} as const;

function hoopKit(
  body: string,
  stripe: string,
  number: string,
  collar?: string,
  cuff?: string,
): AllIrelandLeagueShirtSeed["kits"][number] {
  return {
    kitType: "HOME",
    bodyColour: body,
    secondaryColour: stripe,
    collarColour: collar ?? body,
    cuffColour: cuff ?? stripe,
    patternType: "HOOPS",
    patternColour: stripe,
    patternSettings: hoops,
    numberColour: number,
  };
}

function whiteAway(
  accent: string,
  number: string,
  cuff?: string,
): AllIrelandLeagueShirtSeed["kits"][number] {
  return {
    kitType: "AWAY",
    bodyColour: C.white,
    secondaryColour: accent,
    collarColour: accent,
    cuffColour: cuff ?? accent,
    patternType: "PLAIN",
    patternSettings: subtle,
    numberColour: number,
  };
}

function blackAway(
  accent: string,
): AllIrelandLeagueShirtSeed["kits"][number] {
  return {
    kitType: "AWAY",
    bodyColour: C.black,
    secondaryColour: accent,
    collarColour: accent,
    cuffColour: C.white,
    patternType: "PLAIN",
    patternSettings: subtle,
    numberColour: C.white,
  };
}

export const ALL_IRELAND_LEAGUE_SHIRT_SEEDS: AllIrelandLeagueShirtSeed[] = [
  {
    teamNames: ["Ballincollig RFC", "Ballincollig"],
    kits: [hoopKit(C.red, C.black, C.white), whiteAway(C.red, C.red, C.black)],
  },
  {
    teamNames: ["Bangor Rugby", "Bangor RFC", "Bangor"],
    kits: [hoopKit(C.royal, C.white, C.royal), whiteAway(C.royal, C.royal)],
  },
  {
    teamNames: ["Dublin University FC", "Dublin University", "Trinity"],
    kits: [hoopKit(C.navy, C.white, C.navy), whiteAway(C.navy, C.navy)],
  },
  {
    teamNames: ["Donnybrook RFC", "Donnybrook"],
    kits: [hoopKit(C.green, C.black, C.white), whiteAway(C.green, C.green, C.black)],
  },
  {
    teamNames: ["Galwegians RFC", "Galwegians"],
    kits: [hoopKit(C.maroon, C.amber, C.white), whiteAway(C.maroon, C.maroon, C.amber)],
  },
  {
    teamNames: ["Old Belvedere RFC", "Old Belvedere"],
    kits: [hoopKit(C.navy, C.white, C.navy), whiteAway(C.navy, C.navy)],
  },
  {
    teamNames: ["Rathmines RFC", "Rathmines"],
    kits: [hoopKit(C.green, C.white, C.green), whiteAway(C.green, C.green)],
  },
  {
    // Guide label — keep distinct from URC "Ulster"
    teamNames: ["Ulster Rugby Club", "Ulster Rugby AIL"],
    kits: [hoopKit(C.red, C.white, C.red), blackAway(C.red)],
  },
  {
    teamNames: ["UCD Rugby", "UCD", "University College Dublin"],
    kits: [hoopKit(C.sky, C.navy, C.navy), whiteAway(C.sky, C.navy, C.navy)],
  },
  {
    teamNames: ["U.L. Bohemian RFC", "UL Bohemian", "UL Bohemians", "Bohemian RFC"],
    kits: [hoopKit(C.red, C.black, C.white), whiteAway(C.red, C.red, C.black)],
  },
  {
    teamNames: ["Nenagh Ormond RFC", "Nenagh Ormond"],
    kits: [hoopKit(C.royal, C.navy, C.white), whiteAway(C.royal, C.royal, C.navy)],
  },
  {
    teamNames: ["City of Derry RFC", "City of Derry", "Derry"],
    kits: [hoopKit(C.red, C.white, C.red), blackAway(C.red)],
  },
  {
    teamNames: ["Tullamore RFC", "Tullamore"],
    kits: [hoopKit(C.purple, C.amber, C.white), whiteAway(C.purple, C.purple, C.amber)],
  },
  {
    teamNames: ["Cork Constitution", "Cork Con", "Constitution"],
    kits: [hoopKit(C.green, C.black, C.white), whiteAway(C.green, C.green, C.black)],
  },
];
