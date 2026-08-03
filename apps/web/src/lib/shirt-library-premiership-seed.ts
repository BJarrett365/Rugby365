/**
 * English Premiership Rugby home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type PremiershipShirtSeed = {
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

/** Palette aligned to Premiership 2025/26 Official Team Colours guide. */
const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  lightBlue: "#6BB7E0",
  green: "#006B3C",
  darkGreen: "#0B3D2E",
  red: "#C8102E",
  maroon: "#5C2C2C",
  gold: "#C5A572",
  pink: "#FF4DA6",
  white: "#FFFFFF",
  grey: "#6B7280",
  cream: "#F5F0E6",
} as const;

export const PREMIERSHIP_SHIRT_SEEDS: PremiershipShirtSeed[] = [
  {
    teamNames: ["Bath Rugby", "Bath"],
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
        cuffColour: C.royal,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Bristol Bears", "Bristol"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.red,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "ABSTRACT",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.28 },
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
    teamNames: ["Exeter Chiefs", "Exeter"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Gloucester Rugby", "Gloucester"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.white,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        sidePanelColour: C.red,
        patternType: "SIDE_PANELS",
        patternColour: C.red,
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Harlequins", "Harlequin FC", "Quins"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.lightBlue,
        secondaryColour: C.maroon,
        sleeveColour: C.red,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "QUARTERS",
        patternColour: C.green,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.85 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.cream,
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
    teamNames: ["Leicester Tigers", "Leicester"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.red,
        collarColour: C.darkGreen,
        cuffColour: C.darkGreen,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.9, width: 4, spacing: 10 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["London Irish"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.white,
        collarColour: C.darkGreen,
        cuffColour: C.darkGreen,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.white,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.45, width: 2, spacing: 8 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.darkGreen,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["Newcastle Red Bulls", "Newcastle Falcons", "Newcastle"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.grey,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.grey,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.green,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Northampton Saints", "Northampton"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.green,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "HOOPS",
        patternColour: C.green,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.green,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
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
        patternType: "PLAIN",
        patternSettings: subtle,
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
    teamNames: ["Saracens"],
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
    teamNames: ["Stade Français", "Stade Francais", "Stade Français Paris"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.pink,
        secondaryColour: C.white,
        collarColour: C.pink,
        cuffColour: C.pink,
        patternType: "PLAIN",
        patternSettings: subtle,
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
    teamNames: ["Ealing Trailfinders", "Trailfinders Rugby", "Trailfinders"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.white,
        collarColour: C.darkGreen,
        cuffColour: C.darkGreen,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.06, opacity: 0.95 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.cream,
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.darkGreen,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["Wasps"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "HOOPS",
        patternColour: C.gold,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Worcester Warriors", "Worcester"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "HOOPS",
        patternColour: C.gold,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
];
