import { isRealCompareRosterTeamName } from "./compare-roster-team-name";
import {
  countryNameFromNationCode,
  isPlaceholderNationLabel,
} from "./nation-code-utils";
import { rugbyHemisphereForTeam } from "./team-picker-groups";

export const COMPARE_PICKER_UNASSIGNED = "Unassigned";

export type ComparePickerPlayer = {
  slug: string;
  name: string;
  position: string | null;
  clubName: string | null;
  countryName: string | null;
};

export type ComparePickerClubKind = "international" | "club" | "unassigned";

export type ComparePickerClubGroup = {
  name: string;
  kind: ComparePickerClubKind;
  players: ComparePickerPlayer[];
};

export type ComparePickerNationGroup = {
  nation: string;
  clubs: ComparePickerClubGroup[];
};

const PLAYER_STATUS_SUFFIX =
  /\s+(released|retired|left|departed|joined|signed|loaned|on\s+loan|deceased|died)$/i;

function teamKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip Wikipedia markup so club headings stay human (not `<span class="anchor"…>`). */
export function cleanComparePickerText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanComparePickerPlayerName(name: string | null | undefined): string {
  return cleanComparePickerText(name).replace(PLAYER_STATUS_SUFFIX, "").trim();
}

export function usableComparePickerClubName(name: string | null | undefined): string | null {
  const cleaned = cleanComparePickerText(name);
  if (!cleaned || !isRealCompareRosterTeamName(cleaned)) return null;
  if (isComparePickerNationName(cleaned)) return null;
  return cleaned;
}

export function isComparePickerNationName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return rugbyHemisphereForTeam(name) != null;
}

function isNationTeam(name: string | null | undefined, teamType?: string | null): boolean {
  if (!name?.trim()) return false;
  const t = (teamType ?? "").toLowerCase();
  if (t === "international" || t === "nation" || t === "national") return true;
  return isComparePickerNationName(name);
}

export function resolveComparePickerClubName(input: {
  clubName?: string | null;
  clubTeamName?: string | null;
  clubTeamType?: string | null;
}): string | null {
  const fromTeam = cleanComparePickerText(input.clubTeamName);
  if (fromTeam && !isNationTeam(fromTeam, input.clubTeamType)) {
    return usableComparePickerClubName(fromTeam);
  }
  return usableComparePickerClubName(input.clubName);
}

export function resolveComparePickerCountryName(input: {
  countryName?: string | null;
  nationCode?: string | null;
  internationalTeamName?: string | null;
  internationalTeamType?: string | null;
  rosterTeamName?: string | null;
  rosterTeamType?: string | null;
  clubCountryName?: string | null;
  clubName?: string | null;
}): string | null {
  const clubKey = input.clubName?.trim() ? teamKey(input.clubName) : "";

  const usableCountry = (name: string | null | undefined): string | null => {
    const n = name?.trim() ?? "";
    if (!n || isPlaceholderNationLabel(n)) return null;
    if (clubKey && teamKey(n) === clubKey) return null;
    return n;
  };

  const knownNation = (name: string | null | undefined): string | null => {
    const n = usableCountry(name);
    if (!n || !isComparePickerNationName(n)) return null;
    return n;
  };

  const fromCountry = knownNation(input.countryName);
  if (fromCountry) return fromCountry;

  const fromCode = countryNameFromNationCode(input.nationCode);
  if (fromCode) return fromCode;

  if (isNationTeam(input.internationalTeamName, input.internationalTeamType)) {
    return input.internationalTeamName!.trim();
  }
  if (isNationTeam(input.rosterTeamName, input.rosterTeamType)) {
    return input.rosterTeamName!.trim();
  }

  const fromClubCountry = knownNation(input.clubCountryName);
  if (fromClubCountry) return fromClubCountry;

  return usableCountry(input.countryName);
}

function clubForPlayer(player: ComparePickerPlayer): { name: string; kind: ComparePickerClubKind } {
  const nation = player.countryName?.trim() || COMPARE_PICKER_UNASSIGNED;
  const club = usableComparePickerClubName(player.clubName);
  if (club && teamKey(club) !== teamKey(nation)) {
    return { name: club, kind: "club" };
  }
  return { name: COMPARE_PICKER_UNASSIGNED, kind: "unassigned" };
}

function sortClubs(a: ComparePickerClubGroup, b: ComparePickerClubGroup): number {
  const rank = (kind: ComparePickerClubKind) =>
    kind === "international" ? 0 : kind === "club" ? 1 : 2;
  const byKind = rank(a.kind) - rank(b.kind);
  if (byKind !== 0) return byKind;
  return a.name.localeCompare(b.name);
}

function sortNations(a: ComparePickerNationGroup, b: ComparePickerNationGroup): number {
  if (a.nation === COMPARE_PICKER_UNASSIGNED) return 1;
  if (b.nation === COMPARE_PICKER_UNASSIGNED) return -1;
  return a.nation.localeCompare(b.nation);
}

