"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PublicFixturesTabs } from "@/components/matches/PublicFixturesTabs";
import { movementTypeLabel } from "@/lib/transfer-types";

type TransferRow = {
  id: string;
  playerId: string;
  playerSlug: string;
  playerName: string;
  positionName: string | null;
  playerRating: number | null;
  internationalStatus: string | null;
  movementType: string;
  movementLabel: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromLabel: string;
  toLabel: string;
  effectiveDate: string | null;
};

type TeamGroup = {
  teamId: string;
  teamName: string;
  in: TransferRow[];
  out: TransferRow[];
};

type FilterOptions = {
  defaults: {
    competitionId: string;
    seasonId: string | null;
    seasonLabel: string;
    seasonYear?: number;
    wikiUrl?: string;
  };
  competitions: Array<{ id: string; name: string }>;
  seasons: Array<{
    id: string;
    label: string;
    displayLabel: string;
    year: number;
    competitionId: string;
    competitionName?: string | null;
  }>;
  teams: Array<{ id: string; name: string }>;
  movementTypes: string[];
  selectedSeasonId?: string | null;
};

type ViewMode = "date" | "teams";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function PlayerLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link href={`/players/${slug}`} className="pr-mc-transfer-link">
      {name}
    </Link>
  );
}

function TeamLink({ id, name }: { id: string | null; name: string }) {
  if (!id || name === "—") return <span>{name}</span>;
  return (
    <Link href={`/admin/teams/${id}/edit`} className="pr-mc-transfer-link">
      {name}
    </Link>
  );
}

