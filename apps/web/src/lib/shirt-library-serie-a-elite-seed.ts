/**
 * Serie A Elite home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type SerieAEliteShirtSeed = {
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
  maroon: "#6B1D3A",
  red: "#C8102E",
  yellow: "#F5C518",
  gold: "#C5A572",
  white: "#FFFFFF",
  grey: "#6B7280",
} as const;

export const SERIE_A_ELITE_SHIRT_SEEDS: SerieAEliteShirtSeed[] = [
  {
    teamNames: ["Zebre Parma", "Zebre"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.black,
        cuffColour: C.yellow,
        patternType: "ABSTRACT",
        patternColour: C.green,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.4 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.grey,
        collarColour: C.grey,
        cuffColour: C.sky,
        patternType: "ABSTRACT",
        patternColour: C.sky,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.3 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Benetton", "Benetton Treviso", "Benetton Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "VERTICAL_STRIPES",
        patternColour: "#0B4D2E",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.45 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.green,
        collarColour: C.green,
        cuffColour: C.green,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.green,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35, width: 2, spacing: 12 },
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["Virtus Rugby", "Virtus"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.grey,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "CHEVRON",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.06, opacity: 0.45 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "CHEVRON",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Umana Reyer Rugby", "Umana Reyer", "Reyer"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
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
        secondaryColour: C.maroon,
        collarColour: C.maroon,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.maroon,
      },
    ],
  },
  {
    teamNames: ["Rugby Viadana 1970", "Viadana"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.yellow,
        collarColour: C.yellow,
        cuffColour: C.yellow,
        patternType: "GRADIENT",
        patternColour: C.yellow,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.85 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.yellow,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "VERTICAL_STRIPES",
        patternColour: "#E0B000",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Mogliano Veneto Rugby", "Mogliano"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.sky,
        collarColour: C.white,
        cuffColour: C.sky,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: "#13294B",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35 },
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
    teamNames: ["Petrarca Rugby", "Petrarca Padova", "Petrarca"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "CHEST_BAND",
        patternColour: C.white,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.grey,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "CHEST_BAND",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.9 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Lyons Piacenza"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
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
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        sidePanelColour: C.red,
        patternType: "SIDE_PANELS",
        patternColour: C.red,
        patternSettings: subtle,
        numberColour: C.red,
      },
    ],
  },
  {
    teamNames: ["Cammi Calvisano", "Calvisano", "Rugby Calvisano"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.yellow,
        collarColour: C.yellow,
        cuffColour: C.green,
        sidePanelColour: C.yellow,
        patternType: "SIDE_PANELS",
        patternColour: C.green,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: { ...subtle, cuffBands: [C.yellow, C.green] },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Femi-CZ Rovigo Delta", "Rovigo Delta", "Rugby Rovigo", "Rovigo"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.royal,
        patternType: "HOOPS",
        patternColour: C.royal,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.royal,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Colorno Rugby", "Colorno"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "HOOPS",
        patternColour: C.red,
        patternSettings: hoops,
        numberColour: C.red,
      },
      {
        kitType: "AWAY",
        bodyColour: C.navy,
        secondaryColour: C.red,
        collarColour: C.navy,
        cuffColour: C.red,
        sidePanelColour: C.red,
        patternType: "SIDE_PANELS",
        patternColour: C.white,
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Lazio Rugby 1927", "Lazio"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.sky,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        sidePanelColour: C.white,
        patternType: "SIDE_PANELS",
        patternColour: C.white,
        patternSettings: subtle,
        numberColour: C.navy,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.sky,
        sidePanelColour: C.sky,
        patternType: "SIDE_PANELS",
        patternColour: C.sky,
        patternSettings: subtle,
        numberColour: C.sky,
      },
    ],
  },
  {
    teamNames: ["Rugby Roma Olympic Club", "Rugby Roma"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
        secondaryColour: C.gold,
        collarColour: C.gold,
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
        secondaryColour: C.maroon,
        collarColour: C.maroon,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.maroon,
      },
    ],
  },
  {
    teamNames: ["Patty Lyons"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "VERTICAL_STRIPES",
        patternColour: "#0B4D2E",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35 },
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
    teamNames: ["San Donà", "San Donà Rugby", "San Dona"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.yellow,
        collarColour: C.yellow,
        cuffColour: C.yellow,
        sidePanelColour: C.yellow,
        patternType: "SIDE_PANELS",
        patternColour: C.yellow,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.yellow,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        sidePanelColour: C.navy,
        patternType: "SIDE_PANELS",
        patternColour: C.navy,
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
];
