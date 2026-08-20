/**
 * Per-category venue ranking engine — pure functions, no DB.
 * Editorial picks overlay data scores; never fabricates R365 ratings.
 */
import type {
  VenueProductCategory,
  VenueRankSource,
  VenueType,
} from "./public-venue-product-types";
import { categoryLabel, categorySubtitle, remotenessKm } from "./public-venue-product-math";

export type VenueEditorialRow = {
  venueId: string;
  category: string;
  editorialRank: number;
  editorialReason: string | null;
};

export type VenueRankingRow = {
  id: string;
  capacity: number | null;
  rugbyCapacity: number | null;
  venueType: VenueType | null;
  latitude: number | null;
  longitude: number | null;
  openedYear: number | null;
  r365Rating: number | null;
  fixtureCount: number;
  homeWinPct: number | null;
  avgAttendancePct: number | null;
  homeTeamCount: number;
  intlFixtureCount: number;
  wikipediaUrl: string | null;
};

export type ScoredVenue = {
  venueId: string;
  score: number | null;
  rankSource: VenueRankSource;
  reason: string | null;
};

export const PROMINENT_VENUE_CATEGORIES: VenueProductCategory[] = [
  "best",
  "atmosphere",
  "fortress",
  "historic",
  "iconic",
  "picturesque",
  "remote",
  "biggest",
  "smallest",
  "club_ground",
  "matchday",
];

export const COUNTRY_PAGE_CATEGORIES: VenueProductCategory[] = [
  "best",
  "biggest",
  "fortress",
  "historic",
  "iconic",
  "picturesque",
];

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  dedicated_rugby: "Dedicated Rugby",
  multi_sport: "Multi-Sport",
  occasional_rugby: "Occasional Rugby",
  historic_rugby: "Historic Rugby",
};

/** Effective rugby capacity — prefer verified rugby config over raw stadium capacity. */
export function effectiveRugbyCapacity(row: Pick<VenueRankingRow, "rugbyCapacity" | "capacity">): number | null {
  const cap = row.rugbyCapacity ?? row.capacity;
  return cap != null && Number.isFinite(cap) ? cap : null;
}

export function deriveVenueType(row: VenueRankingRow): VenueType {
  if (row.venueType) return row.venueType;
  if (row.homeTeamCount > 0 && row.fixtureCount >= 10) return "dedicated_rugby";
  const cap = effectiveRugbyCapacity(row);
  if (cap != null && cap >= 60_000 && row.fixtureCount < 5) return "multi_sport";
  if (row.wikipediaUrl && row.openedYear != null && row.openedYear < 1920) return "historic_rugby";
  if (row.fixtureCount > 0 && row.fixtureCount < 5) return "occasional_rugby";
  if (row.homeTeamCount > 0) return "dedicated_rugby";
  return "occasional_rugby";
}

export function isRugbyGroundType(type: VenueType): boolean {
  return type === "dedicated_rugby" || type === "occasional_rugby" || type === "historic_rugby";
}

