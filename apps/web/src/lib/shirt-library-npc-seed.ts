/**
 * New Zealand NPC (National Provincial Championship, 2006–present)
 * 2025 official team colours — sponsor-free Rugby365 guide.
 * Must go through Shirt Library approval before pitch use.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type NpcShirtSeed = {
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
const thinStripes: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.05,
  opacity: 0.9,
  width: 2,
  spacing: 10,
};
const chestBands: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.05,
  opacity: 0.95,
  width: 14,
  spacing: 8,
};

const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  sky: "#5BA3D9",
  green: "#006B3C",
  darkGreen: "#0B3D2E",
  red: "#C8102E",
  maroon: "#6B1D3A",
  gold: "#C5A572",
  yellow: "#F5C518",
  white: "#FFFFFF",
  grey: "#9CA3AF",
} as const;

/** NZ Hilux NPC / National Provincial Championship — 2025 Official Team Colours. */
export const NZ_NPC_SHIRT_SEEDS: NpcShirtSeed[] = [
  {
    teamNames: ["Northland"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
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
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: C.grey,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          opacity: 0.22,
          cuffBands: [C.royal, C.red],
        },
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Auckland"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.white,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "HOOPS",
        patternColour: C.white,
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
    teamNames: ["Waikato"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.yellow,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.black,
        patternSettings: {
          ...thinStripes,
          width: 6,
          spacing: 6,
          cuffBands: [C.red, C.black, C.yellow],
        },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.black,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.red, C.black, C.yellow],
        },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Bay of Plenty"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.yellow,
        collarColour: C.royal,
        cuffColour: C.yellow,
        patternType: "HOOPS",
        patternColour: C.yellow,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.royal, C.yellow],
        },
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Taranaki"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.yellow,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.black,
        patternSettings: hoops,
        numberColour: C.black,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.yellow,
        collarColour: C.black,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.yellow, C.black],
        },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Hawke's Bay", "Hawkes Bay", "Hawke’s Bay"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.red,
        collarColour: C.black,
        cuffColour: C.red,
        patternType: "HOOPS",
        patternColour: C.red,
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
        patternSettings: {
          ...subtle,
          cuffBands: [C.black, C.red],
        },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Manawatu", "Manawatū", "Manawatu Turbos"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.white,
        collarColour: C.darkGreen,
        cuffColour: C.darkGreen,
        patternType: "CHEST_BAND",
        patternColour: C.white,
        patternSettings: chestBands,
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
    teamNames: ["Wellington"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.yellow,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "HOOPS",
        patternColour: C.black,
        patternSettings: hoops,
        numberColour: C.black,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.yellow,
        collarColour: C.black,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.yellow, C.black],
        },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: ["Tasman", "Nelson", "Tasman Mako"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.yellow,
        collarColour: C.royal,
        cuffColour: C.yellow,
        patternType: "HOOPS",
        patternColour: C.yellow,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.royal, C.yellow],
        },
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Canterbury"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.black,
        collarColour: C.red,
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
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.red, C.black],
        },
        numberColour: C.red,
      },
    ],
  },
  {
    teamNames: ["Otago"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.navy,
        secondaryColour: C.yellow,
        collarColour: C.navy,
        cuffColour: C.navy,
        patternType: "CHEST_BAND",
        patternColour: C.yellow,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          opacity: 0.95,
          width: 22,
          spacing: 40,
        },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.navy, C.yellow],
        },
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Southland"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.maroon,
        secondaryColour: C.yellow,
        collarColour: C.maroon,
        cuffColour: C.yellow,
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.yellow,
        patternSettings: thinStripes,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.maroon,
        collarColour: C.maroon,
        cuffColour: C.yellow,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.maroon, C.yellow],
        },
        numberColour: C.maroon,
      },
    ],
  },
  /** Not on the 12-team 2025 colour board — traditional Steelers colours. */
  {
    teamNames: ["Counties Manukau", "Counties"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.white,
        collarColour: C.royal,
        cuffColour: C.royal,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.royal, C.white],
        },
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.royal,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.red, C.royal],
        },
        numberColour: C.red,
      },
    ],
  },
  /** Not on the 12-team 2025 colour board — traditional Harbour colours. */
  {
    teamNames: ["North Harbour"],
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
        cuffColour: C.navy,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.sky, C.navy],
        },
        numberColour: C.navy,
      },
    ],
  },
];
