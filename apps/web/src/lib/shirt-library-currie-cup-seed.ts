/**
 * Currie Cup 2026 (Premier + First Division) home/away draft colours.
 * Source: Rugby365 Official Team Colours — sponsor-free guide.
 * Must go through Shirt Library approval before pitch use.
 */
import type { ShirtKitType, ShirtPatternSettings, ShirtPatternType } from "./shirt-library-types";

export type CurrieCupShirtSeed = {
  teamNames: string[];
  /** Optional team-specific reference images (in addition to the division guide). */
  references?: Array<{
    kitType?: ShirtKitType | "ALL";
    imageUrl: string;
    imageType?: "front" | "back" | "detail" | "other";
    sourceName?: string;
    notes?: string;
  }>;
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

/** Shared division guide used on every Currie Cup seed shirt. */
export const CURRIE_CUP_2026_GUIDE_REF = {
  imageUrl: "/shirt-references/currie-cup-2026-home-away-ref.png",
  imageType: "front" as const,
  sourceName: "Currie Cup South Africa 2026 Official Team Colours — Rugby365",
  notes: "Sponsor-free Premier + First Division kits for pitch overlays",
};

const subtle: ShirtPatternSettings = { fabricTexture: true, fabricTextureOpacity: 0.06 };
const hoops: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.05,
  opacity: 0.92,
};
const pinStripes: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.05,
  opacity: 0.55,
  width: 1,
  spacing: 8,
};
const geo: ShirtPatternSettings = {
  fabricTexture: true,
  fabricTextureOpacity: 0.07,
  opacity: 0.28,
};

const C = {
  black: "#111111",
  navy: "#0A1F44",
  royal: "#0057B8",
  sky: "#5BA3D9",
  teal: "#0A6B6B",
  green: "#006B3C",
  darkGreen: "#0B3D2E",
  lime: "#7CB342",
  red: "#C8102E",
  maroon: "#6B1D3A",
  gold: "#C5A572",
  yellow: "#F5C518",
  orange: "#E85D04",
  pink: "#E91E8C",
  white: "#FFFFFF",
} as const;