function dataScore(
  row: VenueRankingRow,
  category: VenueProductCategory,
): ScoredVenue {
  const cap = effectiveRugbyCapacity(row);
  const remote =
    row.latitude != null && row.longitude != null
      ? remotenessKm(row.latitude, row.longitude)
      : null;
  const type = deriveVenueType(row);

  switch (category) {
    case "best": {
      if (row.r365Rating != null) {
        return {
          venueId: row.id,
          score: row.r365Rating * 100 + (row.fixtureCount ?? 0) * 0.01,
          rankSource: "data",
          reason: "Combined R365 venue rating and fixture history.",
        };
      }
      const capScore = cap != null ? Math.log10(Math.max(cap, 1)) * 20 : 0;
      const fixScore = Math.min(row.fixtureCount, 500) * 0.15;
      const intlScore = row.intlFixtureCount * 2;
      const total = capScore + fixScore + intlScore;
      return total > 0
        ? {
            venueId: row.id,
            score: total,
            rankSource: "provisional",
            reason: "Provisional — based on capacity and fixture volume until R365 ratings launch.",
          }
        : { venueId: row.id, score: null, rankSource: "provisional", reason: null };
    }
    case "atmosphere": {
      if (row.avgAttendancePct != null && row.avgAttendancePct > 0) {
        return {
          venueId: row.id,
          score: row.avgAttendancePct * 100,
          rankSource: "data",
          reason: "Average attendance vs capacity from recorded fixtures.",
        };
      }
      if (cap != null && row.fixtureCount >= 5) {
        return {
          venueId: row.id,
          score: Math.min(row.fixtureCount, 200) * 0.5,
          rankSource: "provisional",
          reason: "Provisional — attendance data incomplete; ranked by fixture activity.",
        };
      }
      return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
    }
    case "fortress": {
      if (row.homeWinPct != null && row.fixtureCount >= 5) {
        return {
          venueId: row.id,
          score: row.homeWinPct * 100 + Math.min(row.fixtureCount, 100) * 0.1,
          rankSource: "data",
          reason: `Home win rate ${Math.round(row.homeWinPct * 100)}% at this ground.`,
        };
      }
      return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
    }
    case "historic": {
      let score = 0;
      const parts: string[] = [];
      if (row.openedYear != null) {
        score += Math.max(0, 2026 - row.openedYear) * 0.5;
        parts.push(`Opened ${row.openedYear}`);
      }
      if (row.intlFixtureCount > 0) {
        score += row.intlFixtureCount * 5;
        parts.push(`${row.intlFixtureCount} international fixtures`);
      }
      if (type === "historic_rugby") {
        score += 20;
        parts.push("Historic rugby ground");
      }
      return score > 0
        ? {
            venueId: row.id,
            score,
            rankSource: row.openedYear != null ? "data" : "provisional",
            reason: parts.join(" · ") || null,
          }
        : { venueId: row.id, score: null, rankSource: "provisional", reason: null };
    }
    case "iconic":
    case "picturesque":
      return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
    case "remote": {
      if (remote == null) return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
      return {
        venueId: row.id,
        score: remote,
        rankSource: "data",
        reason: `${remote.toLocaleString("en-GB")} km from nearest rugby hub.`,
      };
    }
    case "biggest": {
      if (cap == null) return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
      if (!isRugbyGroundType(type)) {
        return {
          venueId: row.id,
          score: cap * 0.5,
          rankSource: "provisional",
          reason: "Multi-sport stadium — rugby configuration capacity may differ.",
        };
      }
      return {
        venueId: row.id,
        score: cap,
        rankSource: "data",
        reason: `Verified rugby capacity ${cap.toLocaleString("en-GB")}.`,
      };
    }
    case "smallest": {
      if (cap == null || cap <= 0) return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
      if (!isRugbyGroundType(type)) {
        return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
      }
      return {
        venueId: row.id,
        score: -cap,
        rankSource: "data",
        reason: `Rugby capacity ${cap.toLocaleString("en-GB")}.`,
      };
    }
    case "club_ground": {
      if (row.homeTeamCount === 0) {
        return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
      }
      const clubScore =
        row.homeTeamCount * 10 +
        Math.min(row.fixtureCount, 200) * 0.2 +
        (row.avgAttendancePct ?? 0) * 50;
      return {
        venueId: row.id,
        score: clubScore,
        rankSource: row.avgAttendancePct != null ? "data" : "provisional",
        reason:
          row.homeTeamCount === 1
            ? "Regular club tenant with home fixtures."
            : `${row.homeTeamCount} home tenants — club ground.`,
      };
    }
    case "matchday": {
      const att = row.avgAttendancePct ?? 0;
      const fix = Math.min(row.fixtureCount, 200);
      if (att > 0) {
        return {
          venueId: row.id,
          score: att * 80 + fix * 0.2,
          rankSource: "data",
          reason: "Attendance utilisation and fixture volume.",
        };
      }
      if (fix >= 5 && cap != null) {
        return {
          venueId: row.id,
          score: fix * 0.3 + Math.log10(Math.max(cap, 1)) * 5,
          rankSource: "provisional",
          reason: "Provisional — limited attendance records.",
        };
      }
      return { venueId: row.id, score: null, rankSource: "provisional", reason: null };
    }
    case "all":
    default: {
      const s = cap ?? 0;
      return s > 0
        ? { venueId: row.id, score: s, rankSource: "data", reason: null }
        : { venueId: row.id, score: 0, rankSource: "data", reason: null };
    }
  }
}

