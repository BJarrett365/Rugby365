/**
 * European Rugby Champions Cup home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type ChampionsCupShirtSeed = {
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
const fine: ShirtPatternSettings = {
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
  red: "#C8102E",
  maroon: "#6B1D3A",
  purple: "#7B6BA8",
  gold: "#C5A572",
  yellow: "#E8FF3D",
  white: "#FFFFFF",
  grey: "#6B7280",
} as const;

export const CHAMPIONS_CUP_SHIRT_SEEDS: ChampionsCupShirtSeed[] = [
  {
    teamNames: ["Stade Toulousain", "Toulouse"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.red,
        patternSettings: fine,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.grey,
        patternType: "ABSTRACT",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.28 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Leinster", "Leinster Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        sidePanelColour: C.navy,
        patternType: "SIDE_PANELS",
        patternColour: C.navy,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["La Rochelle", "Stade Rochelais"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "ABSTRACT",
        patternColour: C.gold,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.3 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Northampton Saints", "Northampton"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.black,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.green,
        collarColour: C.green,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["Saracens"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.28 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Exeter Chiefs", "Exeter"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.grey,
        collarColour: C.black,
        cuffColour: C.grey,
        patternType: "ABSTRACT",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.35 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.purple,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Ulster", "Ulster Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.red,
      },
      {
        kitType: "AWAY",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.grey,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.grey,
        patternSettings: fine,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Glasgow Warriors"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.sky,
        sidePanelColour: C.sky,
        patternType: "SIDE_PANELS",
        patternColour: C.sky,
        patternSettings: subtle,
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
    teamNames: ["Bath", "Bath Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.white,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Munster", "Munster Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.maroon,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.maroon,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.28 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.navy,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.white,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Racing 92", "Racing Metro"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.sky,
        secondaryColour: C.white,
        collarColour: C.sky,
        cuffColour: C.sky,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
        numberColour: C.navy,
      },
      {
        kitType: "AWAY",
        bodyColour: C.navy,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.sky,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Sale Sharks", "Sale"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "SHOULDER_PANEL",
        patternColour: C.grey,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.yellow,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
];
