/**
 * Autumn Nations Series / Cup — sponsor-free home/away draft colours.
 * Starting points for Shirt Library review (not auto-approved).
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type AutumnNationsShirtSeed = {
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

export const AUTUMN_NATIONS_SHIRT_SEEDS: AutumnNationsShirtSeed[] = [
  {
    teamNames: ["Canada"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#C8102E",
        secondaryColour: "#FFFFFF",
        collarColour: "#FFFFFF",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#C8102E",
        collarColour: "#C8102E",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#C8102E",
      },
    ],
  },
  {
    teamNames: ["Chile", "Los Cóndores"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#D52B1E",
        secondaryColour: "#0039A6",
        collarColour: "#0039A6",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#D52B1E",
        collarColour: "#0039A6",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#0039A6",
      },
    ],
  },
  {
    teamNames: ["Georgia", "The Lelos"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#E4002B",
        secondaryColour: "#FFFFFF",
        collarColour: "#FFFFFF",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#E4002B",
        collarColour: "#E4002B",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#E4002B",
      },
    ],
  },
  {
    teamNames: ["Hong Kong", "Hong Kong China"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#DE2910",
        secondaryColour: "#FFFFFF",
        collarColour: "#FFFFFF",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#DE2910",
        collarColour: "#DE2910",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#DE2910",
      },
    ],
  },
  {
    teamNames: ["Portugal", "Os Lobos"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#046A38",
        secondaryColour: "#DA291C",
        collarColour: "#DA291C",
        cuffColour: "#DA291C",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#046A38",
        collarColour: "#046A38",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#046A38",
      },
    ],
  },
  {
    teamNames: ["Romania", "The Oaks"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#002B7F",
        secondaryColour: "#FCD116",
        collarColour: "#CE1126",
        cuffColour: "#FCD116",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FCD116",
        secondaryColour: "#002B7F",
        collarColour: "#002B7F",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#002B7F",
      },
    ],
  },
  {
    teamNames: ["Samoa", "Manu Samoa"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#002B7F",
        secondaryColour: "#CE1126",
        collarColour: "#CE1126",
        cuffColour: "#FFFFFF",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#002B7F",
        collarColour: "#002B7F",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#002B7F",
      },
    ],
  },
  {
    teamNames: ["Spain", "Los Leones"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#C60B1E",
        secondaryColour: "#FFC400",
        collarColour: "#FFC400",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#C60B1E",
        collarColour: "#C60B1E",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#C60B1E",
      },
    ],
  },
  {
    teamNames: ["Tonga", "ʻIkale Tahi", "Ikale Tahi"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#C8102E",
        secondaryColour: "#FFFFFF",
        collarColour: "#FFFFFF",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#C8102E",
        collarColour: "#C8102E",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#C8102E",
      },
    ],
  },
  {
    teamNames: ["United States", "USA", "USA Eagles", "Eagles"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#002868",
        secondaryColour: "#BF0A30",
        collarColour: "#BF0A30",
        cuffColour: "#FFFFFF",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#002868",
        collarColour: "#002868",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#002868",
      },
    ],
  },
  {
    teamNames: ["Uruguay", "Los Teros"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#0038A8",
        secondaryColour: "#FFFFFF",
        collarColour: "#FFFFFF",
        patternType: "HOOPS",
        patternColour: "#FFFFFF",
        patternSettings: { ...subtle, opacity: 0.9 },
        numberColour: "#0038A8",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#0038A8",
        collarColour: "#0038A8",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#0038A8",
      },
    ],
  },
  {
    teamNames: ["Zimbabwe", "Sables"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: "#006B3F",
        secondaryColour: "#FFD200",
        collarColour: "#FFD200",
        cuffColour: "#CE1126",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#FFFFFF",
      },
      {
        kitType: "AWAY",
        bodyColour: "#FFFFFF",
        secondaryColour: "#006B3F",
        collarColour: "#006B3F",
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: "#006B3F",
      },
    ],
  },
];
