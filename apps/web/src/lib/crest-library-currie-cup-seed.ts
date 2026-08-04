/**
 * Currie Cup 2026 Crest Library seed — Premier + First Division.
 * Source: Rugby365 Crest Library guide (sponsor-aware titles mapped to CMS team names).
 */
import type { CrestColourSwatch, CrestVersionInput } from "./crest-library-types";

export type CurrieCupCrestSeed = {
  teamNames: string[];
  division: "Premier" | "First";
  sponsorTitle?: string;
  version: CrestVersionInput;
};

const C = {
  red: "#C8102E",
  blue: "#0057B8",
  navy: "#0A1F44",
  sky: "#5BA3D9",
  green: "#006B3C",
  darkGreen: "#0B3D2E",
  maroon: "#6B1D3A",
  pink: "#E91E8C",
  orange: "#E85D04",
  gold: "#C5A572",
  black: "#111111",
  white: "#FFFFFF",
  grey: "#6B7280",
  yellow: "#F5C518",
} as const;

function colours(...items: CrestColourSwatch[]): CrestColourSwatch[] {
  return items;
}

/** Currie Cup South Africa 2026 — Crest Library guide. */
export const CURRIE_CUP_CREST_SEEDS: CurrieCupCrestSeed[] = [
  // ── Premier Division ─────────────────────────────────────────────
  {
    teamNames: ["Boland Cavaliers", "Boland", "Sanlam Boland Kavaliers", "Kavaliers"],
    division: "Premier",
    sponsorTitle: "Sanlam Boland Kavaliers",
    version: {
      title: "Boland Cavaliers crest",
      description:
        "Black and red shield crest for the Boland Cavaliers — horse emblem with Boland wordmark.",
      aboutCrest:
        "The Boland crest uses a heraldic shield: red upper band with BOLAND in white, and a black lower field carrying a white horse. Traditional provincial colours of red, black and white.",
      primaryColour: C.red,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Red", hex: C.red },
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Bulls", "Bulls XV", "Vodacom Bulls XV", "Blue Bulls"],
    division: "Premier",
    sponsorTitle: "Vodacom Bulls XV",
    version: {
      title: "Bulls XV crest",
      description: "Modern navy bull’s-head mark used by Bulls XV in Currie Cup.",
      aboutCrest:
        "A stylised navy bull head with white accents sits above BULLS XV lettering. Colours follow the Bulls tradition of navy, blue and white.",
      primaryColour: C.navy,
      secondaryColour: C.blue,
      accentColour: C.white,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "Blue", hex: C.blue },
        { name: "White", hex: C.white },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Cheetahs", "Toyota Cheetahs", "Free State Cheetahs"],
    division: "Premier",
    sponsorTitle: "Toyota Cheetahs",
    version: {
      title: "Cheetahs crest",
      description: "Leaping orange cheetah emblem for the Toyota Cheetahs.",
      aboutCrest:
        "A sleek orange cheetah in full stride with Toyota Cheetahs wordmark. Orange and black are the Free State / Cheetahs club colours.",
      primaryColour: C.orange,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Orange", hex: C.orange },
        { name: "Black", hex: C.black },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Griquas", "Suzuki Griquas", "GWK Griquas"],
    division: "Premier",
    sponsorTitle: "Suzuki Griquas",
    version: {
      title: "Griquas crest",
      description: "Light-blue circular Griquas badge with central G monogram.",
      aboutCrest:
        "Sky blue and navy roundel with GRIQUAS and a large central G. Traditional Griqualand West colours of sky blue, navy and white.",
      primaryColour: C.sky,
      secondaryColour: C.navy,
      accentColour: C.white,
      colours: colours(
        { name: "Sky Blue", hex: C.sky },
        { name: "Navy", hex: C.navy },
        { name: "White", hex: C.white },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Lions", "Fidelity ADT Lions", "Emirates Lions"],
    division: "Premier",
    sponsorTitle: "Fidelity ADT Lions",
    version: {
      title: "Lions crest",
      description: "Profile lion’s-head crest in red, white and black.",
      aboutCrest:
        "A stylised lion head in profile with bold LIONS lettering. Johannesburg Lions colours remain red, black and white.",
      primaryColour: C.red,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Red", hex: C.red },
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Pumas", "Airlink Pumas", "Mpumalanga Pumas"],
    division: "Premier",
    sponsorTitle: "Airlink Pumas",
    version: {
      title: "Pumas crest",
      description:
        "Bright pink puma-head mark facing right above italic PUMAS wordmark on black.",
      aboutCrest:
        "Stylised magenta puma head in profile with open jaws and black facial detail, over bold italic PUMAS lettering. Club colours are pink and black — home kits also use grey shoulder panels.",
      primaryColour: C.pink,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Pink", hex: C.pink },
        { name: "Black", hex: C.black },
      ),
      officialImageUrl: "/crest-references/pumas-official.png",
      sourceName: "Pumas official crest",
      sourceUrl: "/crest-references/pumas-official.png",
    },
  },
  {
    teamNames: ["Sharks", "Sharks XV", "Hollywoodbets Sharks XV"],
    division: "Premier",
    sponsorTitle: "Hollywoodbets Sharks XV",
    version: {
      title: "Sharks crest",
      description:
        "Bold black-and-white shark mascot crest — aggressive open-mouthed shark facing right on black.",
      aboutCrest:
        "High-contrast monochrome shark graphic with open jaws, dorsal fin and white outline on a black field. Classic Sharks colours of black and white. Used for Sharks / Sharks XV Currie Cup sides.",
      primaryColour: C.black,
      secondaryColour: C.white,
      accentColour: C.grey,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
      ),
      officialImageUrl: "/crest-references/sharks-official.png",
      sourceName: "Sharks official crest",
      sourceUrl: "/crest-references/sharks-official.png",
    },
  },
  {
    teamNames: [
      "DHL Stormers XXIII",
      "Stormers",
      "Western Province",
      "DHL Western Province",
    ],
    division: "Premier",
    sponsorTitle: "DHL Stormers XXIII",
    version: {
      title: "Stormers crest",
      description:
        "Navy oval Stormers mark with a lightning S (white over red) and STORMERS wordmark across the centre.",
      aboutCrest:
        "Horizontal navy oval with a red outer ring. The central lightning-bolt S is split white (top) and red (bottom), with italic STORMERS in white across the middle. Official club colours are navy, red and white. Used for Stormers / DHL Stormers XXIII Currie Cup sides.",
      primaryColour: C.navy,
      secondaryColour: C.red,
      accentColour: C.white,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "Red", hex: C.red },
        { name: "White", hex: C.white },
      ),
      officialImageUrl: "/crest-references/stormers-official.png",
      sourceName: "Stormers official crest",
      sourceUrl: "/crest-references/stormers-official.png",
    },
  },

  // ── First Division ───────────────────────────────────────────────
  {
    teamNames: ["Border Bulldogs", "Border"],
    division: "First",
    version: {
      title: "Border Bulldogs crest",
      description: "Navy shield with white bulldog head for Border Bulldogs.",
      aboutCrest:
        "Navy shield carrying a white bulldog, with BORDER / BULLDOGS banners. Traditional colours navy and white.",
      primaryColour: C.navy,
      secondaryColour: C.white,
      accentColour: C.black,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "White", hex: C.white },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Eastern Province", "EP", "EPRU", "Eastern Province Elephants"],
    division: "First",
    version: {
      title: "Eastern Province crest",
      description: "Historic EPRU heraldic shield with castle, crown, flowers and elephant.",
      aboutCrest:
        "Four-quadrant heraldic shield topped with EPRU. Traditional Eastern Province colours of blue and gold.",
      primaryColour: C.blue,
      secondaryColour: C.gold,
      accentColour: C.white,
      colours: colours(
        { name: "Blue", hex: C.blue },
        { name: "Gold", hex: C.gold },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Griffons"],
    division: "First",
    version: {
      title: "Griffons crest",
      description: "Gold heraldic griffon standing for the Griffons.",
      aboutCrest:
        "A gold griffon rampant with GRIFFONS wordmark. Club colours gold and orange from the Free State / Northern Free State tradition.",
      primaryColour: C.gold,
      secondaryColour: C.orange,
      accentColour: C.black,
      colours: colours(
        { name: "Gold", hex: C.gold },
        { name: "Orange", hex: C.orange },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Leopards"],
    division: "First",
    version: {
      title: "Leopards crest",
      description: "Black shield with gold leopard’s head for the Leopards.",
      aboutCrest:
        "Black shield with a facing gold leopard head and leaf accents, LEOPARDS above. Colours gold and black.",
      primaryColour: C.gold,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Gold", hex: C.gold },
        { name: "Black", hex: C.black },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["SWD Eagles", "SWD", "South Western Districts"],
    division: "First",
    version: {
      title: "SWD Eagles crest",
      description: "White eagle-head mark with green and black accents.",
      aboutCrest:
        "Profile eagle head with SWD EAGLES wordmark. Traditional South Western Districts colours of black, white and green.",
      primaryColour: C.black,
      secondaryColour: C.white,
      accentColour: C.green,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
        { name: "Green", hex: C.green },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
  {
    teamNames: ["Valke", "Falcons"],
    division: "First",
    version: {
      title: "Valke crest",
      description: "Yellow oval badge with VALKE wordmark (est. 1938).",
      aboutCrest:
        "Horizontal yellow oval carrying VALKE in black capitals with founding year. Club colours yellow and black.",
      primaryColour: C.yellow,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Yellow", hex: C.yellow },
        { name: "Black", hex: C.black },
      ),
      sourceName: "Currie Cup 2026 Crest Library",
      sourceUrl: "/shirt-references/currie-cup-2026-crest-library-ref.png",
    },
  },
];