export function TransfersPublicClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = (searchParams.get("view") === "teams" ? "teams" : "date") as ViewMode;
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);

  const [competitionId, setCompetitionId] = useState(searchParams.get("competitionId") ?? "");
  const [seasonId, setSeasonId] = useState(searchParams.get("seasonId") ?? "");
  const [teamId, setTeamId] = useState(searchParams.get("teamId") ?? "");
  const [movementType, setMovementType] = useState(searchParams.get("movementType") ?? "");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const seasonsForComp = useMemo(() => {
    if (!options) return [];
    const rows = !competitionId
      ? options.seasons
      : options.seasons.filter((s) => !s.competitionId || s.competitionId === competitionId);
    return [...rows].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }, [options, competitionId]);

  const bootstrapped = useRef(false);
  const preferDefaultSeason = useRef(false);
  const initialCompetition = searchParams.get("competitionId");
  const initialSeason = searchParams.get("seasonId");

  useEffect(() => {
    let cancelled = false;
    async function loadFilters() {
      try {
        const sp = new URLSearchParams({ mode: "filters" });
        // Pass empty string so the API keeps "All competitions / seasons" instead of Premiership defaults.
        sp.set("competitionId", competitionId);
        sp.set("seasonId", seasonId);
        const res = await fetch(`/api/transfers?${sp}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load filters");
        if (cancelled) return;
        setOptions(data as FilterOptions);

        if (!bootstrapped.current) {
          bootstrapped.current = true;
          // Soft-default to Premiership + current wiki season only on a bare /transfers visit.
          const bareVisit = !initialCompetition && !initialSeason;
          if (bareVisit) {
            const nextComp = data.defaults?.competitionId || "";
            const nextSeason = data.defaults?.seasonId || data.selectedSeasonId || "";
            if (nextComp) setCompetitionId(nextComp);
            if (nextSeason) setSeasonId(nextSeason);
            const params = new URLSearchParams(searchParams.toString());
            if (nextComp) params.set("competitionId", nextComp);
            if (nextSeason) params.set("seasonId", nextSeason);
            if (!params.has("sortDir")) params.set("sortDir", "desc");
            router.replace(`${pathname}?${params.toString()}`);
          }
          setFiltersReady(true);
        } else if (preferDefaultSeason.current && data.selectedSeasonId) {
          preferDefaultSeason.current = false;
          setSeasonId(data.selectedSeasonId);
          const params = new URLSearchParams(searchParams.toString());
          if (competitionId) params.set("competitionId", competitionId);
          else params.delete("competitionId");
          params.set("seasonId", data.selectedSeasonId);
          params.delete("teamId");
          router.replace(`${pathname}?${params.toString()}`);
          setFiltersReady(true);
        } else {
          setFiltersReady(true);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load filters");
      }
    }
    void loadFilters();
    return () => {
      cancelled = true;
    };
  }, [competitionId, seasonId]);

  const loadTransfers = useCallback(async () => {
    if (!filtersReady || !options) return;

    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      sp.set("view", view);
      // Always send keys so empty = All (API does not apply Premiership defaults).
      sp.set("seasonId", seasonId);
      sp.set("competitionId", competitionId);
      sp.set("sortDir", "desc");
      if (teamId) sp.set("teamId", teamId);
      if (movementType) sp.set("movementType", movementType);
      if (search.trim()) sp.set("search", search.trim());
      sp.set("pageSize", "400");

      const res = await fetch(`/api/transfers?${sp}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load transfers");
      setTransfers(data.transfers ?? []);
      setGroups(data.groups ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }, [view, seasonId, competitionId, teamId, movementType, search, filtersReady, options]);

  useEffect(() => {
    if (!filtersReady) return;
    void loadTransfers();
  }, [filtersReady, loadTransfers]);

  function pushParams(next: {
    view?: ViewMode;
    competitionId?: string;
    seasonId?: string;
    teamId?: string;
    movementType?: string;
    q?: string;
  }) {
    const sp = new URLSearchParams(searchParams.toString());
    const setOrDel = (key: string, value: string | undefined) => {
      if (value) sp.set(key, value);
      else sp.delete(key);
    };
    setOrDel("view", next.view ?? view);
    setOrDel("competitionId", next.competitionId ?? competitionId);
    setOrDel("seasonId", next.seasonId ?? seasonId);
    setOrDel("teamId", next.teamId ?? teamId);
    setOrDel("movementType", next.movementType ?? movementType);
    setOrDel("q", next.q ?? search.trim());
    router.replace(`${pathname}?${sp.toString()}`);
  }

  const seasonLabel =
    seasonsForComp.find((s) => s.id === seasonId)?.displayLabel ||
    (competitionId
      ? options?.competitions.find((c) => c.id === competitionId)?.name
      : null) ||
    (seasonId || competitionId ? "Selected filters" : "All competitions");

  return (
    <div className="pr-mc-fixtures-page pr-mc-transfers-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="pr-mc-breadcrumbs__sep" aria-hidden>
          ›
        </span>
        <span className="pr-mc-breadcrumbs__current">Transfers</span>
      </nav>

      <header className="pr-mc-fixtures-page__header">
        <div className="pr-mc-fixtures-page__title-row">
          <h1 className="pr-mc-fixtures-page__title">Rugby Transfers</h1>
          <span className="pr-mc-pr-badge" title="Planet Rugby" aria-hidden>
            PR
          </span>
        </div>
        <p className="pr-mc-transfers-page__sub">
          {seasonLabel} · club and player moves{" "}
          {options?.defaults.wikiUrl ? (
            <>
              ·{" "}
              <a
                href={options.defaults.wikiUrl}
                target="_blank"
                rel="noreferrer"
                className="pr-mc-transfer-link"
              >
                Wikipedia
              </a>
            </>
          ) : null}
        </p>
      </header>

      <PublicFixturesTabs active="transfers" />

      <div className="pr-mc-transfers-views" role="tablist" aria-label="Transfer views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "date"}
          className={`pr-mc-transfers-views__tab${view === "date" ? " is-active" : ""}`}
          onClick={() => {
            pushParams({ view: "date" });
          }}
        >
          By date
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "teams"}
          className={`pr-mc-transfers-views__tab${view === "teams" ? " is-active" : ""}`}
          onClick={() => {
            pushParams({ view: "teams" });
          }}
        >
          By player in &amp; out
        </button>
      </div>

      <form
        className="pr-mc-transfers-filters"
        onSubmit={(e) => {
          e.preventDefault();
          pushParams({ q: search.trim() });
          void loadTransfers();
        }}
      >
        <label className="pr-mc-transfers-filters__field">
          <span>Competition</span>
          <select
            className="pr-mc-select"
            value={competitionId}
            onChange={(e) => {
              const next = e.target.value;
              preferDefaultSeason.current = Boolean(next);
              setCompetitionId(next);
              setTeamId("");
              setSeasonId("");
              pushParams({ competitionId: next, seasonId: "", teamId: "" });
            }}
          >
            <option value="">All competitions</option>
            {(options?.competitions ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="pr-mc-transfers-filters__field">
          <span>Season</span>
          <select
            className="pr-mc-select"
            value={seasonId}
            onChange={(e) => {
              const next = e.target.value;
              setSeasonId(next);
              setTeamId("");
              pushParams({ seasonId: next, teamId: "" });
            }}
          >
            <option value="">All seasons</option>
            {seasonsForComp.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayLabel || s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pr-mc-transfers-filters__field">
          <span>Club</span>
          <select
            className="pr-mc-select"
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              pushParams({ teamId: e.target.value });
            }}
          >
            <option value="">All clubs</option>
            {(options?.teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="pr-mc-transfers-filters__field">
          <span>Move type</span>
          <select
            className="pr-mc-select"
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              pushParams({ movementType: e.target.value });
            }}
          >
            <option value="">All types</option>
            {(options?.movementTypes ?? []).map((m) => (
              <option key={m} value={m}>
                {movementTypeLabel(m)}
              </option>
            ))}
          </select>
        </label>

        <label className="pr-mc-transfers-filters__field pr-mc-transfers-filters__field--search">
          <span>Search player / club</span>
          <input
            className="pr-mc-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player or club name"
          />
        </label>

        <button type="submit" className="pr-mc-transfers-filters__show">
          Show
        </button>
      </form>

      {error ? <p className="pr-mc-transfers-error">{error}</p> : null}
      {loading ? <p className="pr-mc-transfers-muted">Loading transfers…</p> : null}

      {!loading && !error ? (
        <p className="pr-mc-transfers-meta">
          {total} transfer{total === 1 ? "" : "s"}
          {view === "teams" ? ` · ${groups.length} clubs` : ""}
        </p>
      ) : null}

      {!loading && view === "date" ? (
        <div className="pr-mc-transfers-table-wrap">
          <table className="pr-mc-transfers-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Rating</th>
                <th>Intl</th>
                <th>Left</th>
                <th>Joined</th>
                <th>Date</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="pr-mc-transfers-player">
                      <PlayerLink slug={row.playerSlug} name={row.playerName} />
                    </div>
                  </td>
                  <td className="pr-mc-transfers-muted">{row.positionName ?? "—"}</td>
                  <td className="pr-mc-transfers-rating">
                    {row.playerRating != null ? row.playerRating : "—"}
                  </td>
                  <td className="pr-mc-transfers-muted">{row.internationalStatus ?? "—"}</td>
                  <td>
                    <TeamLink id={row.fromTeamId} name={row.fromLabel} />
                  </td>
                  <td>
                    <TeamLink id={row.toTeamId} name={row.toLabel} />
                  </td>
                  <td className="pr-mc-transfers-date">{formatDate(row.effectiveDate)}</td>
                  <td>{row.movementLabel}</td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pr-mc-transfers-muted">
                    No transfers for these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && view === "teams" ? (
        <div className="pr-mc-transfers-groups">
          {groups.map((group) => (
            <section key={group.teamId} className="pr-mc-transfers-club">
              <h2 className="pr-mc-transfers-club__title">
                <TeamLink id={group.teamId} name={group.teamName} />
              </h2>
              <div className="pr-mc-transfers-club__cols">
                <div>
                  <h3 className="pr-mc-transfers-club__side">Players in</h3>
                  <ul className="pr-mc-transfers-club__list">
                    {group.in.map((row) => (
                      <li key={`${row.id}-in`}>
                        <PlayerLink slug={row.playerSlug} name={row.playerName} />
                        <span className="pr-mc-transfers-muted">
                          {" "}
                          from{" "}
                          <TeamLink id={row.fromTeamId} name={row.fromLabel} />
                          {row.positionName ? ` · ${row.positionName}` : ""}
                          {row.movementType !== "permanent" ? ` (${row.movementLabel})` : ""}
                          {row.effectiveDate ? ` · ${formatDate(row.effectiveDate)}` : ""}
                        </span>
                      </li>
                    ))}
                    {group.in.length === 0 ? (
                      <li className="pr-mc-transfers-muted">No arrivals listed.</li>
                    ) : null}
                  </ul>
                </div>
                <div>
                  <h3 className="pr-mc-transfers-club__side">Players out</h3>
                  <ul className="pr-mc-transfers-club__list">
                    {group.out.map((row) => (
                      <li key={`${row.id}-out`}>
                        <PlayerLink slug={row.playerSlug} name={row.playerName} />
                        <span className="pr-mc-transfers-muted">
                          {" "}
                          to <TeamLink id={row.toTeamId} name={row.toLabel} />
                          {row.positionName ? ` · ${row.positionName}` : ""}
                          {row.movementType !== "permanent" ? ` (${row.movementLabel})` : ""}
                          {row.effectiveDate ? ` · ${formatDate(row.effectiveDate)}` : ""}
                        </span>
                      </li>
                    ))}
                    {group.out.length === 0 ? (
                      <li className="pr-mc-transfers-muted">No departures listed.</li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </section>
          ))}
          {groups.length === 0 ? (
            <p className="pr-mc-transfers-muted">No club transfers for these filters.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
