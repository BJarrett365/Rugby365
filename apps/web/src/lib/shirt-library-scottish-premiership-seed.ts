/**
 * Scottish Premiership home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 * Note: guide graphic wrongly includes Zebre Parma — omitted here.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type ScottishPremiershipShirtSeed = {
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
  sky: "#6BB7E0",
  lightBlue: "#8EC8E8",
  maroon: "#6B1D3A",
  green: "#0B3D2E",
  lightGreen: "#2D6A4F",
  gold: "#C5A572",
  yellow: "#F5C518",
  orange: "#E85D04",
  white: "#FFFFFF",
  grey: "#6B7280",
} as const;

export const SCOTTISH_PREMIERSHIP_SHIRT_SEEDS: ScottishPremiershipShirtSeed[] = [
  {
    teamNames: ["Edinburgh Rugby", "Edinburgh"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.orange,
        collarColour: C.orange,
        cuffColour: C.orange,
        patternType: "CHEVRON",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.55 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.orange,
        collarColour: C.orange,
        cuffColour: C.orange,
        patternType: "CHEVRON",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35 },
        numberColour: C.navy,
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
        patternType: "ABSTRACT",
        patternColour: C.grey,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.35 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.sky,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "ABSTRACT",
        patternColour: C.lightBlue,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.06, opacity: 0.3 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Stirling County"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.sky,
        collarColour: C.navy,
        cuffColour: C.sky,
        patternType: "HOOPS",
        patternColour: C.sky,
        patternSettings: hoops,
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
    teamNames: ["Dundee Rugby", "Dundee"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.white,
        collarColour: C.navy,
        cuffColour: C.white,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
        numberColour: C.navy,
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
    teamNames: ["Murrayfield Wanderers"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "HOOPS",
        patternColour: C.navy,
        patternSettings: hoops,
        numberColour: C.navy,
      },
      {
        kitType: "AWAY",
        bodyColour: C.navy,
        secondaryColour: C.gold,
        collarColour: C.navy,
        cuffColour: C.gold,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.gold,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.4, width: 2, spacing: 10 },
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Hawick Linden", "Hawick"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.lightGreen,
        collarColour: C.green,
        cuffColour: C.lightGreen,
        patternType: "HOOPS",
        patternColour: C.lightGreen,
        patternSettings: hoops,
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
    teamNames: ["Boroughmuir Rugby", "Boroughmuir Bears", "Boroughmuir"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.navy,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35, width: 2, spacing: 8 },
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
    teamNames: ["Ayr Rugby", "Ayr"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.sky,
        collarColour: C.navy,
        cuffColour: C.sky,
        patternType: "HOOPS",
        patternColour: C.sky,
        patternSettings: hoops,
        numberColour: C.white,
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
    teamNames: ["Jedforest Rugby", "Jedforest", "Jed-Forest"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.white,
        patternType: "PLAIN",
        patternSettings: subtle,
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
];
