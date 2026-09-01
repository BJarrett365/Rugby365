"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchDatePicker } from "./MatchDatePicker";
import { MatchMediaIcon, type MatchMediaIconVariant } from "./MatchMediaIcons";
import { TeamCrest } from "./TeamCrest";
import { WeatherIcon } from "./WeatherIcon";
import {
  competitionDisplayName,
  dateKeyLocal,
  formatPublicDateHeader,
  groupByCompetition,
  isFinished,
  kickoffDateKey,
  latestDateOnOrBefore,
  matchDetailHref,
  matchStatusShort,
  monthBoundsFromYearMonth,
  publicMatchRoundLabel,
  publicMatchStatusLabel,
  seasonFromDateKey,
  type ScheduleCompetition,
  type ScheduleFixture,
} from "./match-schedule-utils";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { matchDetailTabHref } from "@/lib/match-detail-tabs";
import { resolveWeatherCondition } from "@/lib/weather-condition";
import { publicTeamDisplayName } from "@/lib/table-lab/standings-fixture-dedupe";

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
  const home = publicTeamDisplayName(fixture.homeTeam?.name) || "TBC";
  const away = publicTeamDisplayName(fixture.awayTeam?.name) || "TBC";
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

  return (
    <div className="fixtures-row fixtures-row--live-only" title="Match Centre link unavailable">
      {content}
    </div>
  );
}

function scoreOutcome(homeScore: number, awayScore: number): {
  homeWon: boolean;
  awayWon: boolean;
} | null {
  if (homeScore === awayScore) return null;
  return { homeWon: homeScore > awayScore, awayWon: awayScore > homeScore };
}

type ScheduleMediaAction = {
  tab: MatchDetailTab;
  title: string;
  variant: MatchMediaIconVariant;
  label: string;
};

function scheduleMediaActions(fixture: ScheduleFixture): ScheduleMediaAction[] {
  const actions: ScheduleMediaAction[] = [];
  if (fixture.hasAudio) {
    actions.push({
      tab: "audio",
      title: "Live Audio Commentary",
      variant: "listen",
      label: "Audio",
    });
  }
  if (fixture.hasAnimation) {
    actions.push({
      tab: "animation",
      title: "Match Animation",
      variant: "animation",
      label: "Animation",
    });
  }
  if (fixture.hasWatchalong) {
    actions.push({
      tab: "watchalong",
      title: "Watchalong",
      variant: "watchalong",
      label: "Watchalong",
    });
  }
  if (fixture.hasHighlights) {
    actions.push({
      tab: "highlights",
      title: "Match Highlights",
      variant: "highlights",
      label: "Highlights",
    });
  }
  return actions;
}

function TeamMetrics({
  showScores,
  score,
  winPct,
  teamName,
  resultWon,
  finished,
}: {
  showScores: boolean;
  score: number;
  winPct: number | null;
  teamName: string;
  resultWon: boolean | null;
  finished: boolean;
}) {
  const winLabel = finished ? `${teamName} won` : `${teamName} winning`;
  const lossLabel = finished ? `${teamName} lost` : `${teamName} losing`;
  return (
    <>
      <span className="pr-mc-team__score" aria-hidden={!showScores}>
        {showScores ? score : "–"}
      </span>
      <span
        className="pr-mc-team__winpct"
        title={winPct != null ? `${teamName} win probability ${winPct}%` : undefined}
      >
        <span className="pr-mc-team__winpct-num">
          {winPct != null ? `${winPct}%` : resultWon != null ? "" : "–"}
        </span>
        <span className="pr-mc-team__pick-slot">
          {resultWon != null ? (
            <span
              className={
                resultWon
                  ? "pr-mc-team__pick pr-mc-team__pick--ok"
                  : "pr-mc-team__pick pr-mc-team__pick--bad"
              }
              title={resultWon ? winLabel : lossLabel}
              aria-label={resultWon ? winLabel : lossLabel}
            >
              {resultWon ? "✓" : "✗"}
            </span>
          ) : null}
        </span>
      </span>
    </>
  );
}

