/**
 * United Rugby Championship SA franchise home/away drafts.
 * Stormers use the Cape blue/white hoop kit (same family as Western Province).
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type UrcShirtSeed = {
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
const hoops: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.05,
  opacity: 0.92,
};

const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  sky: "#5BA3D9",
  red: "#C8102E",
  white: "#FFFFFF",
} as const;

export const URC_SHIRT_SEEDS: UrcShirtSeed[] = [
  {
    teamNames: ["Stormers", "DHL Stormers", "DHL Stormers XXIII", "Stormers XXIII"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.white,
        collarColour: C.red,
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
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.royal, C.red],
        },
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Bulls", "Vodacom Bulls", "Blue Bulls", "Vodacom Blue Bulls"],
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
    teamNames: ["Sharks", "Cell C Sharks", "Hollywoodbets Sharks"],
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
    teamNames: ["Lions", "Emirates Lions", "Golden Lions"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.white,
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
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.red,
      },
    ],
  },
];
