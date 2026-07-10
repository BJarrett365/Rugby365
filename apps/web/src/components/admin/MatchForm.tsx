"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";
import {
  buildFixtureSlug,
  FIXTURE_SLUG_FORMAT_OPTIONS,
  type FixtureSlugFormat,
} from "@/lib/fixture-slug";

type Team = { id: string; name: string; slug: string; homeVenueId?: string | null };
type Venue = {
  id: string;
  name: string;
  city?: string | null;
  countryName?: string | null;
  capacity?: number | null;
  recordAttendance?: number | null;
  teamId?: string | null;
};
type Referee = { id: string; name: string; countryName?: string | null };
type Coach = { id: string; name: string; coachedCountries?: string[] };

export type MatchFormValues = {
  slug: string;
  homeTeamId: string;
  awayTeamId: string;
  competitionName: string;
  kickoffAt: string;
  status: string;
  sport365Url: string;
  planetRugbyUrl: string;
  venueId: string;
  attendance: string;
  refereeId: string;
  homeCoachId: string;
  awayCoachId: string;
  round: string;
};

const STATUS_OPTIONS = ["scheduled", "live", "half_time", "full_time", "postponed", "cancelled"];

export function MatchForm({
  initial,
  fixtureId,
  submitLabel,
  onSynced,
}: {
  initial?: Partial<MatchFormValues>;
  fixtureId?: string;
  submitLabel: string;
  onSynced?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [allCoaches, setAllCoaches] = useState<Coach[]>([]);
  const [homeTeamCoaches, setHomeTeamCoaches] = useState<Coach[]>([]);
  const [awayTeamCoaches, setAwayTeamCoaches] = useState<Coach[]>([]);
  const [teamsError, setTeamsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [importPreview, setImportPreview] = useState<string>("");
  const [error, setError] = useState("");
  const [enrichingPr, setEnrichingPr] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState("");
  const [syncingCapacity, setSyncingCapacity] = useState(false);
  const [slugFormat, setSlugFormat] = useState<FixtureSlugFormat>("teams-date");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [values, setValues] = useState<MatchFormValues>({
    slug: initial?.slug ?? "",
    homeTeamId: initial?.homeTeamId ?? "",
    awayTeamId: initial?.awayTeamId ?? "",
    competitionName: initial?.competitionName ?? "",
    kickoffAt: initial?.kickoffAt ?? "",
    status: initial?.status ?? "scheduled",
    sport365Url: initial?.sport365Url ?? "",
    planetRugbyUrl: initial?.planetRugbyUrl ?? "",
    venueId: initial?.venueId ?? "",
    attendance: initial?.attendance ?? "",
    refereeId: initial?.refereeId ?? "",
    homeCoachId: initial?.homeCoachId ?? "",
    awayCoachId: initial?.awayCoachId ?? "",
    round: initial?.round ?? "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/teams?grouped=1").then((r) => r.json()),
      fetch("/api/admin/teams").then((r) => r.json()),
      fetch("/api/admin/venues").then((r) => r.json()),
      fetch("/api/admin/referees").then((r) => r.json()),
      fetch("/api/admin/coaches").then((r) => r.json()),
    ])
      .then(([teamsData, allTeamsData, venuesData, refsData, coachesData]) => {
        if (teamsData.error) {
          setTeamsError(teamsData.error ?? "Failed to load teams");
        } else {
          setTeamGroups(teamsData.groups ?? []);
        }
        setTeams(allTeamsData.teams ?? teamsData.teams ?? []);
        setVenues(venuesData.venues ?? []);
        setReferees(refsData.referees ?? []);
        setAllCoaches(coachesData.coaches ?? []);
      })
      .catch(() => setTeamsError("Failed to load teams"));
  }, []);

  useEffect(() => {
    if (!values.homeTeamId) {
      setHomeTeamCoaches([]);
      return;
    }
    fetch(`/api/admin/coaches?countryTeamId=${encodeURIComponent(values.homeTeamId)}`)
      .then((r) => r.json())
      .then((data) => setHomeTeamCoaches(data.coaches ?? []))
      .catch(() => setHomeTeamCoaches([]));
  }, [values.homeTeamId]);

  useEffect(() => {
    if (!values.awayTeamId) {
      setAwayTeamCoaches([]);
      return;
    }
    fetch(`/api/admin/coaches?countryTeamId=${encodeURIComponent(values.awayTeamId)}`)
      .then((r) => r.json())
      .then((data) => setAwayTeamCoaches(data.coaches ?? []))
      .catch(() => setAwayTeamCoaches([]));
  }, [values.awayTeamId]);

  const reloadVenues = useCallback(async () => {
    const res = await fetch("/api/admin/venues");
    const data = await res.json();
    setVenues(data.venues ?? []);
  }, []);

  const homeTeam = useMemo(() => teams.find((team) => team.id === values.homeTeamId) ?? null, [teams, values.homeTeamId]);
  const awayTeam = useMemo(() => teams.find((team) => team.id === values.awayTeamId) ?? null, [teams, values.awayTeamId]);

  const suggestedSlug = useMemo(() => {
    if (!homeTeam || !awayTeam) return "";
    return buildFixtureSlug({
      homeSlug: homeTeam.slug,
      awaySlug: awayTeam.slug,
      kickoffAt: values.kickoffAt,
      competitionName: values.competitionName,
      format: slugFormat,
    });
  }, [homeTeam, awayTeam, values.kickoffAt, values.competitionName, slugFormat]);

  useEffect(() => {
    if (fixtureId || slugTouched || !suggestedSlug) return;
    setValues((current) => ({ ...current, slug: suggestedSlug }));
  }, [fixtureId, slugTouched, suggestedSlug]);

  function setField<K extends keyof MatchFormValues>(key: K, value: MatchFormValues[K]) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      return next;
    });
  }

  function applySuggestedSlug() {
    if (!suggestedSlug) return;
    setSlugTouched(false);
    setField("slug", suggestedSlug);
  }

  async function fetchFromSport365() {
    if (!values.sport365Url.trim()) {
      setError("Enter a Sport365 URL first");
      return;
    }
    setFetching(true);
    setError("");
    setImportPreview("");
    const res = await fetch(
      `/api/admin/data-sources/sport365/parse?url=${encodeURIComponent(values.sport365Url.trim())}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Fetch failed");
      setFetching(false);
      return;
    }
    if (data.kind === "tournament") {
      setError("This is a competition URL — use Import Sport365 to select multiple matches.");
      setFetching(false);
      return;
    }

    const home = teams.find((t) => t.id === data.resolvedTeams?.home?.id);
    const away = teams.find((t) => t.id === data.resolvedTeams?.away?.id);

    setValues((v) => ({
      ...v,
      slug:
        v.slug ||
        buildFixtureSlug({
          homeSlug: home?.slug ?? data.resolvedTeams?.home?.slug ?? "",
          awaySlug: away?.slug ?? data.resolvedTeams?.away?.slug ?? "",
          kickoffAt: data.kickoffAt ? toDatetimeLocal(data.kickoffAt) : v.kickoffAt,
          competitionName: data.competition ?? v.competitionName,
          format: slugFormat,
        }) ||
        data.suggestedSlug ||
        v.slug,
      homeTeamId: home?.id ?? v.homeTeamId,
      awayTeamId: away?.id ?? v.awayTeamId,
      competitionName: data.competition ?? v.competitionName,
      kickoffAt: data.kickoffAt ? toDatetimeLocal(data.kickoffAt) : v.kickoffAt,
      status: mapSport365Status(data.status) ?? v.status,
    }));

    const scoreLine = `${data.homeTeam} ${data.homeScore}–${data.awayScore} ${data.awayTeam}`;
    const extras = [
      data.incidentCount ? `${data.incidentCount} incidents` : null,
      data.venue?.name ? data.venue.name : null,
      !home || !away ? "Some teams not in DB — pick manually or use Import page" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    setImportPreview(`${scoreLine}${extras ? ` · ${extras}` : ""}`);
    setFetching(false);
  }

  function coachOptions(teamCoaches: Coach[], teamLabel: string) {
    const teamIds = new Set(teamCoaches.map((coach) => coach.id));
    const otherCoaches = allCoaches.filter((coach) => !teamIds.has(coach.id));
    return { teamCoaches, otherCoaches, teamLabel };
  }

  function formatCoachLabel(coach: Coach) {
    if (!coach.coachedCountries?.length) return coach.name;
    return `${coach.name} (${coach.coachedCountries.slice(0, 2).join(", ")}${coach.coachedCountries.length > 2 ? "…" : ""})`;
  }

  async function useCurrentHeadCoach(side: "home" | "away") {
    const teamId = side === "home" ? values.homeTeamId : values.awayTeamId;
    if (!teamId) return;
    const res = await fetch(`/api/admin/teams/${teamId}/coaching-staff`);
    const data = await res.json();
    const current = (data.coachingStaff?.current ?? []) as Array<{ coachId: string; role: string }>;
    const headCoach =
      current.find((row) => row.role === "head_coach") ??
      current.find((row) => row.role === "director_of_rugby") ??
      current[0];
    if (!headCoach) return;
    setField(side === "home" ? "homeCoachId" : "awayCoachId", headCoach.coachId);
  }

  const homeCoachOpts = useMemo(
    () => coachOptions(homeTeamCoaches, homeTeam?.name ?? "Home team"),
    [homeTeamCoaches, allCoaches, homeTeam?.name],
  );
  const awayCoachOpts = useMemo(
    () => coachOptions(awayTeamCoaches, awayTeam?.name ?? "Away team"),
    [awayTeamCoaches, allCoaches, awayTeam?.name],
  );
  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === values.venueId) ?? null,
    [venues, values.venueId],
  );

  const homeTeamVenue = useMemo(() => {
    const homeTeam = teams.find((team) => team.id === values.homeTeamId);
    if (homeTeam?.homeVenueId) {
      return venues.find((venue) => venue.id === homeTeam.homeVenueId) ?? null;
    }
    return venues.find((venue) => venue.teamId === values.homeTeamId) ?? null;
  }, [teams, venues, values.homeTeamId]);

  const attendanceNumber = values.attendance ? Number(values.attendance) : null;

  function formatVenueLabel(venue: Venue) {
    const parts = [venue.name];
    if (venue.city) parts.push(venue.city);
    const meta = parts.join(", ");
    return venue.capacity != null ? `${meta} · ${venue.capacity.toLocaleString()}` : meta;
  }

  async function enrichFromPlanetRugby() {
    if (!fixtureId) return;
    setEnrichingPr(true);
    setEnrichMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/enrich-planet-rugby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceEvents: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planet Rugby enrich failed");

      if (data.detail?.fixture) {
        const fixture = data.detail.fixture;
        setValues((current) => ({
          ...current,
          venueId: fixture.venueId ?? current.venueId,
          attendance: fixture.attendance != null ? String(fixture.attendance) : current.attendance,
          refereeId: fixture.refereeId ?? current.refereeId,
          homeCoachId: fixture.homeCoachId ?? current.homeCoachId,
          awayCoachId: fixture.awayCoachId ?? current.awayCoachId,
          kickoffAt: fixture.kickoffAt ? toDatetimeLocal(fixture.kickoffAt) : current.kickoffAt,
          status: fixture.status ?? current.status,
          round: fixture.round ?? current.round,
        }));
      }

      const venueLabel = data.detail?.fixture?.venue?.name ?? data.detail?.fixture?.venueName ?? "venue";
      const capacity = data.detail?.fixture?.venue?.capacity;
      setEnrichMessage(
        `Synced from Planet Rugby — ${venueLabel}${capacity != null ? ` · capacity ${capacity.toLocaleString()} (database)` : ""}`,
      );
      await reloadVenues();
      await onSynced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planet Rugby enrich failed");
    } finally {
      setEnrichingPr(false);
    }
  }

  async function syncVenueCapacityToDatabase() {
    if (!values.venueId) return;
    setSyncingCapacity(true);
    setEnrichMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/venues/${values.venueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-capacity" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Capacity sync failed");
      await reloadVenues();
      const capacity = data.venue?.capacity ?? data.result?.capacity;
      setEnrichMessage(
        data.result?.updated
          ? `Capacity saved to database${capacity != null ? `: ${Number(capacity).toLocaleString()}` : ""}`
          : capacity != null
            ? `Capacity already in database: ${Number(capacity).toLocaleString()}`
            : "No capacity source found for this venue yet",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capacity sync failed");
    } finally {
      setSyncingCapacity(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      ...values,
      kickoffAt: values.kickoffAt ? new Date(values.kickoffAt).toISOString() : null,
      sport365Url: values.sport365Url || null,
      planetRugbyUrl: values.planetRugbyUrl || null,
      venueId: values.venueId || null,
      attendance: values.attendance ? Number(values.attendance) : null,
      refereeId: values.refereeId || null,
      homeCoachId: values.homeCoachId || null,
      awayCoachId: values.awayCoachId || null,
      round: values.round || null,
    };
    const url = fixtureId ? `/api/admin/matches/${fixtureId}` : "/api/admin/matches";
    const method = fixtureId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      setLoading(false);
      return;
    }
    router.push("/admin/matches");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="cms-card space-y-5 max-w-4xl">
      <h3 className="cms-section-title">Edit fixture</h3>
      {teamsError && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3">
          <p className="text-amber-200 text-sm m-0">{teamsError}</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm m-0">{error}</p>}

      <div className="cms-grid-2">
        <label>
          Home team
          <GroupedTeamSelect
            required
            value={values.homeTeamId}
            onChange={(value) => setField("homeTeamId", value)}
            groups={teamGroups}
          />
        </label>
        <label>
          Away team
          <GroupedTeamSelect
            required
            value={values.awayTeamId}
            onChange={(value) => setField("awayTeamId", value)}
            groups={teamGroups}
          />
        </label>
      </div>

      <label>
        Competition
        <input
          value={values.competitionName}
          onChange={(e) => setField("competitionName", e.target.value)}
          placeholder="International Matches"
          className="cms-input"
        />
      </label>

      <div className="cms-grid-2">
        <label>
          Kickoff (local date & time)
          <input
            type="datetime-local"
            value={values.kickoffAt}
            onChange={(e) => setField("kickoffAt", e.target.value)}
            className="cms-input"
          />
        </label>
        <label>
          Status
          <select
            value={values.status}
            onChange={(e) => setField("status", e.target.value)}
            className="cms-select"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cms-card--nested p-4 space-y-3">
        <p className="cms-section-title text-sm m-0">URL slug</p>
        <label>
          Slug format
          <select
            value={slugFormat}
            onChange={(e) => setSlugFormat(e.target.value as FixtureSlugFormat)}
            className="cms-select"
          >
            {FIXTURE_SLUG_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.example}
              </option>
            ))}
          </select>
        </label>
        {suggestedSlug ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">Suggested:</span>
            <code className="text-emerald-400 text-xs">{suggestedSlug}</code>
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs touch-target"
              onClick={applySuggestedSlug}
            >
              Use suggested slug
            </button>
          </div>
        ) : null}
        <label>
          URL slug
          <input
            required
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setField("slug", e.target.value);
            }}
            placeholder="new-zealand-v-italy-2026-07-11"
            className="cms-input"
          />
          <span className="text-xs text-zinc-600 mt-1 block">
            Commentary: /matches/{values.slug || "slug"}/commentary
          </span>
        </label>
      </div>

      <div className="cms-card--nested p-4 space-y-3">
        <p className="cms-section-title text-sm m-0">Venue &amp; capacity</p>
        <div className="cms-grid-2">
          <label>
            Venue
            <select
              value={values.venueId}
              onChange={(e) => setField("venueId", e.target.value)}
              className="cms-select"
            >
              <option value="">None</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVenueLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Attendance
            <input
              type="number"
              min={0}
              value={values.attendance}
              onChange={(e) => setField("attendance", e.target.value)}
              placeholder="e.g. 78500"
              className="cms-input"
            />
          </label>
        </div>

        {selectedVenue ? (
          <div className="text-sm text-zinc-500 space-y-1">
            <p className="m-0">
              Capacity (database):{" "}
              <span className="text-zinc-200">
                {selectedVenue.capacity != null ? selectedVenue.capacity.toLocaleString() : "Not set"}
              </span>
              {selectedVenue.recordAttendance != null ? (
                <span> · Record attendance {selectedVenue.recordAttendance.toLocaleString()}</span>
              ) : null}
            </p>
            {attendanceNumber != null && selectedVenue.capacity ? (
              <p className="m-0">
                Fill:{" "}
                <span className="text-zinc-200">
                  {Math.round((attendanceNumber / selectedVenue.capacity) * 100)}%
                </span>{" "}
                of listed capacity
              </p>
            ) : null}
            <p className="m-0 text-xs">
              <Link href={`/admin/venues/${selectedVenue.id}/edit`} className="text-emerald-400 hover:underline">
                Edit venue capacity
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 m-0">No venue selected for this fixture yet.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {homeTeamVenue && homeTeamVenue.id !== values.venueId ? (
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs touch-target"
              onClick={() => setField("venueId", homeTeamVenue.id)}
            >
              Use home venue ({homeTeamVenue.name})
            </button>
          ) : null}
          {values.venueId ? (
            <button
              type="button"
              disabled={syncingCapacity}
              className="cms-btn cms-btn--secondary text-xs touch-target"
              onClick={() => {
                void syncVenueCapacityToDatabase();
              }}
            >
              {syncingCapacity ? "Updating…" : "Update capacity in database"}
            </button>
          ) : null}
          {fixtureId && values.planetRugbyUrl.trim() ? (
            <button
              type="button"
              disabled={enrichingPr}
              className="cms-btn cms-btn--secondary text-xs touch-target"
              onClick={() => {
                void enrichFromPlanetRugby();
              }}
            >
              {enrichingPr ? "Syncing…" : "Sync venue from Planet Rugby"}
            </button>
          ) : null}
        </div>
        {enrichMessage ? <p className="text-xs text-emerald-500 m-0">{enrichMessage}</p> : null}
      </div>

      <div className="cms-card--nested p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="cms-section-title text-sm m-0">Officials &amp; coaching</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/admin/referees" className="text-emerald-400 hover:underline">
              Manage referees
            </Link>
            <Link href="/admin/coaches" className="text-emerald-400 hover:underline">
              Manage coaches
            </Link>
          </div>
        </div>

        <label>
          Referee
          <select
            value={values.refereeId}
            onChange={(e) => setField("refereeId", e.target.value)}
            className="cms-select"
          >
            <option value="">Select referee…</option>
            {referees.map((referee) => (
              <option key={referee.id} value={referee.id}>
                {referee.name}
                {referee.countryName ? ` (${referee.countryName})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="cms-grid-2">
          <div className="space-y-2">
            <label>
              Home coach{homeTeam ? ` (${homeTeam.name})` : ""}
              <select
                value={values.homeCoachId}
                onChange={(e) => setField("homeCoachId", e.target.value)}
                className="cms-select"
              >
                <option value="">Select coach…</option>
                {homeCoachOpts.teamCoaches.length > 0 ? (
                  <optgroup label={`Assigned to ${homeTeam?.name ?? "home team"}`}>
                    {homeCoachOpts.teamCoaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {formatCoachLabel(coach)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="All coaches">
                  {(homeCoachOpts.teamCoaches.length > 0 ? homeCoachOpts.otherCoaches : allCoaches).map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {formatCoachLabel(coach)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            {values.homeTeamId ? (
              <button
                type="button"
                className="cms-btn cms-btn--secondary text-xs touch-target"
                onClick={() => {
                  void useCurrentHeadCoach("home");
                }}
              >
                Use current head coach
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <label>
              Away coach{awayTeam ? ` (${awayTeam.name})` : ""}
              <select
                value={values.awayCoachId}
                onChange={(e) => setField("awayCoachId", e.target.value)}
                className="cms-select"
              >
                <option value="">Select coach…</option>
                {awayCoachOpts.teamCoaches.length > 0 ? (
                  <optgroup label={`Assigned to ${awayTeam?.name ?? "away team"}`}>
                    {awayCoachOpts.teamCoaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {formatCoachLabel(coach)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="All coaches">
                  {(awayCoachOpts.teamCoaches.length > 0 ? awayCoachOpts.otherCoaches : allCoaches).map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {formatCoachLabel(coach)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            {values.awayTeamId ? (
              <button
                type="button"
                className="cms-btn cms-btn--secondary text-xs touch-target"
                onClick={() => {
                  void useCurrentHeadCoach("away");
                }}
              >
                Use current head coach
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <label>
        Round
        <input
          value={values.round}
          onChange={(e) => setField("round", e.target.value)}
          placeholder="Round 12 · Semi Finals"
          className="cms-input"
        />
      </label>

      <label>
        Sport365 match URL (optional)
        <div className="flex flex-col sm:flex-row gap-2 mt-1">
          <input
            type="url"
            value={values.sport365Url}
            onChange={(e) => setField("sport365Url", e.target.value)}
            placeholder="https://www.sport365.com/rugby-union/.../1-4307586"
            className="cms-input flex-1"
          />
          <button
            type="button"
            disabled={fetching || !values.sport365Url.trim()}
            onClick={fetchFromSport365}
            className="cms-btn cms-btn--secondary touch-target whitespace-nowrap"
          >
            {fetching ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {importPreview && <span className="text-xs text-emerald-500 mt-1 block">{importPreview}</span>}
        {fixtureId && values.sport365Url && (
          <SyncFromSport365Button fixtureId={fixtureId} onSynced={onSynced} onVenuesReload={reloadVenues} />
        )}
      </label>

      <label>
        Planet Rugby match URL (optional)
        <input
          type="url"
          value={values.planetRugbyUrl}
          onChange={(e) => setField("planetRugbyUrl", e.target.value)}
          placeholder="https://www.planetrugby.com/matches/..."
          className="cms-input"
        />
        {fixtureId && values.planetRugbyUrl.trim() ? (
          <span className="block mt-2">
            <button
              type="button"
              disabled={enrichingPr}
              onClick={() => {
                void enrichFromPlanetRugby();
              }}
              className="cms-btn cms-btn--secondary text-xs touch-target"
            >
              {enrichingPr ? "Enriching…" : "Enrich match from Planet Rugby (venue, lineups, events)"}
            </button>
          </span>
        ) : null}
      </label>

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={loading} className="cms-btn cms-btn--primary touch-target">
          {loading ? "Saving…" : submitLabel}
        </button>
        <Link href="/admin/matches" className="cms-btn cms-btn--secondary touch-target">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function mapSport365Status(label: string): string | undefined {
  if (label === "full_time") return "full_time";
  if (label === "half_time") return "half_time";
  if (label === "not_started") return "scheduled";
  if (label && label !== "unknown") return "live";
  return undefined;
}

function SyncFromSport365Button({
  fixtureId,
  onSynced,
  onVenuesReload,
}: {
  fixtureId: string;
  onSynced?: () => void | Promise<void>;
  onVenuesReload?: () => void | Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setSyncing(true);
    setMessage("");
    const res = await fetch(`/api/admin/matches/${fixtureId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importEvents: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Sync failed");
    } else {
      setMessage(
        `Synced ${data.preview?.homeScore ?? "?"}–${data.preview?.awayScore ?? "?"} · ${data.eventsImported ?? 0} new events · ${data.suggestionsGenerated ?? 0} event suggestions · ${data.prematchSuggestions ?? 0} pre-match AI`,
      );
      await onVenuesReload?.();
      await onSynced?.();
    }
    setSyncing(false);
  }

  return (
    <span className="block mt-2">
      <button
        type="button"
        disabled={syncing}
        onClick={sync}
        className="cms-btn cms-btn--secondary text-xs touch-target"
      >
        {syncing ? "Syncing…" : "Sync scores & events from Sport365"}
      </button>
      {message && <span className="text-xs text-zinc-500 ml-2">{message}</span>}
    </span>
  );
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { toDatetimeLocal };