function PublicMatchRow({ fixture }: { fixture: ScheduleFixture }) {
  const home = publicTeamDisplayName(fixture.homeTeam?.name) || "TBC";
  const away = publicTeamDisplayName(fixture.awayTeam?.name) || "TBC";
  const showScores =
    fixture.status === "full_time" ||
    fixture.status === "live" ||
    fixture.status === "half_time" ||
    /result|finished|ft/i.test(fixture.status);
  const detailHref = matchDetailHref(fixture);
  const status = publicMatchStatusLabel(fixture.status, fixture.kickoffAt, fixture.matchDate);
  const hasHt =
    fixture.halfTimeHome != null &&
    fixture.halfTimeAway != null &&
    Number.isFinite(fixture.halfTimeHome) &&
    Number.isFinite(fixture.halfTimeAway);
  const tvTitle = fixture.tvLabels?.length ? fixture.tvLabels.join(" · ") : null;
  const weatherTitle = fixture.weather?.summary ?? null;
  const infoTitle = fixture.additionalInfo ?? null;
  const refereeTitle = fixture.refereeName?.trim() || null;
  const venueTitle = fixture.venue?.trim() || null;
  const attendanceTitle =
    fixture.attendance != null
      ? `Attendance ${fixture.attendance.toLocaleString("en-GB")}`
      : null;
  const hasFooter =
    Boolean(venueTitle) ||
    Boolean(refereeTitle) ||
    Boolean(weatherTitle) ||
    Boolean(attendanceTitle) ||
    Boolean(tvTitle) ||
    Boolean(infoTitle);
  const result = showScores ? scoreOutcome(fixture.homeScore, fixture.awayScore) : null;
  const finished = fixture.status === "full_time" || /result|finished|ft/i.test(fixture.status);
  const wp = fixture.winProbability;
  const mediaActions = scheduleMediaActions(fixture);

  return (
    <article className={`pr-mc-match-row${hasFooter ? " pr-mc-match-row--with-footer" : ""}`}>
      <div className="pr-mc-match-row__meta">
        <span className="pr-mc-match-row__round">{publicMatchRoundLabel(fixture.round)}</span>
      </div>

      <div className="pr-mc-match-row__status">
        <span>{status}</span>
        {hasHt ? (
          <span className="pr-mc-match-row__ht" title="Half-time score">
            HT {fixture.halfTimeHome}–{fixture.halfTimeAway}
          </span>
        ) : null}
      </div>

      <div className="pr-mc-match-row__teams">
        <div className="pr-mc-team pr-mc-team--metrics">
          <TeamCrest name={home} imageUrl={fixture.homeTeam?.imageUrl} size="sm" />
          <span className="pr-mc-team__name">{home}</span>
          <TeamMetrics
            showScores={showScores}
            score={fixture.homeScore}
            winPct={wp?.homeWinPct ?? null}
            teamName={home}
            resultWon={result ? result.homeWon : null}
            finished={finished}
          />
        </div>
        <div className="pr-mc-team pr-mc-team--metrics">
          <TeamCrest name={away} imageUrl={fixture.awayTeam?.imageUrl} size="sm" />
          <span className="pr-mc-team__name">{away}</span>
          <TeamMetrics
            showScores={showScores}
            score={fixture.awayScore}
            winPct={wp?.awayWinPct ?? null}
            teamName={away}
            resultWon={result ? result.awayWon : null}
            finished={finished}
          />
        </div>
      </div>

      <div className="pr-mc-match-row__action">
        {detailHref ? (
          <Link href={detailHref} className="pr-mc-match-info-btn">
            Match Info
          </Link>
        ) : (
          <span className="pr-mc-match-info-btn pr-mc-match-info-btn--disabled">Match Info</span>
        )}
        {detailHref && mediaActions.length > 0 ? (
          <div className="pr-mc-match-row__media" aria-label="Match media">
            {mediaActions.map((action) => (
              <Link
                key={action.tab}
                href={matchDetailTabHref(detailHref, action.tab)}
                className={`pr-mc-match-media pr-mc-match-media--${action.variant}`}
                title={action.title}
                aria-label={action.title}
              >
                <MatchMediaIcon
                  variant={action.variant}
                  size={12}
                  className="pr-mc-match-media__icon"
                />
                <span className="sr-only">{action.label}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {hasFooter ? (
        <div className="pr-mc-match-row__footer" aria-label="Match details">
          {venueTitle ? (
            <span className="pr-mc-match-extra" title={venueTitle} aria-label={`Stadium: ${venueTitle}`}>
              <span className="pr-mc-match-extra__icon" aria-hidden>
                S
              </span>
              <span className="pr-mc-match-extra__text">{venueTitle}</span>
            </span>
          ) : null}
          {refereeTitle ? (
            <span
              className="pr-mc-match-extra"
              title={`Referee: ${refereeTitle}`}
              aria-label={`Referee: ${refereeTitle}`}
            >
              <span className="pr-mc-match-extra__icon" aria-hidden>
                R
              </span>
              <span className="pr-mc-match-extra__text">Ref {refereeTitle}</span>
            </span>
          ) : null}
          {weatherTitle ? (
            <span
              className="pr-mc-match-extra"
              title={weatherTitle}
              aria-label={`Weather: ${weatherTitle}`}
            >
              <span className="pr-mc-match-extra__icon pr-mc-match-extra__icon--weather" aria-hidden>
                <WeatherIcon
                  kind={
                    fixture.weather?.icon ??
                    resolveWeatherCondition({
                      summary: fixture.weather?.conditionLabel ?? fixture.weather?.summary,
                    }).kind
                  }
                  title={fixture.weather?.conditionLabel ?? undefined}
                />
              </span>
              <span className="pr-mc-match-extra__text">
                {fixture.weather?.temperatureC != null
                  ? `${Math.round(fixture.weather.temperatureC)}°C`
                  : fixture.weather?.conditionLabel && fixture.weather.conditionLabel !== "Weather"
                    ? fixture.weather.conditionLabel
                    : "Weather"}
                {fixture.weather?.windSpeedKmh != null
                  ? ` · ${Math.round(fixture.weather.windSpeedKmh)} km/h${
                      fixture.weather.windCompass ? ` ${fixture.weather.windCompass}` : ""
                    }`
                  : ""}
              </span>
            </span>
          ) : null}
          {attendanceTitle ? (
            <span
              className="pr-mc-match-extra"
              title={attendanceTitle}
              aria-label={attendanceTitle}
            >
              <span className="pr-mc-match-extra__icon" aria-hidden>
                A
              </span>
              <span className="pr-mc-match-extra__text">{attendanceTitle}</span>
            </span>
          ) : null}
          {tvTitle ? (
            <span className="pr-mc-match-extra" title={tvTitle} aria-label={`TV: ${tvTitle}`}>
              <span className="pr-mc-match-extra__icon" aria-hidden>
                TV
              </span>
              <span className="pr-mc-match-extra__text">{tvTitle}</span>
            </span>
          ) : null}
          {infoTitle ? (
            <span className="pr-mc-match-extra" title={infoTitle} aria-label={infoTitle}>
              <span className="pr-mc-match-extra__icon" aria-hidden>
                i
              </span>
              <span className="pr-mc-match-extra__text">{infoTitle}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function nearestDateKey(target: string, dates: string[]): string | null {
  if (!dates.length) return null;
  if (dates.includes(target)) return target;
  const sorted = [...dates].sort();
  // Prefer next upcoming date on/after target; else last previous.
  const upcoming = sorted.find((d) => d >= target);
  if (upcoming) return upcoming;
  return sorted[sorted.length - 1] ?? null;
}

export function FixturesScheduleBoard({
  admin = false,
  variant = "admin",
  onDelete,
  selectedFixtureId,
  onSelectFixture,
  initialFixtureId,
  view = "fixtures",
}: {
  admin?: boolean;
  /** Public Planet Rugby list layout. Default keeps existing admin/operator behaviour. */
  variant?: "public" | "admin";
  onDelete?: (id: string, label: string) => void;
  /** Operator console: highlight and select a CMS fixture for commentary. */
  selectedFixtureId?: string;
  onSelectFixture?: (fixture: ScheduleFixture) => void;
  /** Jump the date strip to this fixture's kickoff day on first load. */
  initialFixtureId?: string;
  /** Public Live Centre: Results opens the latest completed match day. */
  view?: "fixtures" | "results";
}) {
  const isPublic = variant === "public";
  // null until mount so SSR HTML matches the client's first paint (avoids TZ hydration drift).
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [fixtures, setFixtures] = useState<ScheduleFixture[]>([]);
  const [competitions, setCompetitions] = useState<ScheduleCompetition[]>([]);
  /** Competitions that have fixtures in the selected calendar year (Live Centre picker). */
  const [yearCompetitions, setYearCompetitions] = useState<ScheduleCompetition[]>([]);
  const [fixtureYears, setFixtureYears] = useState<number[]>([]);
  const [datesWithMatches, setDatesWithMatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState("");
  const [browserTimeZone, setBrowserTimeZone] = useState("Europe/London");
  const resultsJumpedRef = useRef(false);

  useEffect(() => {
    setBrowserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London");
    setSelectedDateKey(dateKeyLocal(new Date()));
  }, []);

  useEffect(() => {
    resultsJumpedRef.current = false;
  }, [view]);

  useEffect(() => {
    if (view !== "results" || resultsJumpedRef.current || datesWithMatches.size === 0) return;
    const latest = latestDateOnOrBefore(datesWithMatches, dateKeyLocal(new Date()));
    if (!latest) return;
    resultsJumpedRef.current = true;
    if (latest !== selectedDateKey) setSelectedDateKey(latest);
  }, [view, datesWithMatches, selectedDateKey]);

  const seasonYear =
    (selectedDateKey ? seasonFromDateKey(selectedDateKey) : null) ?? String(new Date().getFullYear());

  const seasonChoices = useMemo(() => {
    const current = Number(seasonYear);
    const fromApi = fixtureYears.map(String);
    if (!fromApi.length) {
      // Fallback until /api/fixtures/years resolves.
      if (!Number.isFinite(current)) return [String(new Date().getFullYear())];
      return [String(current - 1), String(current), String(current + 1)];
    }
    const set = new Set(fromApi);
    if (Number.isFinite(current)) set.add(String(current));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [fixtureYears, seasonYear]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/fixtures/years");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { years?: number[] };
        if (!cancelled && data.years?.length) setFixtureYears(data.years);
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const year = Number(seasonYear);
    if (!Number.isFinite(year)) return;
    void (async () => {
      try {
        const params = new URLSearchParams({
          year: String(year),
          tz: browserTimeZone,
        });
        const res = await fetch(`/api/fixtures/competitions?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { competitions?: ScheduleCompetition[] };
        if (cancelled) return;
        const list = data.competitions ?? [];
        setYearCompetitions(list);
        // Drop a stale competition filter when switching years.
        setCompetitionFilter((prev) => {
          if (prev === "all") return prev;
          return list.some((c) => c.id === prev) ? prev : "all";
        });
      } catch {
        if (!cancelled) setYearCompetitions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonYear, browserTimeZone]);

  const competitionIdParam =
    competitionFilter !== "all" && !competitionFilter.startsWith("name:") && !competitionFilter.startsWith("sdms:")
      ? competitionFilter
      : null;

  const fetchDatesForRange = useCallback(
    async (start: string, end: string, replace = false) => {
      try {
        const params = new URLSearchParams({ start, end, tz: browserTimeZone });
        if (competitionIdParam) params.set("competitionId", competitionIdParam);
        const res = await fetch(`/api/fixtures/dates?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { dates?: string[] };
        const dates = data.dates ?? [];
        if (replace) {
          setDatesWithMatches(new Set(dates));
        } else {
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
        }
      } catch {
        /* non-blocking */
      }
    },
    [browserTimeZone, competitionIdParam],
  );

  const fetchMonthDates = useCallback(
    (year: number, monthIndex: number) => {
      const { start, end } = monthBoundsFromYearMonth(year, monthIndex);
      void fetchDatesForRange(start, end, false);
    },
    [fetchDatesForRange],
  );

  // When competition filter changes, reload the year’s date highlights and jump to a real match day.
  useEffect(() => {
    if (!selectedDateKey) return;
    const year = Number(seasonYear);
    if (!Number.isFinite(year)) return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({
          start: `${year}-01-01`,
          end: `${year}-12-31`,
          tz: browserTimeZone,
        });
        if (competitionIdParam) params.set("competitionId", competitionIdParam);
        const res = await fetch(`/api/fixtures/dates?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { dates?: string[] };
        const dates = data.dates ?? [];
        if (cancelled) return;
        setDatesWithMatches(new Set(dates));
        if (competitionIdParam && dates.length) {
          const next = nearestDateKey(selectedDateKey, dates);
          if (next && next !== selectedDateKey) {
            setSelectedDateKey(next);
          }
        }
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit selectedDateKey — only re-run when year/competition/tz change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jump once per competition/year change
  }, [competitionIdParam, seasonYear, browserTimeZone]);

  const load = useCallback(async (dateKey: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError("");
    }
    try {
      const params = new URLSearchParams({ date: dateKey, tz: browserTimeZone, lite: "1" });
      if (competitionIdParam) params.set("competitionId", competitionIdParam);
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
      setFixtures((data.fixtures as ScheduleFixture[]) ?? []);
      setCompetitions(
        ((data.competitions as ScheduleCompetition[]) ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
      );
      setLiveCount((data.liveCount as number) ?? 0);
      const nextDates = (data.datesWithMatches as string[]) ?? [];
      if (nextDates.length && !competitionIdParam) {
        setDatesWithMatches((prev) => {
          const next = new Set(prev);
          for (const d of nextDates) next.add(d);
          return next;
        });
      }
    } catch (e) {
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : "Failed to load fixtures");
        setFixtures([]);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [browserTimeZone, competitionIdParam]);

  useEffect(() => {
    if (!selectedDateKey) return;
    void load(selectedDateKey);
  }, [selectedDateKey, load]);

  useEffect(() => {
    if (!isPublic || !selectedDateKey) return;
    if (selectedDateKey !== dateKeyLocal(new Date())) return;
    const refresh = () => {
      void load(selectedDateKey, { silent: true });
    };
    const quick = window.setTimeout(refresh, 8000);
    const poll = window.setInterval(refresh, 45_000);
    return () => {
      window.clearTimeout(quick);
      window.clearInterval(poll);
    };
  }, [isPublic, selectedDateKey, load]);

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

  const competitionById = useMemo(() => {
    const map: Record<string, ScheduleCompetition> = {};
    for (const c of competitions) map[c.id] = c;
    for (const c of yearCompetitions) map[c.id] = c;
    return map;
  }, [competitions, yearCompetitions]);

  const matchDateKeys = useMemo(() => datesWithMatches, [datesWithMatches]);

  const competitionOptions = useMemo(() => {
    // Prefer year-scoped CMS comps so RWC etc. stay selectable off-match-days,
    // then fall back to the full schedule catalogue (skipping legacy duplicates).
    const options = new Map<string, { id: string; name: string; slug: string }>();
    const catalogue = yearCompetitions.length ? yearCompetitions : competitions;
    for (const c of catalogue) {
      if (c.slug.includes("__legacy__")) continue;
      const name = (c.name || c.slug).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = options.get(key);
      // Prefer shorter, non-suffixed slugs when the same display name appears twice.
      const prefer =
        !existing ||
        (!/-[a-f0-9]{6,}$/i.test(c.slug) && /-[a-f0-9]{6,}$/i.test(existing.slug)) ||
        (!/-\d+$/.test(c.slug) && /-\d+$/.test(existing.slug)) ||
        c.slug.length < existing.slug.length;
      if (prefer) options.set(key, { id: c.id, name, slug: c.slug });
    }
    // Year-scoped CMS comps (RWC etc.) stay selectable on off-match days.
    for (const c of yearCompetitions) {
      const name = (c.name || c.slug).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!options.has(key)) options.set(key, { id: c.id, name, slug: c.slug });
    }
    // Ensure comps that appear on the selected day are still selectable even if
    // they were missing from the catalogue payload for any reason.
    for (const f of fixtures) {
      const name = competitionDisplayName(f, competitionById);
      const key = name.trim().toLowerCase();
      if (!key || options.has(key)) continue;
      if (f.competitionId) {
        options.set(key, { id: f.competitionId, name, slug: f.competitionId });
      } else {
        options.set(key, { id: `name:${name}`, name, slug: `name:${name}` });
      }
    }
    return [...options.values()]
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [yearCompetitions, competitions, fixtures, competitionById]);

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

  const onSeasonChange = (year: string) => {
    if (!selectedDateKey) return;
    const rest = selectedDateKey.slice(4);
    const nextKey = `${year}${rest}`;
    const parsed = Number(year);
    if (!Number.isFinite(parsed)) return;
    // Clamp invalid dates (e.g. Feb 29) via Date constructor
    const [, m, d] = nextKey.split("-").map(Number);
    const safe = dateKeyLocal(new Date(parsed, (m ?? 1) - 1, d ?? 1));
    setSelectedDateKey(safe);
  };

  const boardClass = isPublic
    ? "pr-mc-fixtures-board"
    : "cms-card fixtures-schedule";

  if (!selectedDateKey) {
    return (
      <div className={boardClass}>
        <p className="text-zinc-500 text-sm py-8 text-center">Loading fixtures…</p>
      </div>
    );
  }

  return (
    <div className={boardClass}>
      <div className={isPublic ? "pr-mc-fixtures-board__filters" : "fixtures-schedule__filters"}>
        {isPublic ? (
          <>
            <MatchDatePicker
              key={`mdp-${competitionFilter}-${seasonYear}`}
              selectedKey={selectedDateKey}
              onSelect={setSelectedDateKey}
              matchDateKeys={matchDateKeys}
              onFetchMonthDates={fetchMonthDates}
              variant="public"
              hideHeader
              showMonthStrip
            />
            <div className="pr-mc-fixtures-board__selects">
              <label className="pr-mc-filter-select">
                <span className="sr-only">Competition</span>
                <select
                  value={competitionFilter}
                  onChange={(e) => setCompetitionFilter(e.target.value)}
                >
                  <option value="all">All Competitions</option>
                  {competitionOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pr-mc-filter-select">
                <span className="sr-only">Season</span>
                <select value={seasonYear} onChange={(e) => onSeasonChange(e.target.value)}>
                  {seasonChoices.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
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
        )}
      </div>

      {!isPublic && (
        <MatchDatePicker
          selectedKey={selectedDateKey}
          onSelect={setSelectedDateKey}
          matchDateKeys={matchDateKeys}
          onFetchMonthDates={fetchMonthDates}
        />
      )}

      {isPublic && (
        <div className="pr-mc-date-header">{formatPublicDateHeader(selectedDateKey)}</div>
      )}

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
          {!isPublic && liveCount > 0 && (
            <p className="text-xs text-zinc-600 m-0 mb-3">
              {liveCount} match{liveCount === 1 ? "" : "es"} from Planet Rugby SDMS
              {fixtures.some((f) => f.source === "sdms") ? " (some not yet imported to CMS)" : ""}.
            </p>
          )}
          <div className={isPublic ? "pr-mc-fixtures-board__groups" : "fixtures-schedule__groups"}>
            {groups.map((group) => {
              const season =
                seasonFromDateKey(group.fixtures[0]?.matchDate ?? null) ??
                group.fixtures[0]?.seasonLabel;
              const publicLabel = competitionDisplayName(
                group.fixtures[0]!,
                competitionById,
              );
              return (
                <section
                  key={group.key}
                  className={isPublic ? "pr-mc-competition-block" : "fixtures-competition-block"}
                >
                  <header
                    className={
                      isPublic
                        ? "pr-mc-competition-block__header"
                        : "fixtures-competition-block__header"
                    }
                  >
                    {isPublic ? (
                      <>
                        <span className="pr-mc-competition-block__title">{publicLabel}</span>
                        {group.slug ? (
                          <Link
                            href={`/competitions/${group.slug}/table`}
                            className="pr-mc-competition-block__table"
                          >
                            Full Table
                          </Link>
                        ) : null}
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </header>
                  <div
                    className={
                      isPublic
                        ? "pr-mc-competition-block__rows"
                        : "fixtures-competition-block__rows"
                    }
                  >
                    {group.fixtures.map((f) =>
                      isPublic ? (
                        <PublicMatchRow key={f.id} fixture={f} />
                      ) : (
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
                      ),
                    )}
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
