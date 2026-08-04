/**
 * Top 14 Rugby home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type Top14ShirtSeed = {
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
  red: "#C8102E",
  maroon: "#6B1D3A",
  yellow: "#F5C518",
  pink: "#FF4DA6",
  white: "#FFFFFF",
} as const;

export const TOP14_SHIRT_SEEDS: Top14ShirtSeed[] = [
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
        patternSettings: fineStripes,
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
    teamNames: [
      "Bordeaux Begles",
      "Bordeaux Bègles",
      "Union Bordeaux-Bègles",
      "Union Bordeaux-Begles",
    ],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.maroon,
        collarColour: C.maroon,
        cuffColour: C.maroon,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.maroon,
      },
    ],
  },
  {
    teamNames: ["La Rochelle", "Stade Rochelais"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.yellow,
        collarColour: C.yellow,
        cuffColour: C.yellow,
        patternType: "HOOPS",
        patternColour: C.yellow,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.yellow,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Clermont", "Clermont Auvergne", "ASM Clermont Auvergne"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.yellow,
        collarColour: C.yellow,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: subtle,
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
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.sky,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Lyon", "LOU Rugby", "Lyon Olympique Universitaire"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
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
    teamNames: ["Montpellier", "Montpellier Hérault", "Montpellier Herault Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.royal,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "HOOPS",
        patternColour: C.royal,
        patternSettings: hoops,
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
    teamNames: ["Section Paloise", "Pau"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.white,
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
        cuffColour: C.green,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["Toulon", "RC Toulon"],
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
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Castres Olympique", "Castres"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "PLAIN",
        patternSettings: subtle,
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
    teamNames: ["USA Perpignan", "Perpignan"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.yellow,
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
        bodyColour: C.yellow,
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
    teamNames: ["Stade Francais", "Stade Français", "Stade Français Paris"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.pink,
        secondaryColour: C.white,
        collarColour: C.pink,
        cuffColour: C.pink,
        patternType: "ABSTRACT",
        patternColour: "#E91E8C",
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.28 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.pink,
        collarColour: C.pink,
        cuffColour: C.pink,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.pink,
      },
    ],
  },
  {
    teamNames: ["Bayonnais", "Bayonne", "Aviron Bayonnais"],
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
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.sky,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Vannes", "RC Vannes"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
];
