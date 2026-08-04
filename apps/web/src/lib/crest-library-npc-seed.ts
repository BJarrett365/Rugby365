/**
 * NZ NPC (National Provincial Championship, 2006–present) Crest Library seed.
 * Source: Rugby365 NPC Crest Library guide (12 provincial unions).
 */
import type { CrestColourSwatch, CrestVersionInput } from "./crest-library-types";

export type NpcCrestSeed = {
  teamNames: string[];
  version: CrestVersionInput;
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
  grey: "#6B7280",
} as const;

function colours(...items: CrestColourSwatch[]): CrestColourSwatch[] {
  return items;
}

const REF = "/crest-references/nz-npc-crest-library-ref.png";

/** NPC New Zealand — Crest Library guide (12 unions). */
export const NZ_NPC_CREST_SEEDS: NpcCrestSeed[] = [
  {
    teamNames: ["Northland"],
    version: {
      title: "Northland crest",
      description:
        "Shield badge split black and red with a white Māori hei-matau (fish-hook) motif.",
      aboutCrest:
        "Circular emblem in a shield outline: black left / red right field with a stylised white-and-black Māori design. Traditional Northland colours black, red and white.",
      primaryColour: C.black,
      secondaryColour: C.red,
      accentColour: C.white,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "Red", hex: C.red },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Auckland"],
    version: {
      title: "Auckland crest",
      description: "Royal blue shield with a white yacht over three white waves.",
      aboutCrest:
        "Royal blue shield bordered in white, carrying a stylised sailboat above three wavy lines for the Waitematā. Colours royal blue and white.",
      primaryColour: C.royal,
      secondaryColour: C.white,
      accentColour: C.navy,
      colours: colours(
        { name: "Royal Blue", hex: C.royal },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Waikato"],
    version: {
      title: "Waikato crest",
      description: "Ornate red-and-gold quartered W.R.U. shield with rugby, cattle and gatehouse.",
      aboutCrest:
        "Traditional heraldic shield quartered red and yellow/gold: rugby ball, cow, bull and castle/gatehouse, with W.R.U. scroll. Colours red, yellow/gold, black and white.",
      primaryColour: C.red,
      secondaryColour: C.yellow,
      accentColour: C.gold,
      colours: colours(
        { name: "Red", hex: C.red },
        { name: "Yellow", hex: C.yellow },
        { name: "Gold", hex: C.gold },
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Bay of Plenty", "BOP"],
    version: {
      title: "Bay of Plenty crest",
      description: "Navy shield with white BOP band and twin white waves at the base.",
      aboutCrest:
        "Navy blue shield with a white horizontal band carrying BOP, and two white wavy lines below for the bay. Colours navy and white.",
      primaryColour: C.navy,
      secondaryColour: C.white,
      accentColour: C.sky,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Taranaki"],
    version: {
      title: "Taranaki crest",
      description: "Black circular badge with a gold Mount Taranaki peak.",
      aboutCrest:
        "Black roundel with white outer ring and a stylised gold mountain for Mount Taranaki. Colours black, gold/yellow and white.",
      primaryColour: C.black,
      secondaryColour: C.gold,
      accentColour: C.yellow,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "Gold", hex: C.gold },
        { name: "Yellow", hex: C.yellow },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Hawke's Bay", "Hawkes Bay", "Hawke’s Bay", "Hawke's Bay Magpies"],
    version: {
      title: "Hawke's Bay crest",
      description: "Black shield with bold white HB lettering.",
      aboutCrest:
        "Simple black shield with white border and large serif HB monogram. Classic Magpies colours black and white.",
      primaryColour: C.black,
      secondaryColour: C.white,
      accentColour: C.grey,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Manawatu", "Manawatū", "Manawatu Turbos"],
    version: {
      title: "Manawatū crest",
      description: "Dark green shield with twin white Māori figures holding a rugby ball.",
      aboutCrest:
        "Dark green shield bordered white, with two stylised white figures flanking a rugby ball and RUGBY on a green banner. Colours dark green and white.",
      primaryColour: C.darkGreen,
      secondaryColour: C.white,
      accentColour: C.green,
      colours: colours(
        { name: "Dark Green", hex: C.darkGreen },
        { name: "White", hex: C.white },
        { name: "Green", hex: C.green },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Wellington", "Wellington Lions"],
    version: {
      title: "Wellington crest",
      description: "Gold quartered shield — horse, rugby ball, ship and castle — black border.",
      aboutCrest:
        "Gold heraldic shield with black border, quartered with horse’s head, rugby ball, sailing ship and castle. Wellington Lions colours gold and black.",
      primaryColour: C.gold,
      secondaryColour: C.black,
      accentColour: C.white,
      colours: colours(
        { name: "Gold", hex: C.gold },
        { name: "Black", hex: C.black },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Tasman", "Nelson", "Tasman Mako", "Tasman Makos"],
    version: {
      title: "Tasman / Nelson crest",
      description: "Royal blue shield with gold mountain peak above blue-and-white waves.",
      aboutCrest:
        "Royal blue shield with gold border: stylised gold peak over twin waves. Guide labels this Nelson; modern NPC side is Tasman. Colours royal blue, gold and white.",
      primaryColour: C.royal,
      secondaryColour: C.gold,
      accentColour: C.white,
      colours: colours(
        { name: "Royal Blue", hex: C.royal },
        { name: "Gold", hex: C.gold },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Canterbury"],
    version: {
      title: "Canterbury crest",
      description: "Black-and-red split shield with silver fern and CRFU wordmark.",
      aboutCrest:
        "Shield split vertically black (left) and red (right) with a silver fern and CRFU lettering below. Traditional Canterbury colours black, red and white.",
      primaryColour: C.black,
      secondaryColour: C.red,
      accentColour: C.white,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "Red", hex: C.red },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Otago"],
    version: {
      title: "Otago crest",
      description: "Navy circular badge with a large gold stylised O.",
      aboutCrest:
        "Navy blue roundel carrying a bold gold letter O with a horizontal bar through the centre. Colours navy and gold.",
      primaryColour: C.navy,
      secondaryColour: C.gold,
      accentColour: C.white,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "Gold", hex: C.gold },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["Southland", "Southland Stags"],
    version: {
      title: "Southland crest",
      description: "Maroon shield with gold stag’s head and RUGBY script.",
      aboutCrest:
        "Maroon shield with gold border, facing gold stag (deer) head and stylised gold RUGBY wordmark. Southland Stags colours maroon and gold.",
      primaryColour: C.maroon,
      secondaryColour: C.gold,
      accentColour: C.white,
      colours: colours(
        { name: "Maroon", hex: C.maroon },
        { name: "Gold", hex: C.gold },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
  {
    teamNames: ["North Harbour", "North Harbour Rays"],
    version: {
      title: "North Harbour crest",
      description: "North Harbour provincial rugby crest.",
      aboutCrest:
        "Official North Harbour Rugby crest used for NPC. Traditional colours sky/navy and white.",
      primaryColour: C.sky,
      secondaryColour: C.navy,
      accentColour: C.white,
      colours: colours(
        { name: "Sky Blue", hex: C.sky },
        { name: "Navy", hex: C.navy },
        { name: "White", hex: C.white },
      ),
      sourceName: "NPC Crest Library",
      sourceUrl: REF,
    },
  },
];
