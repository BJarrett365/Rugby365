/**
 * Super Rygbi Cymru home/away draft colours from Rugby365 shirt guide.
 * Sponsor-free simplified kits — must go through Shirt Library approval.
 * Note: guide graphic wrongly includes Bath Rugby — omitted here.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type SuperRygbiCymruShirtSeed = {
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
  emerald: "#049F6B",
  red: "#C8102E",
  scarlet: "#E10600",
  gold: "#C5A572",
  amber: "#F5A623",
  yellow: "#F5C518",
  purple: "#5B2C6F",
  white: "#FFFFFF",
} as const;

export const SUPER_RYGBI_CYMRU_SHIRT_SEEDS: SuperRygbiCymruShirtSeed[] = [
  {
    teamNames: ["Dragons RFC", "Dragons", "Newport Gwent Dragons"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.black,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.amber,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.35 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.amber,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.25 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Cardiff Rugby", "Cardiff Blues", "Cardiff RFC"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.sky,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "CHEST_BAND",
        patternColour: C.sky,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.85 },
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
    teamNames: ["Ospreys"],
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
  {
    teamNames: ["Scarlets"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.scarlet,
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
        secondaryColour: C.scarlet,
        collarColour: C.scarlet,
        cuffColour: C.scarlet,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.scarlet,
      },
    ],
  },
  {
    teamNames: ["Newport Rugby", "Newport RFC", "Newport"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "HOOPS",
        patternColour: C.gold,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.55, width: 3, spacing: 10 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.amber,
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
    teamNames: ["Rhondda Rugby", "Rhondda"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
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
        secondaryColour: C.green,
        collarColour: C.green,
        cuffColour: C.black,
        patternType: "CHEST_BAND",
        patternColour: C.black,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.9 },
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["Swansea Rugby", "Swansea"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.sky,
        collarColour: C.navy,
        cuffColour: C.sky,
        patternType: "CHEST_BAND",
        patternColour: C.sky,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.9 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.sky,
        patternType: "CHEST_BAND",
        patternColour: C.navy,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.9 },
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Eirias Rugby", "Eirias"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.gold,
        cuffColour: C.gold,
        patternType: "HOOPS",
        patternColour: C.red,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.black,
        cuffColour: C.gold,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.05, opacity: 0.95 },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Aberystwyth Rugby", "Aberystwyth"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.emerald,
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
        secondaryColour: C.emerald,
        collarColour: C.emerald,
        cuffColour: C.emerald,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.emerald,
      },
    ],
  },
  {
    teamNames: ["Bridgend Ravens", "Bridgend"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.purple,
        collarColour: C.purple,
        cuffColour: C.purple,
        patternType: "ABSTRACT",
        patternColour: C.purple,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07, opacity: 0.3 },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.purple,
        collarColour: C.purple,
        cuffColour: C.purple,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.purple,
      },
    ],
  },
  {
    teamNames: ["Merthyr Rugby", "Merthyr"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
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
];
