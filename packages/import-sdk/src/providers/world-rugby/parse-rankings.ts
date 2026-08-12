import type {
  WorldRugbyRankingCategory,
  WorldRugbyRankingEntry,
  WorldRugbyRankingsPayload,
} from "./rankings-types";

type RawTeam = {
  id?: string;
  altId?: string;
  name?: string;
  abbreviation?: string;
  countryCode?: string;
};

type RawEntry = {
  team?: RawTeam;
  pos?: number;
  pts?: number;
  previousPos?: number | null;
  previousPts?: number | null;
};

type RawEffective = {
  label?: string;
};

export type RawWorldRugbyRankingsResponse = {
  label?: string;
  effective?: RawEffective;
  entries?: RawEntry[];
};

export function worldRugbyRankingsUrl(
  category: WorldRugbyRankingCategory,
  language = "en",
  date?: string,
): string {
  const params = new URLSearchParams({ language });
  if (date) params.set("date", date.slice(0, 10));
  return `https://api.wr-rims-prod.pulselive.com/rugby/v3/rankings/${category}?${params.toString()}`;
}

export function parseWorldRugbyRankings(
  category: WorldRugbyRankingCategory,
  raw: RawWorldRugbyRankingsResponse,
): WorldRugbyRankingsPayload {
  const entries = (raw.entries ?? [])
    .map(parseEntry)
    .filter((entry): entry is WorldRugbyRankingEntry => entry !== null)
    .sort((a, b) => a.position - b.position);

  const effectiveDate = raw.effective?.label?.trim() || new Date().toISOString().slice(0, 10);

  return {
    category,
    label: raw.label?.trim() || category,
    effectiveDate,
    entries,
  };
}

function parseEntry(raw: RawEntry): WorldRugbyRankingEntry | null {
  const team = raw.team;
  const id = team?.id?.trim();
  const name = team?.name?.trim();
  if (!id || !name) return null;

  const position = Number(raw.pos);
  const points = Number(raw.pts);
  if (!Number.isFinite(position) || !Number.isFinite(points)) return null;

  return {
    team: {
      id,
      altId: team?.altId?.trim() || "",
      name,
      abbreviation: team?.abbreviation?.trim() || "",
      countryCode: team?.countryCode?.trim() || "",
    },
    position,
    points,
    previousPosition: toOptionalInt(raw.previousPos),
    previousPoints: toOptionalNumber(raw.previousPts),
  };
}

function toOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