export function groupComparePickerPlayers(players: ComparePickerPlayer[]): ComparePickerNationGroup[] {
  const nations = new Map<string, Map<string, ComparePickerClubGroup>>();

  for (const raw of players) {
    const player: ComparePickerPlayer = {
      ...raw,
      name: cleanComparePickerPlayerName(raw.name) || raw.name,
      clubName: usableComparePickerClubName(raw.clubName),
      countryName: cleanComparePickerText(raw.countryName) || null,
    };
    const nation = player.countryName?.trim() || COMPARE_PICKER_UNASSIGNED;
    const club = clubForPlayer(player);
    const clubKey = `${club.kind}:${teamKey(club.name)}`;
    const byClub = nations.get(nation) ?? new Map<string, ComparePickerClubGroup>();
    const existing = byClub.get(clubKey);
    if (existing) {
      existing.players.push(player);
    } else {
      byClub.set(clubKey, { name: club.name, kind: club.kind, players: [player] });
    }
    nations.set(nation, byClub);
  }

  return [...nations.entries()]
    .map(([nation, byClub]) => {
      const clubs = [...byClub.values()]
        .map((club) => ({
          ...club,
          players: [...club.players].sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort(sortClubs);

      if (nation === COMPARE_PICKER_UNASSIGNED) {
        return { nation, clubs };
      }

      const seen = new Set<string>();
      const internationalPlayers: ComparePickerPlayer[] = [];
      for (const club of clubs) {
        for (const player of club.players) {
          if (seen.has(player.slug)) continue;
          seen.add(player.slug);
          internationalPlayers.push(player);
        }
      }
      internationalPlayers.sort((a, b) => a.name.localeCompare(b.name));

      return {
        nation,
        clubs: [
          { name: nation, kind: "international" as const, players: internationalPlayers },
          ...clubs,
        ],
      };
    })
    .sort(sortNations);
}

export const COMPARE_PICKER_INTERNATIONAL_KEY = "international";
export const COMPARE_PICKER_UNASSIGNED_KEY = "unassigned";

export type ComparePickerSquadOption = {
  key: string;
  label: string;
  kind: ComparePickerClubKind;
  players: ComparePickerPlayer[];
};

export function squadOptionsForNationGroup(group: ComparePickerNationGroup): ComparePickerSquadOption[] {
  const options: ComparePickerSquadOption[] = [];
  const international = group.clubs.find((club) => club.kind === "international");
  if (international) {
    options.push({
      key: COMPARE_PICKER_INTERNATIONAL_KEY,
      label: `${group.nation} (international)`,
      kind: "international",
      players: international.players,
    });
  }
  for (const club of group.clubs.filter((item) => item.kind === "club")) {
    options.push({
      key: `club:${club.name}`,
      label: club.name,
      kind: "club",
      players: club.players,
    });
  }
  const unassigned = group.clubs.find((club) => club.kind === "unassigned");
  if (unassigned) {
    options.push({
      key: COMPARE_PICKER_UNASSIGNED_KEY,
      label: COMPARE_PICKER_UNASSIGNED,
      kind: "unassigned",
      players: unassigned.players,
    });
  }
  return options;
}

function haystack(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

export function comparePickerPlayerMatches(player: ComparePickerPlayer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    haystack(player.name).includes(q) ||
    haystack(player.clubName).includes(q) ||
    haystack(player.countryName).includes(q) ||
    haystack(player.slug).includes(q)
  );
}

export function filterComparePickerGroups(
  groups: ComparePickerNationGroup[],
  query: string,
  excludeSlug = "",
): ComparePickerNationGroup[] {
  const q = query.trim().toLowerCase();
  return groups
    .map((group) => {
      const nationMatched = Boolean(q) && haystack(group.nation).includes(q);
      const clubs = group.clubs
        .map((club) => {
          const clubMatched = Boolean(q) && haystack(club.name).includes(q);
          const players = club.players.filter((player) => {
            if (excludeSlug && player.slug === excludeSlug) return false;
            if (nationMatched || clubMatched) return true;
            return comparePickerPlayerMatches(player, q);
          });
          return { ...club, players };
        })
        .filter((club) => club.players.length > 0);
      return { ...group, clubs };
    })
    .filter((group) => group.clubs.length > 0);
}

export function mergeComparePickerPlayers(
  primary: ComparePickerPlayer[],
  extra: ComparePickerPlayer[],
): ComparePickerPlayer[] {
  const bySlug = new Map<string, ComparePickerPlayer>();
  for (const player of [...primary, ...extra]) {
    if (!player.slug) continue;
    if (!bySlug.has(player.slug)) bySlug.set(player.slug, player);
  }
  return [...bySlug.values()];
}
