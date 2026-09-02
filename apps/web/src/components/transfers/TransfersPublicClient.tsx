"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PublicFixturesTabs } from "@/components/matches/PublicFixturesTabs";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { RankingsFlag } from "@/components/rankings/RankingsBoardPrimitives";
import {
  formatTransferAnnouncedDate,
  formatTransferMarketSeason,
  transferMarketMovementLabel,
} from "@/lib/transfer-display";
import { groupSeasonsByCompetition } from "@/lib/public-transfers-filter-utils";

type TransferRow = {
  id: string;
  playerId: string;
  playerSlug: string;
  playerName: string;
  playerImageUrl?: string | null;
  positionName: string | null;
  playerRating: number | null;
  internationalStatus: string | null;
  nationCode?: string | null;
  nationFlagUrl?: string | null;
  movementType: string;
  movementLabel: string;
  dealDetail?: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromLabel: string;
  toLabel: string;
  fromTeamImageUrl?: string | null;
  toTeamImageUrl?: string | null;
  effectiveDate: string | null;
};

type TeamGroup = {
  teamId: string;
  teamName: string;
  teamImageUrl?: string | null;
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

function movementBadgeClass(type: string): string {
  if (type === "permanent") return "is-permanent";
  if (type === "loan") return "is-loan";
  if (type === "released" || type === "retirement") return "is-muted";
  return "is-other";
}

function ClubMoveSide({
  label,
  imageUrl,
  className,
}: {
  label: string;
  imageUrl?: string | null;
  className: string;
}) {
  const showCrest = Boolean(imageUrl);
  return (
    <span className={`pr-mc-xfer-club ${className}`}>
      {showCrest ? <TeamCrest name={label} imageUrl={imageUrl} size="xs" /> : null}
      <span>{label}</span>
    </span>
  );
}

function PlayerAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;
  return (
    <span className="pr-mc-xfer-avatar">
      {showImage ? (
        // Native img: next/image stamps Wikimedia originals and hits 429 on this 400-row table.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl ?? ""}
          alt=""
          width={44}
          height={44}
          className="pr-mc-xfer-avatar__img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="pr-mc-xfer-avatar__fallback" aria-hidden>
          {name.trim().slice(0, 1).toUpperCase() || "?"}
        </span>
      )}
    </span>
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
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get("q") ?? "");

  const seasonsForComp = useMemo(() => {
    if (!options) return [];
    return !competitionId
      ? options.seasons
      : options.seasons.filter((s) => !s.competitionId || s.competitionId === competitionId);
  }, [options, competitionId]);

  const seasonGroups = useMemo(
    () => groupSeasonsByCompetition(seasonsForComp),
    [seasonsForComp],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const bootstrapped = useRef(false);
  const preferDefaultSeason = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadFilters() {
      try {
        const sp = new URLSearchParams({ mode: "filters" });
        sp.set("competitionId", competitionId);
        sp.set("seasonId", seasonId);
        const res = await fetch(`/api/transfers?${sp}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load filters");
        if (cancelled) return;
        setOptions(data as FilterOptions);

        if (!bootstrapped.current) {
          bootstrapped.current = true;
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
      sp.set("seasonId", seasonId);
      sp.set("competitionId", competitionId);
      sp.set("sortDir", "desc");
      if (teamId) sp.set("teamId", teamId);
      if (movementType) sp.set("movementType", movementType);
      if (appliedSearch) sp.set("search", appliedSearch);
      sp.set("pageSize", "500");

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
  }, [view, seasonId, competitionId, teamId, movementType, appliedSearch, filtersReady, options]);

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
    sp.delete("team");
    setOrDel("movementType", next.movementType ?? movementType);
    setOrDel("q", next.q ?? search.trim());
    if (!sp.has("sortDir")) sp.set("sortDir", "desc");
    router.replace(`${pathname}?${sp.toString()}`);
  }

  const selectedSeason =
    seasonsForComp.find((s) => s.id === seasonId) ??
    options?.seasons.find((s) => s.id === seasonId);
  const marketSeason =
    formatTransferMarketSeason(selectedSeason?.displayLabel || selectedSeason?.label) ||
    formatTransferMarketSeason(options?.defaults.seasonLabel) ||
    "Transfer";
  const competitionName =
    options?.competitions.find((c) => c.id === competitionId)?.name || "all competitions";

  return (
    <div className="pr-mc-fixtures-page pr-mc-transfers-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="pr-mc-breadcrumbs__sep" aria-hidden>
          ›
        </span>
        <span className="pr-mc-breadcrumbs__current">Transfers</span>
      </nav>

      <PublicFixturesTabs active="transfers" />

      <header className="pr-mc-xfer-hero">
        <div className="pr-mc-xfer-hero__copy">
          <p className="pr-mc-xfer-hero__eyebrow">{marketSeason} transfer market</p>
          <h1 className="pr-mc-xfer-hero__title">Every move. One clear view.</h1>
          <p className="pr-mc-xfer-hero__lede">
            Track confirmed player transfers
            {competitionId ? ` across ${competitionName}` : ""} — with player profiles,
            international origin and deal details at a glance.
          </p>
        </div>
        <div className="pr-mc-xfer-hero__stat">
          <strong>{total.toLocaleString("en-GB")}</strong>
          <span>Transfers tracked</span>
        </div>
      </header>

      <form
        className="pr-mc-transfers-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search.trim());
          pushParams({ q: search.trim() });
          void loadTransfers();
        }}
      >
        <label className="pr-mc-transfers-filters__field pr-mc-transfers-filters__field--search">
          <span>Search</span>
          <input
            className="pr-mc-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player, club or nation"
          />
        </label>

        <label className="pr-mc-transfers-filters__field">
          <span>Team</span>
          <select
            className="pr-mc-select"
            value={teamId}
            onChange={(e) => {
              const next = e.target.value;
              setTeamId(next);
              pushParams({ teamId: next });
            }}
          >
            <option value="">All teams</option>
            {(options?.teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

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
            {!competitionId && seasonGroups.length > 1
              ? seasonGroups.map(([groupLabel, groupSeasons]) => (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {groupSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayLabel || s.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              : seasonsForComp.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayLabel || s.label}
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
            <option value="">All transfers</option>
            {(options?.movementTypes ?? []).map((m) => (
              <option key={m} value={m}>
                {transferMarketMovementLabel(m)}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="pr-mc-transfers-filters__show">
          Show results
        </button>
      </form>

      <div className="pr-mc-xfer-toolbar">
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
            Latest <span>transfers</span>
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
            By club
          </button>
        </div>
        <p className="pr-mc-xfer-sort">
          Sorted by <strong>most recent</strong> ↓
        </p>
      </div>

      {error ? <p className="pr-mc-transfers-error">{error}</p> : null}
      {loading ? <p className="pr-mc-transfers-muted">Loading transfers…</p> : null}

      {!loading && view === "date" ? (
        <div className="pr-mc-transfers-table-wrap">
          <table className="pr-mc-transfers-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>International origin</th>
                <th>Transfer</th>
                <th>Rating</th>
                <th>Transfer details</th>
                <th>Announced</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="pr-mc-xfer-player">
                      <PlayerAvatar name={row.playerName} imageUrl={row.playerImageUrl} />
                      <span className="pr-mc-transfers-player">
                        <Link href={`/players/${row.playerSlug}`} className="pr-mc-xfer-player__name">
                          {row.playerName}
                        </Link>
                        <span className="pr-mc-transfers-pos">{row.positionName ?? "—"}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="pr-mc-xfer-origin">
                      {row.nationFlagUrl ? (
                        <RankingsFlag src={row.nationFlagUrl} name={row.internationalStatus ?? ""} />
                      ) : null}
                      <span>{row.internationalStatus ?? "—"}</span>
                    </span>
                  </td>
                  <td>
                    <span className="pr-mc-xfer-move">
                      <ClubMoveSide
                        label={row.fromLabel}
                        imageUrl={row.fromTeamImageUrl}
                        className="pr-mc-xfer-move__from"
                      />
                      <span className="pr-mc-xfer-move__arrow" aria-hidden>
                        →
                      </span>
                      <ClubMoveSide
                        label={row.toLabel}
                        imageUrl={row.toTeamImageUrl}
                        className="pr-mc-xfer-move__to"
                      />
                    </span>
                  </td>
                  <td>
                    {row.playerRating != null ? (
                      <span className="pr-mc-xfer-rating">
                        <strong>{row.playerRating}</strong>
                        <span>Overall</span>
                      </span>
                    ) : (
                      <span className="pr-mc-transfers-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`pr-mc-xfer-badge ${movementBadgeClass(row.movementType)}`}>
                      {transferMarketMovementLabel(row.movementType)}
                    </span>
                    {row.dealDetail ? (
                      <span className="pr-mc-xfer-deal">{row.dealDetail}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className="pr-mc-xfer-announced">
                      <strong>{formatTransferAnnouncedDate(row.effectiveDate)}</strong>
                      <span>Confirmed</span>
                    </span>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pr-mc-transfers-muted">
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
                <TeamCrest name={group.teamName} imageUrl={group.teamImageUrl} size="sm" />
                {group.teamName}
              </h2>
              <div className="pr-mc-transfers-club__cols">
                <div>
                  <h3 className="pr-mc-transfers-club__side">Players in</h3>
                  <ul className="pr-mc-transfers-club__list pr-mc-xfer-club-list">
                    {group.in.map((row) => (
                      <li key={`${row.id}-in`}>
                        <PlayerAvatar name={row.playerName} imageUrl={row.playerImageUrl} />
                        <span>
                          <Link href={`/players/${row.playerSlug}`} className="pr-mc-xfer-player__name">
                            {row.playerName}
                          </Link>
                          <span className="pr-mc-transfers-muted">
                            {" "}
                            from{" "}
                            <ClubMoveSide
                              label={row.fromLabel}
                              imageUrl={row.fromTeamImageUrl}
                              className="pr-mc-xfer-move__from"
                            />
                            {row.positionName ? ` · ${row.positionName}` : ""}
                          </span>
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
                  <ul className="pr-mc-transfers-club__list pr-mc-xfer-club-list">
                    {group.out.map((row) => (
                      <li key={`${row.id}-out`}>
                        <PlayerAvatar name={row.playerName} imageUrl={row.playerImageUrl} />
                        <span>
                          <Link href={`/players/${row.playerSlug}`} className="pr-mc-xfer-player__name">
                            {row.playerName}
                          </Link>
                          <span className="pr-mc-transfers-muted">
                            {" "}
                            to{" "}
                            <ClubMoveSide
                              label={row.toLabel}
                              imageUrl={row.toTeamImageUrl}
                              className="pr-mc-xfer-move__to"
                            />
                            {row.positionName ? ` · ${row.positionName}` : ""}
                          </span>
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
