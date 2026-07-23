"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MatchCmsActionBar } from "@/components/admin/MatchCmsActionBar";
import { MatchCmsInlineScore } from "@/components/admin/MatchCmsInlineScore";
import { MatchCmsWarnings } from "@/components/admin/MatchCmsWarnings";
import { IconChevron } from "@/components/admin/MatchCmsIcons";
import { SourceProviderPill } from "@/components/admin/SourceProviderPill";
import {
  groupMatchesByCompetitionSeason,
  localDateKey,
  matchCmsFiltersToSearchParams,
  matchProviderLabel,
  MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE,
  MATCH_CMS_PAGE_SIZE_DEFAULT,
  MATCH_CMS_PROVIDERS,
  MATCH_CMS_SORT_OPTIONS,
  parseMatchCmsFilters,
  shiftDateKey,
  type MatchCmsGroup,
  type MatchCmsListFilters,
  type MatchCmsListRow,
  type MatchCmsSort,
} from "@/lib/match-cms-list-utils";
import { hasRequiredMatchCmsFilters } from "@/lib/match-cms-date-bounds";
import type { TodayOpsBucket } from "@/lib/match-cms-warnings";

type CompetitionOption = { id: string; name: string; slug: string };
type SeasonOption = {
  id: string;
  label: string;
  year?: number;
  competitionId: string;
  competitionName: string;
};

const STATUS_OPTIONS = [
  "scheduled",
  "live",
  "half_time",
  "full_time",
  "postponed",
  "cancelled",
] as const;

const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  scheduled: "Scheduled",
  live: "Live",
  half_time: "Half time",
  full_time: "Full time",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

const SORT_LABELS: Record<(typeof MATCH_CMS_SORT_OPTIONS)[number], string> = {
  kickoff: "Kick-off",
  competition: "Competition",
  home: "Home",
  away: "Away",
  status: "Status",
  provider: "Provider",
  id: "ID",
};

const OPS_BUCKETS: Array<{ id: TodayOpsBucket; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "starting_soon", label: "Soon" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
  { id: "missing_data", label: "Gaps" },
  { id: "unmapped", label: "Unmapped" },
  { id: "missing_lineups", label: "No lineups" },
  { id: "missing_venue", label: "No venue" },
  { id: "missing_referee", label: "No ref" },
];

