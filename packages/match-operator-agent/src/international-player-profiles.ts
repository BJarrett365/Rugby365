import { jerseyToPositionName } from "./rugby-positions";

export type InternationalPlayerProfile = {
  name: string;
  positionName?: string;
  clubName?: string;
  countryName?: string;
};

/** Curated international profiles — exemplar squads and known players when Sport365 has no club data. */
const BY_PROVIDER_ID: Record<string, InternationalPlayerProfile> = {
  // Wales — Barbarians vs Wales (1-4307588)
  "2-1303759": { name: "Dan Edwards", positionName: "fly-half", clubName: "Ospreys", countryName: "Wales" },
  "2-716572": { name: "Kieran Hardy", positionName: "scrum-half", clubName: "Scarlets", countryName: "Wales" },
  "2-967949": { name: "Jac Morgan", positionName: "openside flanker", clubName: "Gloucester", countryName: "Wales" },
  "2-885376": { name: "Aaron Wainwright", positionName: "number eight", clubName: "Dragons", countryName: "Wales" },
  "2-838507": { name: "Thomas Rogers", positionName: "wing", clubName: "Scarlets", countryName: "Wales" },
  "2-1552451": { name: "Ellis Mee", positionName: "wing", clubName: "Exeter Chiefs", countryName: "Wales" },
  "2-314517": { name: "George North", positionName: "centre", clubName: "Bath", countryName: "Wales" },
  "2-718605": { name: "Reuben Morgan-Williams", positionName: "scrum-half", clubName: "Scarlets", countryName: "Wales" },
  "2-1091001": { name: "Santiago Arata", positionName: "scrum-half", clubName: "Castres", countryName: "Uruguay" },
  // Barbarians
  "2-728182": { name: "Vincent Koch", positionName: "tighthead prop", clubName: "Saracens", countryName: "South Africa" },
  "2-780779": { name: "Alex Nankivell", positionName: "centre", clubName: "Chiefs", countryName: "New Zealand" },
  "2-319446": { name: "Virimi Vakatawa", positionName: "wing", clubName: "Racing 92", countryName: "France" },
  "2-717574": { name: "Faf de Klerk", positionName: "scrum-half", clubName: "Sale Sharks", countryName: "South Africa" },
  // United States
  "76k2gv6y": { name: "AJ MacGinty", positionName: "fly-half", clubName: "Bristol Bears", countryName: "United States" },
};

const BY_NAME: Record<string, InternationalPlayerProfile> = Object.fromEntries(
  Object.values(BY_PROVIDER_ID).map((p) => [p.name.toLowerCase(), p]),
);

export type FixtureOfficials = {
  refereeName?: string;
  venueName?: string;
  venueCity?: string;
};

/** Example fixture metadata when provider omits officials (Barbarians vs Wales exemplar). */
const FIXTURE_OFFICIALS: Record<string, FixtureOfficials> = {
  "1-4307588": {
    refereeName: "Matthew Carley",
    venueName: "Allianz Stadium",
    venueCity: "London",
  },
};

export function lookupInternationalPlayerProfile(input: {
  providerId?: string;
  name?: string;
  jerseyNumber?: number;
  teamName?: string;
}): InternationalPlayerProfile {
  const name = input.name?.trim() ?? "";
  if (input.providerId && BY_PROVIDER_ID[input.providerId]) {
    return { ...BY_PROVIDER_ID[input.providerId] };
  }
  const byName = BY_NAME[name.toLowerCase()];
  if (byName) return { ...byName };

  const positionName =
    input.jerseyNumber !== undefined ? jerseyToPositionName(input.jerseyNumber) : undefined;
  return {
    name,
    positionName,
  };
}

export function lookupFixtureOfficials(externalMatchId?: string): FixtureOfficials | undefined {
  if (!externalMatchId) return undefined;
  return FIXTURE_OFFICIALS[externalMatchId];
}
