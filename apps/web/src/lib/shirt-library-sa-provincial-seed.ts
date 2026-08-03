/**
 * SA National Provincial Championship guide (Rugby365) — home/away draft colours.
 * Teams are South African provincial sides; seeded against Currie Cup in CMS.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type SaProvincialShirtSeed = {
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
  sky: "#5BA3D9",
  teal: "#008080",
  green: "#006B3C",
  darkGreen: "#0B3D2E",
  red: "#C8102E",
  gold: "#C5A572",
  yellow: "#F5C518",
  pink: "#E91E8C",
  white: "#FFFFFF",
} as const;

export const SA_PROVINCIAL_SHIRT_SEEDS: SaProvincialShirtSeed[] = [
  {
    teamNames: ["Lions", "Emirates Lions", "Golden Lions"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
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
    teamNames: ["Bulls", "Blue Bulls", "Vodacom Blue Bulls", "Vodacom Bulls"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.sky,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.sky,
        collarColour: C.sky,
        cuffColour: C.sky,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Western Province", "DHL Western Province"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.white,
        collarColour: C.royal,
        cuffColour: C.royal,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
        numberColour: C.royal,
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
    teamNames: ["Griquas", "Hollywoodbets Griquas", "Griqualand West", "DHL Western Province Griquas"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.teal,
        secondaryColour: C.red,
        collarColour: C.white,
        cuffColour: C.red,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.teal,
        collarColour: C.teal,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.teal,
      },
    ],
  },
  {
    teamNames: ["Sharks", "Cell C Sharks", "Hollywoodbets Sharks"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.white,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.35, width: 2, spacing: 8 },
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
  {
    teamNames: ["Boland Cavaliers", "Boland"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.yellow,
        secondaryColour: C.black,
        collarColour: C.red,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.black,
        patternSettings: hoops,
        numberColour: C.black,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.red,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Eastern Province", "EP Elephants", "Eastern Province Elephants"],
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
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.black,
        patternType: "CHEST_BAND",
        patternColour: C.black,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.red,
      },
    ],
  },
  {
    teamNames: ["Cheetahs", "Free State Cheetahs", "Free State XV", "Toyota Cheetahs"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "SHOULDER_PANEL",
        patternColour: C.gold,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.darkGreen,
        collarColour: C.gold,
        cuffColour: C.darkGreen,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["GWK Griquas"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.black,
        patternType: "CHEST_BAND",
        patternColour: C.black,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.darkGreen,
      },
      {
        kitType: "AWAY",
        bodyColour: C.black,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.darkGreen,
        patternType: "CHEST_BAND",
        patternColour: C.darkGreen,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Pumas", "CUT Ixias", "CUT IX Pumas"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.pink,
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
        secondaryColour: C.pink,
        collarColour: C.pink,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.pink,
      },
    ],
  },
  {
    teamNames: ["North West Eagles", "NW Eagles", "Leopards XV"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
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
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["Valke", "Falcons", "Falcons Rugby"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
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
  {
    teamNames: ["Leopards"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
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
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.gold,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["Mpumalanga Pumas"],
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
    teamNames: ["New Nation Pumas"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.pink,
        collarColour: C.pink,
        cuffColour: C.pink,
        patternType: "CHEVRON",
        patternColour: C.pink,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.06, opacity: 0.85 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.pink,
        collarColour: C.pink,
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.pink,
      },
    ],
  },
];
