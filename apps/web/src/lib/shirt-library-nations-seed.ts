/**
 * Initial draft colour guide for Nations Championship teams.
 * Must go through Shirt Library approval before public pitch use.
 */
import type {
  ShirtKitType,
  ShirtPatternSettings,
  ShirtPatternType,
} from "./shirt-library-types";

export type NationsShirtSeed = {
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

export const NATIONS_CHAMPIONSHIP_SHIRT_SEEDS: NationsShirtSeed[] = [
  {
    teamNames: ["South Africa", "South Africa (Springboks)", "Springboks"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#006B3C",
        secondaryColour: "#FFB81C",
        collarColour: "#FFB81C",
        cuffColour: "#FFB81C",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#006B3C",
        collarColour: "#006B3C",
        cuffColour: "#FFB81C",
        sidePanelColour: "#006B3C",
        patternType: "SIDE_PANELS",
        patternColour: "#FFB81C",
        numberColour: "#006B3C",
      },
    ],
  },
  {
    teamNames: ["New Zealand", "New Zealand (All Blacks)", "All Blacks"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#111111",
        secondaryColour: "#FFFFFF",
        collarColour: "#111111",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#111111",
        collarColour: "#111111",
        patternType: "PLAIN",
        numberColour: "#111111",
      },
    ],
  },
  {
    teamNames: ["Australia", "Australia (Wallabies)", "Wallabies"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#FFB81C",
        secondaryColour: "#006B3C",
        collarColour: "#006B3C",
        cuffColour: "#006B3C",
        patternType: "PLAIN",
        numberColour: "#006B3C",
      },
      {
        kitType: "AWAY",
        bodyColour: "#006B3C",
        secondaryColour: "#FFB81C",
        collarColour: "#FFB81C",
        patternType: "PLAIN",
        numberColour: "#FFB81C",
      },
    ],
  },
  {
    teamNames: ["Argentina", "Argentina (Los Pumas)", "Los Pumas"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#75AADB",
        secondaryColour: "#FFFFFF",
        patternType: "HOOPS",
        patternColour: "#FFFFFF",
        numberColour: "#00205B",
      },
      {
        kitType: "AWAY",
        bodyColour: "#00205B",
        secondaryColour: "#FFFFFF",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
    ],
  },
  {
    teamNames: ["Japan", "Japan (Brave Blossoms)", "Brave Blossoms"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#FFFFFF",
        secondaryColour: "#BC002D",
        patternType: "HOOPS",
        patternColour: "#BC002D",
        numberColour: "#BC002D",
      },
      {
        kitType: "AWAY",
        bodyColour: "#00205B",
        secondaryColour: "#FFFFFF",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
    ],
  },
  {
    teamNames: ["England"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#FFFFFF",
        secondaryColour: "#00205B",
        collarColour: "#CF081F",
        patternType: "PLAIN",
        numberColour: "#00205B",
      },
      {
        kitType: "AWAY",
        bodyColour: "#00205B",
        secondaryColour: "#FFFFFF",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
    ],
  },
  {
    teamNames: ["Ireland"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#169B62",
        secondaryColour: "#FFFFFF",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#169B62",
        collarColour: "#169B62",
        patternType: "PLAIN",
        numberColour: "#169B62",
      },
    ],
  },
  {
    teamNames: ["Scotland"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#00205B",
        secondaryColour: "#C8102E",
        collarColour: "#C8102E",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#B8A1C9",
        secondaryColour: "#00205B",
        patternType: "PLAIN",
        numberColour: "#00205B",
      },
    ],
  },
  {
    teamNames: ["Wales"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#C8102E",
        secondaryColour: "#FFFFFF",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#C8102E",
        collarColour: "#C8102E",
        patternType: "PLAIN",
        numberColour: "#C8102E",
      },
    ],
  },
  {
    teamNames: ["Italy"],
    kits: [
      {
        // Solid royal blue home (reference product shot) — subtle fabric only, no loud pattern.
        kitType: "HOME",
        bodyColour: "#00328A",
        secondaryColour: "#FFFFFF",
        sleeveColour: "#00328A",
        collarColour: "#00328A",
        cuffColour: "#002878",
        patternType: "PLAIN",
        patternColour: undefined,
        patternSettings: { fabricTexture: true, fabricTextureOpacity: 0.07 },
        numberColour: "#FFFFFF",
      },
      {
        // White away with Italian flag cuff bands (green / white / red) — no sponsors.
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#00328A",
        sleeveColour: "#FFFFFF",
        collarColour: "#FFFFFF",
        cuffColour: "#FFFFFF",
        patternType: "PLAIN",
        patternColour: undefined,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          cuffBands: ["#008C45", "#FFFFFF", "#CD212A"],
        },
        numberColour: "#00328A",
      },
    ],
  },
  {
    teamNames: ["France"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#002395",
        secondaryColour: "#FFFFFF",
        collarColour: "#ED2939",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#002395",
        patternType: "PLAIN",
        numberColour: "#002395",
      },
    ],
  },
  {
    teamNames: ["Fiji"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#FFFFFF",
        secondaryColour: "#111111",
        collarColour: "#111111",
        cuffColour: "#111111",
        patternType: "PLAIN",
        numberColour: "#111111",
      },
      {
        kitType: "AWAY",
        bodyColour: "#111111",
        secondaryColour: "#FFFFFF",
        patternType: "PLAIN",
        numberColour: "#FFFFFF",
      },
    ],
  },
];
