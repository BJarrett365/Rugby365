/**
 * English Premiership Crest Library seed.
 * Descriptions are starter copy — replace official images as provided.
 */
import type { CrestColourSwatch, CrestVersionInput } from "./crest-library-types";

export type PremiershipCrestSeed = {
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
  orange: "#E85D04",
  pink: "#E91E8C",
  white: "#FFFFFF",
  grey: "#6B7280",
  lightBlue: "#7EC8E3",
} as const;

function colours(...items: CrestColourSwatch[]): CrestColourSwatch[] {
  return items;
}

/** Current Premiership clubs (+ recent aliases). */
export const PREMIERSHIP_CREST_SEEDS: PremiershipCrestSeed[] = [
  {
    teamNames: ["Bath Rugby", "Bath"],
    version: {
      title: "Bath crest",
      description: "Bath Rugby club crest in traditional blue and white.",
      aboutCrest: "Official Bath Rugby mark used in Premiership. Colours blue and white.",
      primaryColour: C.royal,
      secondaryColour: C.white,
      accentColour: C.black,
      colours: colours(
        { name: "Blue", hex: C.royal },
        { name: "White", hex: C.white },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
  {
    teamNames: ["Bristol Bears", "Bristol", "Bristol Rugby"],
    version: {
      title: "Bristol Bears crest",
      description:
        "Navy square mark with a stylised white bear head in negative-space outline.",
      aboutCrest:
        "Minimalist front-facing bear head on dark navy with thick white outlines. Official Bristol Bears colours navy and white.",
      primaryColour: C.navy,
      secondaryColour: C.white,
      accentColour: C.grey,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "White", hex: C.white },
      ),
      officialImageUrl: "/crest-references/bristol-bears-official.png",
      sourceName: "Bristol Bears official crest",
      sourceUrl: "/crest-references/bristol-bears-official.png",
    },
  },
  {
    teamNames: ["Exeter Chiefs", "Exeter"],
    version: {
      title: "Exeter Chiefs crest",
      description: "Exeter Chiefs club crest in black and gold.",
      aboutCrest: "Official Exeter Chiefs mark used in Premiership. Colours black and gold.",
      primaryColour: C.black,
      secondaryColour: C.gold,
      accentColour: C.white,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "Gold", hex: C.gold },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
  {
    teamNames: ["Gloucester Rugby", "Gloucester"],
    version: {
      title: "Gloucester crest",
      description: "Gloucester Rugby club crest in cherry and white.",
      aboutCrest: "Official Gloucester Rugby mark used in Premiership. Colours cherry red and white.",
      primaryColour: C.red,
      secondaryColour: C.white,
      accentColour: C.black,
      colours: colours(
        { name: "Cherry", hex: C.red },
        { name: "White", hex: C.white },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
  {
    teamNames: ["Harlequins", "Harlequin FC", "Quins"],
    version: {
      title: "Harlequins crest",
      description: "Harlequins club crest in the famous multi-colour quartered palette.",
      aboutCrest:
        "Official Harlequins mark used in Premiership. Traditional quartered colours including light blue, magenta, chocolate and green.",
      primaryColour: C.lightBlue,
      secondaryColour: C.pink,
      accentColour: C.black,
      colours: colours(
        { name: "Light Blue", hex: C.lightBlue },
        { name: "Magenta", hex: C.pink },
        { name: "Black", hex: C.black },
        { name: "White", hex: C.white },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
  {
    teamNames: ["Leicester Tigers", "Leicester"],
    version: {
      title: "Leicester Tigers crest",
      description: "Leicester Tigers club crest in green, red and white.",
      aboutCrest: "Official Leicester Tigers mark used in Premiership. Colours green, red and white.",
      primaryColour: C.green,
      secondaryColour: C.red,
      accentColour: C.white,
      colours: colours(
        { name: "Green", hex: C.green },
        { name: "Red", hex: C.red },
        { name: "White", hex: C.white },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
  {
    teamNames: ["Newcastle Red Bulls", "Newcastle Falcons", "Newcastle"],
    version: {
      title: "Newcastle Red Bulls crest",
      description:
        "Navy shield crest with arched NEWCASTLE, Red Bull twin-bull mark, yellow star and Red Bull wordmark.",
      aboutCrest:
        "Shield badge on navy with Red Bull branding. Colours navy, blue, red, yellow and white.",
      primaryColour: C.navy,
      secondaryColour: C.red,
      accentColour: C.yellow,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "Blue", hex: C.royal },
        { name: "Red", hex: C.red },
        { name: "Yellow", hex: C.yellow },
        { name: "White", hex: C.white },
      ),
      officialImageUrl: "/crest-references/newcastle-red-bulls-official.png",
      sourceName: "Newcastle Red Bulls official crest",
      sourceUrl: "/crest-references/newcastle-red-bulls-official.png",
    },
  },
  {
    teamNames: ["Northampton Saints", "Northampton"],
    version: {
      title: "Northampton Saints crest",
      description: "Northampton Saints club crest in green, black and gold.",
      aboutCrest: "Official Northampton Saints mark used in Premiership. Colours green, black and gold.",
      primaryColour: C.green,
      secondaryColour: C.black,
      accentColour: C.gold,
      colours: colours(
        { name: "Green", hex: C.green },
        { name: "Black", hex: C.black },
        { name: "Gold", hex: C.gold },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
  {
    teamNames: ["Sale Sharks", "Sale", "Sale FC"],
    version: {
      title: "Sale Sharks crest",
      description:
        "Navy SALE SHARKS wordmark above a stylised angular shark, dorsal fin cutting into the A.",
      aboutCrest:
        "Modern navy-and-white mark with sharp serif lettering over an aggressive shark graphic.",
      primaryColour: C.navy,
      secondaryColour: C.white,
      accentColour: C.black,
      colours: colours(
        { name: "Navy", hex: C.navy },
        { name: "White", hex: C.white },
      ),
      officialImageUrl: "/crest-references/sale-sharks-official.png",
      sourceName: "Sale Sharks official crest",
      sourceUrl: "/crest-references/sale-sharks-official.png",
    },
  },
  {
    teamNames: ["Saracens"],
    version: {
      title: "Saracens crest",
      description: "Saracens club crest in black and red.",
      aboutCrest: "Official Saracens mark used in Premiership. Colours black and red.",
      primaryColour: C.black,
      secondaryColour: C.red,
      accentColour: C.white,
      colours: colours(
        { name: "Black", hex: C.black },
        { name: "Red", hex: C.red },
      ),
      sourceName: "Premiership Crest Library",
    },
  },
];
