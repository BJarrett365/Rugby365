/**
 * Super Rugby Pacific home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type SuperRugbyShirtSeed = {
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

const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  sky: "#6BB7E0",
  teal: "#2EC4B6",
  green: "#006B3C",
  red: "#C8102E",
  maroon: "#6B1D3A",
  gold: "#F5C518",
  orange: "#E85D04",
  white: "#FFFFFF",
  grey: "#9CA3AF",
} as const;

export const SUPER_RUGBY_PACIFIC_SHIRT_SEEDS: SuperRugbyShirtSeed[] = [
  {
    teamNames: ["Blues"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.navy,
        collarColour: C.royal,
        cuffColour: C.navy,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.navy,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35, width: 3, spacing: 10 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.royal,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Chiefs"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.gold,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.gold,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.35 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Crusaders"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.white,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: "#9B0A20",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.28 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.red,
      },
    ],
  },
  {
    teamNames: ["Fijian Drua"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.teal,
        collarColour: C.royal,
        cuffColour: C.teal,
        sidePanelColour: C.teal,
        patternType: "SIDE_PANELS",
        patternColour: C.teal,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.teal,
        sidePanelColour: C.teal,
        patternType: "SIDE_PANELS",
        patternColour: C.teal,
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Highlanders"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.maroon,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.green,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.maroon,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Hurricanes"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.gold,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
      {
        kitType: "AWAY",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.gold,
      },
    ],
  },
  {
    teamNames: ["Moana Pasifika"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.teal,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "ABSTRACT",
        patternColour: C.navy,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.28 },
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
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Waratahs", "NSW Waratahs", "New South Wales Waratahs"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.sky,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.sky,
        collarColour: C.navy,
        cuffColour: C.sky,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Reds", "Queensland Reds", "QLD Reds"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.maroon,
        collarColour: C.maroon,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.maroon,
      },
    ],
  },
  {
    teamNames: ["Western Force", "Force"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.gold,
        collarColour: C.royal,
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
    teamNames: ["Brumbies", "ACT Brumbies"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "CHEVRON",
        patternColour: C.white,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.75 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "CHEVRON",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.55 },
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Dragons RFC"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.green,
        cuffColour: C.green,
        patternType: "ABSTRACT",
        patternColour: "#0B4D2E",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.3 },
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
    teamNames: ["Christchurch Moana"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.teal,
        collarColour: C.teal,
        cuffColour: C.navy,
        sidePanelColour: C.teal,
        patternType: "SIDE_PANELS",
        patternColour: C.teal,
        patternSettings: subtle,
        numberColour: C.navy,
      },
      {
        kitType: "AWAY",
        bodyColour: C.grey,
        secondaryColour: C.teal,
        collarColour: C.teal,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Queensland Country"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.maroon,
        collarColour: C.maroon,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.maroon,
      },
    ],
  },
];
