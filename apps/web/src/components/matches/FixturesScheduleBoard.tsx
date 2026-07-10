"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MatchDatePicker } from "./MatchDatePicker";
import {
  competitionDisplayName,
  dateKeyLocal,
  groupByCompetition,
  isFinished,
  kickoffDateKey,
  matchDetailHref,
  matchStatusShort,
  monthBoundsFromYearMonth,
  seasonFromDateKey,
  type ScheduleCompetition,
  type ScheduleFixture,
} from "./match-schedule-utils";

function CompactMatchRow({
  fixture,
  admin,
  onDelete,
  operatorSelect,
}: {
  fixture: ScheduleFixture;
  admin?: boolean;
  onDelete?: (id: string, label: string) => void;
  operatorSelect?: { selected: boolean; onSelect: () => void };
}) {
  const home = fixture.homeTeam?.name ?? "TBC";
  const away = fixture.awayTeam?.name ?? "TBC";
  const label = `${home} vs ${away}`;
  const finished = isFinished(fixture.status);
  const scoreText = finished ? `${fixture.homeScore} - ${fixture.awayScore}` : "vs";
  const isDb = fixture.source !== "sdms";
  const detailHref = matchDetailHref(fixture);

  const content = (
    <>
      <span className="fixtures-row__time">
        {matchStatusShort(fixture.status, fixture.kickoffAt, fixture.matchDate)}
      </span>
      <span className="fixtures-row__home">{home}</span>
      <span className={`fixtures-row__score ${finished ? "fixtures-row__score--result" : ""}`}>
        {scoreText}
      </span>
      <span className="fixtures-row__away">{away}</span>
      <span className="fixtures-row__star" aria-hidden>
        ☆
      </span>
    </>
  );

  if (operatorSelect) {
    if (isDb) {
      return (
        <div className="fixtures-row fixtures-row--admin fixtures-row--operator">
          <button
            type="button"
            className={`fixtures-row__link fixtures-row__link--select ${
              operatorSelect.selected ? "fixtures-row__link--selected" : ""
            }`}
            onClick={operatorSelect.onSelect}
            aria-pressed={operatorSelect.selected}
          >
            {content}
          </button>
          <div className="fixtures-row__admin-actions no-print">
            {matchDetailHref(fixture) && (
              <Link href={matchDetailHref(fixture)!} className="fixtures-row__admin-btn">
                Details
              </Link>
            )}
            <Link href={`/matches/${fixture.slug}/commentary`} className="fixtures-row__admin-btn">
              Live
            </Link>
            <Link href={`/admin/matches/${fixture.id}/edit`} className="fixtures-row__admin-btn">
              Edit
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="fixtures-row fixtures-row--admin fixtures-row--operator">
        <div className="fixtures-row__link fixtures-row__link--live">{content}</div>
        <div className="fixtures-row__admin-actions no-print">
          {matchDetailHref(fixture) && (
            <Link href={matchDetailHref(fixture)!} className="fixtures-row__admin-btn">
              Details
            </Link>
          )}
          <Link href="/admin/matches/import" className="fixtures-row__admin-btn">
            Import to CMS
          </Link>
        </div>
      </div>
    );
  }

  if (admin) {
    return (
      <div className="fixtures-row fixtures-row--admin">
        {detailHref ? (
          <Link href={detailHref} className="fixtures-row__link">
            {content}
          </Link>
        ) : isDb ? (
          <Link href={`/admin/matches/${fixture.id}/edit`} className="fixtures-row__link">
            {content}
          </Link>
        ) : (
          <div className="fixtures-row__link fixtures-row__link--live">{content}</div>
        )}
        <div className="fixtures-row__admin-actions no-print">
          {detailHref && (
            <Link href={detailHref} className="fixtures-row__admin-btn">
              Details
            </Link>
          )}
          {isDb ? (
            <>
              <Link href={`/matches/${fixture.slug}/commentary`} className="fixtures-row__admin-btn">
                Live
              </Link>
              {onDelete && (
                <button
                  type="button"
                  className="fixtures-row__admin-btn fixtures-row__admin-btn--danger"
                  onClick={() => onDelete(fixture.id, label)}
                >
                  Del
                </button>
              )}
            </>
          ) : (
            <Link href="/admin/matches/import" className="fixtures-row__admin-btn">
              Import to CMS
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (detailHref) {
    return (
      <Link href={detailHref} className="fixtures-row">
        {content}
      </Link>
    );
  }

  if (isDb) {
    return (
      <Link href={`/matches/${fixture.slug}/commentary`} className="fixtures-row">
        {content}
      </Link>
    );
  }

  return (
    <div className="fixtures-row fixtures-row--live-only" title="Live from Planet Rugby — not yet in CMS">
      {content}
    </div>
  );
}

export function FixturesScheduleBoard({
  admin = false,
  onDelete,
  selectedFixtureId,
  onSelectFixture,
  initialFixtureId,
}: {
  admin?: boolean;
  onDelete?: (id: string, label: string) => void;
  /** Operator console: highlight and select a CMS fixture for commentary. */
  selectedFixtureId?: string;
  onSelectFixture?: (fixture: ScheduleFixture) => void;
  /** Jump the date strip to this fixture's kickoff day on first load. */
  initialFixtureId?: string;
}) {
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKeyLocal(new Date()));
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [fixtures, setFixtures] = useState<ScheduleFixture[]>([]);
  const [competitions, setCompetitions] = useState<ScheduleCompetition[]>([]);
  const [datesWithMatches, setDatesWithMatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState("");

  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const mergeFixtureDates = useCallback((dates: string[]) => {
    setDatesWithMatches((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const d of dates) {
        if (!next.has(d)) {
          next.add(d);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const fetchDatesForRange = useCallback(
    async (start: string, end: string) => {
      try {
        const params = new URLSearchParams({ start, end, tz: browserTimeZone });
        const res = await fetch(`/api/fixtures/dates?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { dates?: string[] };
        if (data.dates?.length) mergeFixtureDates(data.dates);
      } catch {
        /* non-blocking */
      }
    },
    [browserTimeZone, mergeFixtureDates],
  );

  const fetchMonthDates = useCallback(
    (year: number, monthIndex: number) => {
      const { start, end } = monthBoundsFromYearMonth(year, monthIndex);
      void fetchDatesForRange(start, end);
    },
    [fetchDatesForRange],
  );

  const load = useCallback(async (dateKey: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ date: dateKey, tz: browserTimeZone });
      const res = await fetch(`/api/fixtures/schedule?${params.toString()}`);
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Invalid response from server"
            : `Server error (${res.status}). Try restarting dev: npm run dev:kill-port && npm run dev`,
        );
      }
      if (!res.ok) throw new Error(String(data.error ?? "Failed to load"));
      setFixtures(data.fixtures ?? []);
      setCompetitions(
        (data.competitions ?? []).map((c: ScheduleCompetition) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
      );
      setLiveCount(data.liveCount ?? 0);
      setDatesWithMatches(new Set(data.datesWithMatches ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fixtures");
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [browserTimeZone]);

  useEffect(() => {
    void load(selectedDateKey);
  }, [selectedDateKey, load]);

  useEffect(() => {
    if (!initialFixtureId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/matches/${initialFixtureId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { fixture?: { kickoffAt?: string | null } };
        const ko = data.fixture?.kickoffAt;
        if (ko) {
          const dateKey = kickoffDateKey(ko, browserTimeZone) ?? dateKeyLocal(new Date(ko));
          setSelectedDateKey(dateKey);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialFixtureId, browserTimeZone]);

  const operatorMode = Boolean(onSelectFixture);

  const competitionById = useMemo(
    () => Object.fromEntries(competitions.map((c) => [c.id, c])),
    [competitions],
  );

  const matchDateKeys = useMemo(() => {
    if (datesWithMatches.has(selectedDateKey)) return datesWithMatches;
    const keys = new Set(datesWithMatches);
    keys.add(selectedDateKey);
    return keys;
  }, [datesWithMatches, selectedDateKey]);

  const competitionOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const f of fixtures) {
      const name = competitionDisplayName(f, competitionById);
      const normalized = name.trim().toLowerCase();
      if (!options.has(normalized)) options.set(normalized, name);
    }
    return [...options.entries()]
      .map(([, name]) => ({ id: `name:${name}`, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fixtures, competitionById]);

  const filtered = useMemo(() => {
    if (competitionFilter === "all") return fixtures;
    if (competitionFilter.startsWith("sdms:")) {
      const id = competitionFilter.slice(5);
      return fixtures.filter((f) => f.sdmsCompetitionId === id);
    }
    if (competitionFilter.startsWith("name:")) {
      const name = competitionFilter.slice(5);
      return fixtures.filter((f) => competitionDisplayName(f, competitionById) === name);
    }
    return fixtures.filter((f) => f.competitionId === competitionFilter);
  }, [fixtures, competitionFilter, competitionById]);

  const groups = useMemo(
    () => groupByCompetition(filtered, competitionById),
    [filtered, competitionById],
  );

  return (
      <div className="cms-card fixtures-schedule">
      <div className="fixtures-schedule__filters">
        <label className="fixtures-competition-select text-sm">
          <span className="sr-only">Competition</span>
          <select
            className="cms-input w-full"
            value={competitionFilter}
            onChange={(e) => setCompetitionFilter(e.target.value)}
          >
            <option value="all">All competitions</option>
            {competitionOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MatchDatePicker
        selectedKey={selectedDateKey}
        onSelect={setSelectedDateKey}
        matchDateKeys={matchDateKeys}
        onFetchMonthDates={fetchMonthDates}
      />

      {error && <p className="text-red-400 text-sm m-0 mb-3">{error}</p>}

      {loading ? (
        <p className="text-zinc-500 text-sm py-8 text-center">Loading fixtures from Planet Rugby SDMS…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0 py-8 text-center">
          No matches on this date
          {competitionFilter !== "all" ? " for this competition" : ""}.
          {liveCount === 0 && selectedDateKey === dateKeyLocal(new Date()) && (
            <span className="block mt-2 text-xs text-zinc-600">
              Checked live SDMS feed (same source as planetrugby.com/fixtures).
            </span>
          )}
        </p>
      ) : (
        <>
          {liveCount > 0 && (
            <p className="text-xs text-zinc-600 m-0 mb-3">
              {liveCount} match{liveCount === 1 ? "" : "es"} from Planet Rugby SDMS
              {fixtures.some((f) => f.source === "sdms") ? " (some not yet imported to CMS)" : ""}.
            </p>
          )}
          <div className="fixtures-schedule__groups">
          {groups.map((group) => {
            const season =
              seasonFromDateKey(group.fixtures[0]?.matchDate ?? null) ??
              group.fixtures[0]?.seasonLabel;
            return (
            <section key={group.key} className="fixtures-competition-block">
              <header className="fixtures-competition-block__header">
                <span className="fixtures-competition-block__icon" aria-hidden>
                  🌐
                </span>
                <span className="fixtures-competition-block__title">
                  {group.label}
                  {season ? ` · ${season}` : ""}
                </span>
                  {group.slug && (
                    <Link
                      href={`/competitions/${group.slug}/results`}
                      className="fixtures-competition-block__pin"
                      title="View league"
                    >
                      📌
                    </Link>
                  )}
                </header>
                <div className="fixtures-competition-block__rows">
                  {group.fixtures.map((f) => (
                    <CompactMatchRow
                      key={f.id}
                      fixture={f}
                      admin={admin && !operatorMode}
                      onDelete={onDelete}
                      operatorSelect={
                        operatorMode
                          ? {
                              selected: f.source !== "sdms" && selectedFixtureId === f.id,
                              onSelect: () => {
                                if (f.source !== "sdms") onSelectFixture?.(f);
                              },
                            }
                          : undefined
                      }
                    />
                  ))}
              </div>
            </section>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