export function isEditorialPrimaryCategory(category: VenueProductCategory): boolean {
  return category === "iconic" || category === "picturesque";
}

export function mergeEditorialAndDataRanks(input: {
  cohort: VenueRankingRow[];
  category: VenueProductCategory;
  editorial: VenueEditorialRow[];
  limit: number;
}): Array<{
  venueId: string;
  rank: number;
  dataRank: number | null;
  rankSource: VenueRankSource;
  reason: string | null;
  editorialRank: number | null;
  categoryLabel: string;
}> {
  const { cohort, category, editorial, limit } = input;
  const editorialForCat = editorial
    .filter((e) => e.category === category)
    .sort((a, b) => a.editorialRank - b.editorialRank);
  const editorialByVenue = new Map(editorialForCat.map((e) => [e.venueId, e]));

  const scored = cohort
    .map((row) => ({ row, ...dataScore(row, category) }))
    .filter((s) => s.score != null || editorialByVenue.has(s.row.id))
    .sort((a, b) => {
      const ea = editorialByVenue.get(a.row.id);
      const eb = editorialByVenue.get(b.row.id);
      if (ea && eb) return ea.editorialRank - eb.editorialRank;
      if (ea) return -1;
      if (eb) return 1;
      return (b.score ?? -Infinity) - (a.score ?? -Infinity);
    });

  const dataOnly = scored
    .filter((s) => !editorialByVenue.has(s.row.id) && s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const used = new Set<string>();
  const results: Array<{
    venueId: string;
    rank: number;
    dataRank: number | null;
    rankSource: VenueRankSource;
    reason: string | null;
    editorialRank: number | null;
    categoryLabel: string;
  }> = [];

  let dataIdx = 0;
  for (let rank = 1; rank <= limit; rank++) {
    const ed = editorialForCat.find((e) => e.editorialRank === rank && !used.has(e.venueId));
    if (ed) {
      used.add(ed.venueId);
      results.push({
        venueId: ed.venueId,
        rank,
        dataRank: null,
        rankSource: "editorial",
        reason: ed.editorialReason,
        editorialRank: ed.editorialRank,
        categoryLabel: `${categoryLabel(category)} · Editorial`,
      });
      continue;
    }

    while (dataIdx < dataOnly.length && used.has(dataOnly[dataIdx]!.row.id)) {
      dataIdx++;
    }
    const next = dataOnly[dataIdx];
    if (!next) break;
    used.add(next.row.id);
    dataIdx++;
    const src = next.rankSource;
    results.push({
      venueId: next.row.id,
      rank,
      dataRank: rank,
      rankSource: src,
      reason: next.reason,
      editorialRank: null,
      categoryLabel:
        src === "provisional"
          ? `${categoryLabel(category)} · Provisional`
          : `${categoryLabel(category)} · ${categorySubtitle(category)}`,
    });
  }

  // Editorial-only categories: include unpublished editorial slots even without data scores
  if (results.length === 0 && isEditorialPrimaryCategory(category)) {
    for (const ed of editorialForCat.slice(0, limit)) {
      if (used.has(ed.venueId)) continue;
      used.add(ed.venueId);
      results.push({
        venueId: ed.venueId,
        rank: results.length + 1,
        dataRank: null,
        rankSource: "editorial",
        reason: ed.editorialReason,
        editorialRank: ed.editorialRank,
        categoryLabel: `${categoryLabel(category)} · Editorial`,
      });
    }
  }

  return results;
}

export function categoryImplementationNote(category: VenueProductCategory): "data" | "editorial" | "mixed" {
  switch (category) {
    case "iconic":
    case "picturesque":
      return "editorial";
    case "remote":
    case "biggest":
    case "smallest":
      return "data";
    case "best":
    case "atmosphere":
    case "fortress":
    case "historic":
    case "club_ground":
    case "matchday":
      return "mixed";
    default:
      return "data";
  }
}