/** Dense DD-MM-YYYY HH:MM for list scanning. */
function formatKickoffCompact(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

const fieldLabel = "match-cms-filter-label";
const compactControl = "cms-input text-xs h-8 py-1";
const compactSelect = "cms-select text-xs h-8 py-1";

export function MatchesCmsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseMatchCmsFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const today = localDateKey();
  const filtersWithDateDefaults = useMemo((): MatchCmsListFilters => {
    return {
      ...filters,
      fromDate: filters.fromDate ?? today,
      toDate: filters.toDate ?? today,
      pageSize: filters.pageSize ?? MATCH_CMS_PAGE_SIZE_DEFAULT,
      sort: filters.sort ?? "kickoff",
      sortDir: filters.sortDir ?? "desc",
    };
  }, [filters, today]);

  const urlReady = hasRequiredMatchCmsFilters(filters) || filters.ops === "today";

  const [matches, setMatches] = useState<MatchCmsListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [opsSummary, setOpsSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<MatchCmsListFilters>(filtersWithDateDefaults);

  useEffect(() => {
    setDraft({
      ...filters,
      fromDate: filters.fromDate ?? today,
      toDate: filters.toDate ?? today,
      pageSize: filters.pageSize ?? MATCH_CMS_PAGE_SIZE_DEFAULT,
      sort: filters.sort ?? "kickoff",
      sortDir: filters.sortDir ?? "desc",
    });
  }, [filters, today]);

  // Seed from/to on first visit so "All competitions" loads today's games without an extra click.
  useEffect(() => {
    if (filters.ops === "today") return;
    if (filters.fromDate && filters.toDate) return;
    const sp = matchCmsFiltersToSearchParams({
      ...filtersWithDateDefaults,
      page: 1,
    });
    sp.set("view", "cms");
    router.replace(`${pathname}?${sp.toString()}`);
    // Intentionally once when URL lacks a date range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/competitions")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = (data.competitions ?? []) as Array<{ id: string; name: string; slug: string }>;
        setCompetitions(rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug })));
      })
      .catch(() => {
        /* picker stays empty until a successful search */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const competitionId = draft.competitionId;
    if (!competitionId) {
      setSeasons([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/seasons?competitionId=${encodeURIComponent(competitionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSeasons(
          ((data.seasons ?? []) as Array<SeasonOption & { year?: number }>).map((s) => ({
            id: s.id,
            label: s.label,
            year: s.year,
            competitionId: s.competitionId,
            competitionName: s.competitionName,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setSeasons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.competitionId]);

  const applyFilters = useCallback(
    (next: MatchCmsListFilters, replace = false) => {
      const sp = matchCmsFiltersToSearchParams({ ...next, page: next.page ?? 1 });
      sp.set("view", "cms");
      const qs = sp.toString();
      const href = qs ? `${pathname}?${qs}` : `${pathname}?view=cms`;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router],
  );

  const load = useCallback(async () => {
    if (!urlReady) {
      setMatches([]);
      setTotal(0);
      setTotalPages(1);
      setOpsSummary(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const sp = matchCmsFiltersToSearchParams(filters);
    sp.set("mode", "cms");
    try {
      const res = await fetch(`/api/admin/matches?${sp.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load matches");
        setMatches([]);
        setOpsSummary(null);
      } else {
        setMatches(data.matches ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        if (data.competitions?.length) setCompetitions(data.competitions);
        // Season picker is scoped to one competition; ignore the all-seasons dump for "All competitions".
        if (filters.competitionId) {
          if (data.seasons) setSeasons(data.seasons);
        } else {
          setSeasons([]);
        }
        setOpsSummary(data.opsSummary ?? null);
        setSelected(new Set());
      }
    } catch {
      setError("Failed to load matches");
    }
    setLoading(false);
  }, [filters, urlReady]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const draftCanSearch = hasRequiredMatchCmsFilters(draft);

  const groups: MatchCmsGroup[] = useMemo(
    () => groupMatchesByCompetitionSeason(matches),
    [matches],
  );

  const seasonOptions = useMemo(() => {
    if (!draft.competitionId) return seasons;
    return seasons.filter((s) => s.competitionId === draft.competitionId);
  }, [seasons, draft.competitionId]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllInGroup(group: MatchCmsGroup) {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = group.matches.map((m) => m.id);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function setDateRange(from: string, to: string) {
    const next = {
      ...draft,
      fromDate: from,
      toDate: to,
      page: 1,
      ops: null,
      opsBucket: null,
    };
    setDraft(next);
    // Only navigate/search when required filters are complete.
    if (hasRequiredMatchCmsFilters(next)) applyFilters(next);
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="match-cms-list space-y-3 pb-14">
      {/* Compact filter toolbar */}
      <div className="cms-card !p-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={fieldLabel}>From</span>
            <input
              type="date"
              className={compactControl}
              value={draft.fromDate ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value || null }))}
            />
          </label>
          <label>
            <span className={fieldLabel}>To</span>
            <input
              type="date"
              className={compactControl}
              value={draft.toDate ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value || null }))}
            />
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              className="cms-btn cms-btn--secondary h-8 text-xs px-2"
              title="Previous day"
              onClick={() => {
                const base = draft.fromDate || today;
                setDateRange(shiftDateKey(base, -1), shiftDateKey(draft.toDate || base, -1));
              }}
            >
              −
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary h-8 text-xs px-2"
              onClick={() => setDateRange(today, today)}
            >
              Today
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary h-8 text-xs px-2"
              title="Next day"
              onClick={() => {
                const base = draft.fromDate || today;
                setDateRange(shiftDateKey(base, 1), shiftDateKey(draft.toDate || base, 1));
              }}
            >
              +
            </button>
          </div>

          <label className="min-w-[8rem] flex-1">
            <span className={fieldLabel}>Competition</span>
            <select
              className={`${compactSelect} w-full`}
              value={draft.competitionId ?? ""}
              onChange={(e) => {
                const next = {
                  ...draft,
                  competitionId: e.target.value || null,
                  seasonId: null,
                  page: 1,
                  ops: null,
                  opsBucket: null,
                };
                setDraft(next);
                if (hasRequiredMatchCmsFilters(next)) applyFilters(next);
              }}
            >
              <option value="">All competitions</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[7rem]">
            <span className={fieldLabel}>Season</span>
            <select
              className={`${compactSelect} w-full`}
              value={draft.seasonId ?? ""}
              onChange={(e) => {
                setDraft((d) => ({ ...d, seasonId: e.target.value || null }));
              }}
            >
              <option value="">All</option>
              {seasonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[6.5rem]">
            <span className={fieldLabel}>Status</span>
            <select
              className={`${compactSelect} w-full`}
              value={draft.status ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value || null }))}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[7rem]">
            <span className={fieldLabel}>Provider</span>
            <select
              className={`${compactSelect} w-full`}
              value={draft.provider ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value || null }))}
            >
              <option value="">All</option>
              {MATCH_CMS_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {matchProviderLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] flex-1">
            <span className={fieldLabel}>Search team</span>
            <input
              className={`${compactControl} w-full`}
              value={draft.teamQuery ?? ""}
              placeholder="Home or away team"
              onChange={(e) => setDraft((d) => ({ ...d, teamQuery: e.target.value || null }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters({ ...draft, page: 1 });
              }}
            />
          </label>
          <label className="min-w-[7rem]">
            <span className={fieldLabel}>Sort</span>
            <select
              className={`${compactSelect} w-full`}
              value={draft.sort ?? "kickoff"}
              onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value as MatchCmsSort }))}
            >
              {MATCH_CMS_SORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[5.5rem]">
            <span className={fieldLabel}>Dir</span>
            <select
              className={`${compactSelect} w-full`}
              value={draft.sortDir ?? "desc"}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  sortDir: e.target.value === "asc" ? "asc" : "desc",
                }))
              }
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </label>
          <button
            type="button"
            className="cms-btn cms-btn--primary h-8 text-xs disabled:opacity-40 disabled:pointer-events-none"
            disabled={!draftCanSearch}
            title={draftCanSearch ? "Search matches" : MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE}
            onClick={() => applyFilters({ ...draft, page: 1, ops: null, opsBucket: null })}
          >
            Search
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--ghost h-8 text-xs"
            onClick={() => {
              const reset: MatchCmsListFilters = {
                fromDate: today,
                toDate: today,
                sort: "kickoff",
                sortDir: "desc",
                page: 1,
                pageSize: MATCH_CMS_PAGE_SIZE_DEFAULT,
                ops: null,
                opsBucket: null,
              };
              setDraft(reset);
              applyFilters(reset);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--accent h-8 text-xs"
            title={
              draft.competitionId
                ? "Today’s matches for selected competition"
                : "Today’s matches across all competitions"
            }
            onClick={() => {
              const next: MatchCmsListFilters = {
                ...draft,
                fromDate: today,
                toDate: today,
                ops: "today",
                opsBucket: "all",
                sort: "kickoff",
                sortDir: "asc",
                page: 1,
                pageSize: 200,
              };
              setDraft(next);
              applyFilters(next);
            }}
          >
            Today’s Matches
          </button>
        </div>
      </div>

      {filters.ops === "today" && opsSummary ? (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="match-cms-filter-label mr-1 !mb-0 inline">
            Today · {timezone}
          </span>
          {OPS_BUCKETS.map((bucket) => {
            const count = opsSummary[bucket.id] ?? 0;
            const active = (filters.opsBucket ?? "all") === bucket.id;
            return (
              <button
                key={bucket.id}
                type="button"
                className={`cms-btn text-[11px] h-7 px-2 ${active ? "cms-btn--primary" : "cms-btn--secondary"}`}
                onClick={() =>
                  applyFilters({
                    ...filters,
                    ops: "today",
                    opsBucket: bucket.id,
                    page: 1,
                  })
                }
              >
                {bucket.label} {count}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="match-cms-error">{error}</p> : null}
      {loading ? <p className="match-cms-muted text-sm m-0">Loading…</p> : null}

      {!loading && !urlReady ? (
        <p className="match-cms-muted text-sm cms-card !p-3 m-0">{MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE}</p>
      ) : null}

      {!loading && !error && urlReady && groups.length === 0 ? (
        <p className="match-cms-muted text-sm cms-card !p-3 m-0">No matches for these filters.</p>
      ) : null}

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const warnTotal = group.matches.reduce((n, m) => n + m.warningCount, 0);
        return (
          <div key={group.key} className="match-cms-group">
            <div className="match-cms-group__header">
              <button
                type="button"
                className="match-cms-group__toggle"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={!isCollapsed}
              >
                <IconChevron open={!isCollapsed} className="w-3.5 h-3.5" />
                <span>
                  {group.competitionName}
                  <span className="match-cms-group__meta">
                    {" "}
                    · {group.seasonLabel ?? "No season"} · {group.matchCount}
                  </span>
                </span>
              </button>
              <SourceProviderPill provider={group.mainProvider} />
              {warnTotal > 0 ? (
                <span className="match-cms-group__warn" title="Warnings in this group">
                  {warnTotal} warnings
                </span>
              ) : null}
              <div className="flex-1" />
              {group.competitionId ? (
                <Link
                  href={`/admin/competitions/${group.competitionId}/edit`}
                  className="match-cms-group__link"
                >
                  Open competition
                </Link>
              ) : null}
              <button
                type="button"
                className="match-cms-group__select"
                onClick={() => toggleSelectAllInGroup(group)}
              >
                Select all
              </button>
            </div>

            {!isCollapsed ? (
              <div className="overflow-x-auto">
                <table className="match-cms-dense-table">
                  <thead>
                    <tr>
                      <th className="w-7" />
                      <th>ID</th>
                      <th>Kick-off</th>
                      <th>Home</th>
                      <th>Away</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Src</th>
                      <th className="w-10" title="Issues — Wiki/AI verify and fix missing data">
                        !
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.matches.map((m) => {
                      const checked = selected.has(m.id);
                      return (
                        <tr key={m.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(m.id)) next.delete(m.id);
                                  else next.add(m.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select ${m.homeTeamName} v ${m.awayTeamName}`}
                            />
                          </td>
                          <td className="whitespace-nowrap">
                            <Link
                              href={`/admin/matches/${m.id}/edit`}
                              className="match-cms-id-link"
                              title={m.id}
                            >
                              {shortId(m.id)}
                            </Link>
                            {(m.primaryApiMatchId || m.externalMatchId) && (
                              <div className="match-cms-ext-id">
                                {m.primaryApiMatchId ?? m.externalMatchId}
                              </div>
                            )}
                          </td>
                          <td className="match-cms-kickoff">{formatKickoffCompact(m.kickoffAt)}</td>
                          <td className="max-w-[9rem] truncate">
                            {m.homeTeamId ? (
                              <Link
                                href={`/admin/teams/${m.homeTeamId}/edit`}
                                className="match-cms-team-link"
                                title={m.homeTeamName ?? undefined}
                              >
                                {m.homeTeamName ?? "—"}
                              </Link>
                            ) : (
                              <span className="match-cms-team-muted">{m.homeTeamName ?? "—"}</span>
                            )}
                          </td>
                          <td className="max-w-[9rem] truncate">
                            {m.awayTeamId ? (
                              <Link
                                href={`/admin/teams/${m.awayTeamId}/edit`}
                                className="match-cms-team-link"
                                title={m.awayTeamName ?? undefined}
                              >
                                {m.awayTeamName ?? "—"}
                              </Link>
                            ) : (
                              <span className="match-cms-team-muted">{m.awayTeamName ?? "—"}</span>
                            )}
                          </td>
                          <MatchCmsInlineScore
                            matchId={m.id}
                            homeScore={m.homeScore}
                            awayScore={m.awayScore}
                            status={m.status}
                            scoreLocked={m.scoreLocked}
                            statusLocked={m.statusLocked}
                            providerLabel={matchProviderLabel(m.provider)}
                            onSaved={(next) => {
                              setMatches((prev) =>
                                prev.map((row) =>
                                  row.id === m.id
                                    ? {
                                        ...row,
                                        homeScore: next.homeScore,
                                        awayScore: next.awayScore,
                                        status: next.status,
                                        scoreLocked: true,
                                        statusLocked: true,
                                      }
                                    : row,
                                ),
                              );
                            }}
                          />
                          <td>
                            <SourceProviderPill provider={m.provider} />
                          </td>
                          <td>
                            <MatchCmsWarnings match={m} />
                          </td>
                          <td>
                            <MatchCmsActionBar matchId={m.id} slug={m.slug} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}

      {totalPages > 1 ? (
        <div className="match-cms-pagination">
          <button
            type="button"
            className="cms-btn cms-btn--secondary h-8 text-xs"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => applyFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
          >
            Previous
          </button>
          <span className="match-cms-pagination__meta">
            Page {filters.page ?? 1} / {totalPages}
          </span>
          <button
            type="button"
            className="cms-btn cms-btn--secondary h-8 text-xs"
            disabled={(filters.page ?? 1) >= totalPages}
            onClick={() => applyFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
          >
            Next
          </button>
        </div>
      ) : null}

      <div className="match-cms-footer">
        <div className="flex flex-wrap items-center gap-2">
          <SourceProviderPill provider="rugby_data" />
          <SourceProviderPill provider="planet_rugby" />
          <SourceProviderPill provider="sport365" />
          <SourceProviderPill provider="manual" />
        </div>
        <div className="flex-1" />
        <span>
          Showing {matches.length}
          {total > matches.length ? ` of ${total}` : ""} match{total === 1 ? "" : "es"}
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </span>
        <span className="match-cms-footer__tz">{timezone}</span>
      </div>
    </div>
  );
}
