/**
 * Public player URL filters: stable season/competition slugs (never UUIDs).
 */

export type PublicPlayerView = "domestic" | "international" | "scouting";

export type PublicPlayerFilterState = {
  view: PublicPlayerView;
  tab: string;
  season: string; // "current" | "all" | "2025-26" | "2023"
  competition: string; // "all" | competition slug
  page: number;
  preview: boolean;
};

export const PUBLIC_PLAYER_TABS = [
  "overview",
  "stats",
  "matches",
  "events",
  "transfers",
  "absences",
  "international",
  "news",
  "achievements",
  "career",
] as const;

export type PublicPlayerTab = (typeof PUBLIC_PLAYER_TABS)[number];

export function isPublicPlayerView(value: string | null | undefined): value is PublicPlayerView {
  return value === "domestic" || value === "international" || value === "scouting";
}

export function normalizeSeasonSlugParam(raw: string | null | undefined): string {
  const v = (raw ?? "current").trim().toLowerCase();
  if (!v || v === "current") return "current";
  if (v === "all") return "all";
  // accept 2025–26 / 2025/26 / 2025-26
  const cross = v.match(/^(\d{4})\s*[/\u2013-]\s*(\d{2})$/);
  if (cross) return `${cross[1]}-${cross[2]}`;
  if (/^\d{4}$/.test(v)) return v;
  return v;
}

export function seasonLabelToPublicSlug(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const cross = label.trim().match(/^(\d{4})\s*[/\u2013-]\s*(\d{2})$/);
  if (cross) return `${cross[1]}-${cross[2]}`;
  const year = label.trim().match(/^(\d{4})$/);
  if (year) return year[1]!;
  return null;
}

export function buildPublicPlayerPath(input: {
  slug: string;
  view?: PublicPlayerView;
  tab?: string;
  season?: string;
  competition?: string;
  page?: number;
  preview?: boolean;
}): string {
  const view = input.view ?? "domestic";
  const base =
    view === "domestic"
      ? `/players/${input.slug}`
      : `/players/${input.slug}/${view}`;
  const params = new URLSearchParams();
  if (input.tab && input.tab !== "overview") params.set("tab", input.tab);
  const season = normalizeSeasonSlugParam(input.season);
  if (season && season !== "current") params.set("season", season);
  if (input.competition && input.competition !== "all") {
    params.set("competition", input.competition);
  }
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.preview) params.set("preview", "1");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parsePublicPlayerSearchParams(sp: {
  tab?: string;
  season?: string;
  competition?: string;
  page?: string;
  preview?: string;
}): Omit<PublicPlayerFilterState, "view"> {
  const tabRaw = sp.tab?.trim() || "overview";
  const tab = (PUBLIC_PLAYER_TABS as readonly string[]).includes(tabRaw) ? tabRaw : "overview";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  return {
    tab,
    season: normalizeSeasonSlugParam(sp.season),
    competition: (sp.competition?.trim() || "all").toLowerCase(),
    page,
    preview: sp.preview === "1" || sp.preview === "true",
  };
}

export function isInternationalCompetitionType(type: string | null | undefined): boolean {
  const t = (type ?? "").toLowerCase();
  return t === "international" || t === "world_cup";
}

export function matchesSeasonFilter(
  rowSeasonSlug: string | null,
  filter: string,
  currentDomesticSlug: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "current") {
    return rowSeasonSlug === currentDomesticSlug || rowSeasonSlug === String(new Date().getFullYear());
  }
  return rowSeasonSlug === filter;
}