/** Currie Cup South Africa 2026 — Official Team Colours (Premier + First Division). */
export const CURRIE_CUP_SHIRT_SEEDS: CurrieCupShirtSeed[] = [
  // ── Premier Division ─────────────────────────────────────────────
  {
    teamNames: ["Boland Cavaliers", "Boland", "Sanlam Boland Kavaliers", "Kavaliers"],
    references: [
      {
        kitType: "ALL",
        imageUrl: "/shirt-references/currie-cup-2026-boland-cavaliers-ref.png",
        sourceName: "Boland Cavaliers 2026 kit photo — Rugby365",
        notes: "Home/away close-up for geometric texture + collar/cuff trim",
      },
    ],
    kits: [
      {
        // Dark red home with tonal geometric watermark, black collar/cuffs, white side piping
        kitType: "HOME",
        bodyColour: "#8E1B2B",
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        sidePanelColour: C.white,
        patternType: "ABSTRACT",
        patternColour: "#6E1420",
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.08,
          opacity: 0.32,
          cuffBands: [C.black, C.white, C.black],
        },
        numberColour: C.white,
      },
      {
        // White away with light geometric texture, red collar/cuffs
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "ABSTRACT",
        patternColour: "#D0D0D0",
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.06,
          opacity: 0.2,
          cuffBands: [C.red, C.white, C.red],
        },
        numberColour: C.red,
      },
    ],
  },
  {
    teamNames: [
      "Bulls",
      "Bulls XV",
      "Blue Bulls",
      "Vodacom Bulls",
      "Vodacom Bulls XV",
      "Vodacom Blue Bulls",
    ],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.royal,
        secondaryColour: C.navy,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "ABSTRACT",
        patternColour: C.navy,
        patternSettings: geo,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.royal,
        collarColour: C.royal,
        cuffColour: C.royal,
        patternType: "ABSTRACT",
        patternColour: C.sky,
        patternSettings: { ...geo, opacity: 0.18 },
        numberColour: C.royal,
      },
    ],
  },
  {
    teamNames: ["Cheetahs", "Toyota Cheetahs", "Free State Cheetahs"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.orange,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "ABSTRACT",
        patternColour: "#C44E04",
        patternSettings: geo,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.orange,
        collarColour: C.orange,
        cuffColour: C.orange,
        patternType: "PLAIN",
        patternSettings: subtle,
        numberColour: C.orange,
      },
    ],
  },
  {
    teamNames: [
      "Griquas",
      "Suzuki Griquas",
      "Hollywoodbets Griquas",
      "Griqualand West",
      "GWK Griquas",
    ],
    references: [
      {
        kitType: "HOME",
        imageUrl: "/shirt-references/currie-cup-2026-griquas-home-ref.png",
        sourceName: "Griquas 2026 home kit photo — Rugby365",
        notes: "Thick blue/white hoops (match-worn)",
      },
      {
        kitType: "AWAY",
        imageUrl: "/shirt-references/currie-cup-2026-griquas-away-ref.png",
        sourceName: "Griquas 2026 away kit photo — Rugby365",
        notes: "Medium blue with thin white horizontal stripes",
      },
    ],
    kits: [
      {
        // Azure with thick white hoops (match kit photo)
        kitType: "HOME",
        bodyColour: "#3AA0D8",
        secondaryColour: C.white,
        collarColour: "#3AA0D8",
        cuffColour: "#3AA0D8",
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.06,
          opacity: 0.95,
          width: 14,
          spacing: 14,
        },
        numberColour: C.white,
      },
      {
        // Same blue family with thin white pin-stripes (match kit photo)
        kitType: "AWAY",
        bodyColour: "#2B8FC9",
        secondaryColour: C.white,
        collarColour: "#2B8FC9",
        cuffColour: "#2B8FC9",
        patternType: "HORIZONTAL_STRIPES",
        patternColour: C.white,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          opacity: 0.9,
          width: 2,
          spacing: 12,
        },
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Lions", "Fidelity ADT Lions", "Emirates Lions", "Golden Lions"],
    references: [
      {
        kitType: "HOME",
        imageUrl: "/shirt-references/currie-cup-2026-lions-away-ref.png",
        sourceName: "Lions 2026 home kit photo — Rugby365",
        notes: "White body with bold red chest band (Currie Cup home)",
      },
    ],
    kits: [
      {
        // White home with bold red chest stripe (match kit photo / Currie Cup)
        kitType: "HOME",
        bodyColour: C.white,
        secondaryColour: C.red,
        collarColour: C.red,
        cuffColour: C.red,
        patternType: "CHEST_BAND",
        patternColour: C.red,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          opacity: 0.98,
          width: 22,
          spacing: 40,
          cuffBands: [C.red],
        },
        numberColour: C.red,
      },
      {
        // Red away with dark geometric texture
        kitType: "AWAY",
        bodyColour: C.red,
        secondaryColour: C.black,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "ABSTRACT",
        patternColour: C.black,
        patternSettings: geo,
        numberColour: C.white,
      },
    ],
  },
  {
    teamNames: ["Pumas", "Airlink Pumas", "Mpumalanga Pumas", "New Nation Pumas"],
    references: [
      {
        kitType: "HOME",
        imageUrl: "/shirt-references/currie-cup-2026-pumas-home-ref.png",
        sourceName: "Pumas 2026 home kit photo — Rugby365",
        notes: "Hot pink body with slate grey sleeves",
      },
      {
        kitType: "AWAY",
        imageUrl: "/shirt-references/currie-cup-2026-pumas-away-ref.png",
        sourceName: "Pumas 2026 away kit photo — Rugby365",
        notes: "Black body with neon pink collar",
      },
      {
        kitType: "THIRD",
        imageUrl: "/shirt-references/currie-cup-2026-pumas-third-ref.png",
        sourceName: "Pumas 2026 third kit photo — Rugby365",
        notes: "White torso with neon pink sleeves/shoulder yoke, black numbering",
      },
    ],
    kits: [
      {
        // Hot pink body with grey shoulders/sleeves (match kit photo)
        kitType: "HOME",
        bodyColour: "#E91E8C",
        secondaryColour: "#5A5A5A",
        sleeveColour: "#5A5A5A",
        collarColour: "#2A2A2A",
        cuffColour: "#5A5A5A",
        sidePanelColour: C.black,
        patternType: "SHOULDER_PANEL",
        patternColour: "#5A5A5A",
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        // Black body with pink collar/cuff accents (match kit photo)
        kitType: "AWAY",
        bodyColour: C.black,
        secondaryColour: C.pink,
        sleeveColour: C.black,
        collarColour: C.pink,
        cuffColour: C.pink,
        patternType: "ABSTRACT",
        patternColour: "#2A2A2A",
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.08,
          opacity: 0.35,
          cuffBands: [C.pink],
        },
        numberColour: C.pink,
      },
      {
        // White torso, neon pink sleeves + shoulder yoke, black numbers (third kit photo)
        kitType: "THIRD",
        bodyColour: C.white,
        secondaryColour: C.pink,
        sleeveColour: C.pink,
        collarColour: C.pink,
        cuffColour: C.black,
        sidePanelColour: C.black,
        patternType: "SHOULDER_PANEL",
        patternColour: C.pink,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          opacity: 0.98,
          cuffBands: [C.black],
        },
        numberColour: C.black,
      },
    ],
  },
  {
    teamNames: [
      "Sharks",
      "Sharks XV",
      "Hollywoodbets Sharks",
      "Hollywoodbets Sharks XV",
      "Cell C Sharks",
    ],
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
        // White away with blue + red cuff accents (2026 guide)
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
  /** Same Cape blue/white hoops — Stormers XXIII Currie Cup side. */
  {
    teamNames: ["Stormers", "DHL Stormers", "DHL Stormers XXIII", "Stormers XXIII"],
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

  // ── First Division ───────────────────────────────────────────────
  {
    teamNames: ["Border Bulldogs", "Border", "Bulldogs"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.green,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "HOOPS",
        patternColour: C.white,
        patternSettings: hoops,
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
        patternSettings: pinStripes,
        numberColour: C.green,
      },
    ],
  },
  {
    teamNames: ["Eastern Province", "EP Elephants", "Eastern Province Elephants"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.red,
        secondaryColour: C.navy,
        collarColour: C.red,
        cuffColour: C.navy,
        patternType: "HOOPS",
        patternColour: C.navy,
        patternSettings: hoops,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.navy,
        collarColour: C.navy,
        cuffColour: C.red,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.navy, C.red],
        },
        numberColour: C.navy,
      },
    ],
  },
  {
    teamNames: ["Griffons", "Toyota Griffons", "Free State Griffons"],
    kits: [
      {
        // Gold/yellow with black + white accents (2026 guide)
        kitType: "HOME",
        bodyColour: C.yellow,
        secondaryColour: C.black,
        collarColour: C.black,
        cuffColour: C.black,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.black, C.white, C.black],
        },
        numberColour: C.black,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.yellow,
        collarColour: C.yellow,
        cuffColour: C.black,
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
    teamNames: ["Leopards", "NWU Leopards"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.lime,
        collarColour: C.white,
        cuffColour: C.white,
        sidePanelColour: C.lime,
        patternType: "SHOULDER_PANEL",
        patternColour: C.lime,
        patternSettings: subtle,
        numberColour: C.white,
      },
      {
        kitType: "AWAY",
        bodyColour: C.white,
        secondaryColour: C.darkGreen,
        collarColour: C.darkGreen,
        cuffColour: C.lime,
        patternType: "PLAIN",
        patternSettings: {
          ...subtle,
          cuffBands: [C.darkGreen, C.lime],
        },
        numberColour: C.darkGreen,
      },
    ],
  },
  {
    teamNames: ["SWD Eagles", "SWD", "North West Eagles", "NW Eagles", "Eagles"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.darkGreen,
        secondaryColour: C.white,
        collarColour: C.white,
        cuffColour: C.white,
        patternType: "CHEST_BAND",
        patternColour: C.white,
        patternSettings: {
          fabricTexture: true,
          fabricTextureOpacity: 0.05,
          opacity: 0.95,
          width: 16,
          spacing: 8,
        },
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
    teamNames: ["Valke", "Falcons"],
    kits: [
      {
        kitType: "HOME",
        bodyColour: C.black,
        secondaryColour: C.gold,
        collarColour: C.gold,
        cuffColour: C.gold,
        sidePanelColour: C.gold,
        patternType: "SHOULDER_PANEL",
        patternColour: C.gold,
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
        patternSettings: {
          ...subtle,
          cuffBands: [C.black, C.gold],
        },
        numberColour: C.black,
      },
    ],
  },
];
