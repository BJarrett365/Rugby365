/**
 * Phrase libraries for Rugby365 Commentary Intelligence Engine.
 * Openings, layer styles, personalities — used for variety + anti-repeat rules.
 */

export function pickPhrase(seed: number, phrases: string[]): string {
  if (!phrases.length) return "";
  const idx = Math.abs(Math.floor(seed)) % phrases.length;
  return phrases[idx]!;
}

/** Prefer a phrase that is not in the recent-openings window. */
export function pickFreshPhrase(
  seed: number,
  phrases: string[],
  recent: string[],
  windowSize = 10,
): string {
  if (!phrases.length) return "";
  const blocked = new Set(recent.slice(-windowSize).map((p) => p.toLowerCase()));
  const fresh = phrases.filter((p) => !blocked.has(p.toLowerCase()));
  const pool = fresh.length ? fresh : phrases;
  return pickPhrase(seed, pool);
}

export type PersonalityMode =
  | "television"
  | "match_reporter"
  | "tactical_analyst"
  | "former_player"
  | "data_journalist"
  | "story_teller";

export const PERSONALITY_ROTATION: PersonalityMode[] = [
  "match_reporter",
  "television",
  "tactical_analyst",
  "former_player",
  "data_journalist",
  "story_teller",
];

export const PERSONALITY_LABEL: Record<PersonalityMode, string> = {
  television: "Television Commentary",
  match_reporter: "Match Reporter",
  tactical_analyst: "Tactical Analyst",
  former_player: "Former Player",
  data_journalist: "Data Journalist",
  story_teller: "Story Teller",
};

/** Soft voice prefixes — used lightly, not as labels in the feed. */
export const PERSONALITY_OPENERS: Record<PersonalityMode, string[]> = {
  television: [
    "Right,",
    "And here,",
    "Listen,",
    "From here,",
    "You can see it —",
  ],
  match_reporter: [
    "From the press box,",
    "On the evidence so far,",
    "The story of this match:",
    "Looking at the pattern,",
    "As things stand,",
  ],
  tactical_analyst: [
    "Tactically,",
    "Structurally,",
    "In shape terms,",
    "From a kicking viewpoint,",
    "At the breakdown,",
  ],
  former_player: [
    "From experience,",
    "Players will tell you,",
    "Out there,",
    "In the contact area,",
    "When you've been there,",
  ],
  data_journalist: [
    "The numbers back it up —",
    "Dig into the picture and",
    "Strip away the noise and",
    "What the data suggests:",
    "The underlying story:",
  ],
  story_teller: [
    "The plot thickens —",
    "Chapter by chapter,",
    "This contest is writing itself:",
    "And so the afternoon unfolds —",
    "There's a narrative forming:",
  ],
};

export type LiveStyle = "tv" | "journalist" | "excited" | "calm" | "storytelling";

export const LIVE_STYLES: LiveStyle[] = ["tv", "journalist", "excited", "calm", "storytelling"];

export const TRY_BUILDERS = [
  "after building the pressure through several phases",
  "with the pack laying a platform close to the line",
  "on the back of sustained pressure",
  "as the defence finally runs out of numbers",
  "finishing a well-worked move",
];

export const MOMENTUM_LEVEL = [
  "Neither side can gain a decisive advantage.",
  "This contest is finely balanced.",
  "The game has opened up.",
  "It's still anyone's match.",
  "Both sides are trading blows without finding a decisive edge.",
];

export function momentumLeadPhrases(
  leadingIsHome: boolean,
  homeName: string,
  awayName: string,
): string[] {
  const lead = leadingIsHome ? homeName : awayName;
  const trail = leadingIsHome ? awayName : homeName;
  return [
    `The momentum is firmly with ${lead}.`,
    `${lead} have the upper hand.`,
    `${lead} are beginning to take control.`,
    `Momentum has swung towards ${lead}.`,
    `${trail} are under sustained pressure.`,
    `The tide has turned towards ${lead}.`,
    `${lead} are asking all the questions.`,
    `${trail} need a response here.`,
    `${trail} are hanging on.`,
    `It's becoming a battle of territory, and ${lead} are winning it.`,
  ];
}

export const DEFENCE_STAND = [
  "Big defensive set",
  "Huge defensive effort",
  "Outstanding scramble defence",
  "Important defensive stand",
  "The tackle line is holding firm",
];

export const BREAKDOWN_GOOD = [
  "have been almost flawless at the breakdown",
  "have protected their own ball superbly",
  "have been rock solid over the ball",
  "have looked tidy and clinical at the ruck",
  "are winning the collisions after the tackle",
];

export const SCRUM_GOOD = [
  "haven't missed a beat at scrum time",
  "have given themselves a solid platform at the set piece",
  "have been dominant on their own feed",
  "have used the scrum as a reliable launchpad",
  "are getting a shove on when it matters",
];

export const LINEOUT_CONCERN = [
  "remains a concern",
  "has been their biggest set-piece worry",
  "hasn't given them the clean platform they'd want",
  "continues to leak opportunities",
  "is costing them field position",
];

export const TERRITORY_CONTROL = [
  "are beginning to control territory far better",
  "are spending far more time in the right areas of the field",
  "have enjoyed the better of the territorial battle",
  "are pinning the opposition back with smarter kicking",
  "are living in the right half of the pitch",
];

export const POSSESSION_WITHOUT_POINTS = [
  "but they still need another score to turn pressure into points",
  "without fully punishing the visitors",
  "yet the scoreboard hasn't quite reflected that control",
  "but cutting edge has been missing in the final third",
  "and they must convert that dominance before the door closes",
];

export const WHATS_NEXT_OPENERS = [
  "What happens next will decide the tone of the final quarter.",
  "The next score feels enormous.",
  "If they can land one more punch, this could open up.",
  "A response here would change the complexion entirely.",
  "Keep an eye on whether they chase the bonus or manage the clock.",
];

export const INSIGHT_OPENINGS = [
  "The pattern is clear now:",
  "Here's the shift:",
  "Pressure is telling:",
  "The contest has a shape:",
  "Field position is everything:",
  "It's becoming a game of patience:",
  "The key battleground has moved:",
  "One side is asking harder questions:",
  "The tempo has changed:",
  "Small margins are deciding this:",
  "Discipline is starting to matter:",
  "The kicking game is writing the script:",
  "Defence is the difference so far:",
  "The breakdown is where this is being won:",
  "Neither side will settle for half-measures:",
];
