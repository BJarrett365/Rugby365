/**
 * Major League Rugby home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type MlrShirtSeed = {
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
const fineStripes: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.05,
  opacity: 0.4,
  width: 2,
  spacing: 8,
};

const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  sky: "#6BB7E0",
  green: "#0B3D2E",
  neon: "#39FF14",
  red: "#C8102E",
  gold: "#C5A572",
  teal: "#008080",
  orange: "#E85D04",
  white: "#FFFFFF",
  grey: "#6B7280",
} as const;

export const MLR_SHIRT_SEEDS: MlrShirtSeed[] = [
  {
    teamNames: ["San Diego Legion"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.red,
        patternSettings: fineStripes,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.black,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["NOLA Gold"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "HOOPS",
        patternColour: C.gold,
        patternSettings: hoops,
        numberColour: C.green,
      },
      {
        kitType: "AWAY",
        bodyColour: C.green,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Anthem Rugby Carolina", "Anthem RC", "Anthem"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.sky,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "ABSTRACT",
        patternColour: C.navy,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.25 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.sky,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Rugby ATL"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.black,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Seattle Seawolves"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.neon,
        collarColour: C.navy,
        cuffColour: C.neon,
        sidePanelColour: C.neon,
        patternType: "SIDE_PANELS",
        patternColour: C.neon,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.neon,
        sidePanelColour: C.neon,
        patternType: "SIDE_PANELS",
        patternColour: C.neon,
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Toronto Arrows"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.white,
        collarColour: C.navy,
        cuffColour: C.white,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.navy,
        cuffColour: C.royal,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Utah Warriors"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.grey,
        patternType: "ABSTRACT",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.35 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.grey,
        collarColour: C.black,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.3 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Rugby United New York", "Rugby New York", "RUNY"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.sky,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.sky,
        patternSettings: fineStripes,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Miami Sharks"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.teal,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        sidePanelColour: C.white,
        patternType: "SIDE_PANELS",
        patternColour: C.white,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.teal,
        collarColour: C.teal,
        cuffColour: C.orange,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.teal,
      },
    ],
  },
  {
    teamNames: ["Houston SaberCats"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.black,
        cuffColour: C.gold,
        sidePanelColour: C.gold,
        patternType: "SIDE_PANELS",
        patternColour: C.gold,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.gold,
        collarColour: C.black,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Dallas Jackals"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.white,
        patternSettings: fineStripes,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.green,
        collarColour: C.green,
        cuffColour: C.green,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["Chicago Hounds", "Rugby Chicago"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.red,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Old Glory DC", ", Old Glory DC"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.white,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.navy,
        cuffColour: C.red,
        patternType: "SASH",
        patternColour: C.navy,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.85 },
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Colorado Raptors"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.green,
        cuffColour: C.white,
        patternType: "CHEVRON",
        patternColour: C.white,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.85 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.green,
        collarColour: C.green,
        cuffColour: C.green,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["New England Free Jacks"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.red,
        collarColour: C.navy,
        cuffColour: C.white,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.navy,
        cuffColour: C.red,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.navy,
        patternSettings: fineStripes,
        numberColour: C.navy,
      },
    ],
  },
];
