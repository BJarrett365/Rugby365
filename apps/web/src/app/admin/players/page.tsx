"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import {
  SeasonCompetitionScope,
  useSeasonScopedTeamGroups,
  type SeasonCompetitionScopeValue,
} from "@/components/admin/SeasonCompetitionScope";
import { PageHeader } from "@/components/shell/PageHeader";
import { PLAYER_LIST_LETTERS } from "@/lib/player-list-filters";
import { careerStatusLabel, type PlayerCareerStatus } from "@/lib/player-career-status";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type PlayerRow = {
  id: string;
  name: string;
  slug: string;
  positionName: string | null;
  clubName: string | null;
  countryName: string | null;
  nationCode: string | null;
  clubTeamName: string | null;
  internationalTeamName: string | null;
  jerseyNumber: number | null;
  displayRating: number | null;
  careerStatus: PlayerCareerStatus;
  displayNation: string | null;
  stats: {
    tries: number;
    conversions: number;
    penalties: number;
    dropGoals: number;
    points: number;
  };
  fixtureCount: number;
  eventCount: number;
};

function formatRating(value: number | null) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function stat(n: number) {
  return n > 0 ? String(n) : "—";
}

function statusClass(status: PlayerCareerStatus): string {
  switch (status) {
    case "legend":
      return "text-amber-300";
    case "retired":
      return "text-zinc-400";
    case "released":
      return "text-orange-300";
    default:
      return "text-emerald-300";
  }
}

export default function PlayersAdminPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [bulkWikiEnriching, setBulkWikiEnriching] = useState(false);
  const [wikiMessage, setWikiMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState(0);
  const [duplicateRows, setDuplicateRows] = useState(0);
  const [deduping, setDeduping] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: "",
    teamId: "",
    letter: "",
    sortBy: "rank" as "rank" | "name",
  });
  const [searchInput, setSearchInput] = useState("");
  const [autoMapping, setAutoMapping] = useState(false);
  const didAutoMapRef = useRef(false);
  const [scope, setScope] = useState<SeasonCompetitionScopeValue>({ competitionId: "", seasonId: "" });
  const { groups: scopedTeamGroups } = useSeasonScopedTeamGroups(scope);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
      sortBy: filters.sortBy,
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (scope.competitionId && scope.seasonId && filters.teamId) {
      params.set("competitionId", scope.competitionId);
      params.set("seasonId", scope.seasonId);
    }
    if (filters.letter) params.set("letter", filters.letter);

    const [playersRes, dupRes] = await Promise.all([
      fetch(`/api/admin/players?${params}`),
      fetch("/api/admin/entities/duplicates"),
    ]);
    const data = await playersRes.json();
    const dupData = await dupRes.json();
    setPlayers(data.players ?? []);
    setPagination(data.pagination ?? pagination);
    setDuplicateGroups(dupData.players?.groups ?? 0);
    setDuplicateRows(dupData.players?.rows ?? 0);
    setLoading(false);
    return data;
  }, [filters, pagination.page, pagination.pageSize, scope.competitionId, scope.seasonId]);

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((res) => res.json())
      .then((data) => {
        const competitions = data.competitions ?? [];
        const prem = competitions.find((row: { slug: string }) => row.slug === "premiership");
        if (prem?.activeSeason?.id) {
          setScope({ competitionId: prem.id, seasonId: prem.activeSeason.id });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (scope.competitionId && scope.seasonId) return;
    fetch("/api/admin/teams?grouped=1")
      .then((res) => res.json())
      .then((data) => setTeamGroups(data.groups ?? []))
      .catch(() => undefined);
  }, [scope.competitionId, scope.seasonId]);

  const teamGroupsForPicker = scope.competitionId && scope.seasonId ? scopedTeamGroups : teamGroups;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchInput }));
      setPagination((current) => ({ ...current, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadPlayers().catch(() => setLoading(false));
  }, [loadPlayers]);

  useEffect(() => {
    if (didAutoMapRef.current || loading || pagination.total > 0) return;
    if (filters.search || filters.teamId || filters.letter) return;

    didAutoMapRef.current = true;
    let cancelled = false;

    (async () => {
      setAutoMapping(true);
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "map-from-matches" }),
      });
      if (!cancelled && res.ok) {
        await loadPlayers();
      }
      if (!cancelled) setAutoMapping(false);
    })().catch(() => {
      if (!cancelled) setAutoMapping(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, pagination.total, filters.search, filters.teamId, filters.letter, loadPlayers]);

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  }

  async function enrichAllFromWikipedia() {
    if (
      !confirm(
        "Enrich all players from Wikipedia? Players without archive data will be looked up first. This can take a long time for large squads.",
      )
    ) {
      return;
    }
    setBulkWikiEnriching(true);
    setWikiMessage("");
    const res = await fetch("/api/admin/players/enrich-wikipedia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onlyMissing: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setWikiMessage(
        `Wikipedia enrich complete — ${data.enriched}/${data.processed} enriched (${data.skipped} skipped).`,
      );
      await loadPlayers();
    } else {
      setWikiMessage(data.error ?? "Bulk Wikipedia enrich failed");
    }
    setBulkWikiEnriching(false);
  }

  async function refreshAllPlayerData() {
    setRefreshingData(true);
    setRefreshMessage("Refreshing player profiles, clubs, positions and ratings…");
    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fill-profile-gaps" }),
    });
    const data = await res.json();
    if (res.ok) {
      const after = data.after as { withRating?: number; withClub?: number; withPosition?: number } | undefined;
      setRefreshMessage(
        `Player data refreshed — ${after?.withRating ?? "?"} rated, ${after?.withClub ?? "?"} with club, ${after?.withPosition ?? "?"} with position.`,
      );
      await loadPlayers();
    } else {
      setRefreshMessage(data.error ?? "Refresh failed");
    }
    setRefreshingData(false);
  }

  async function mapFromMatches() {
    setMapping(true);
    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "map-from-matches" }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(
        `Mapped from matches: ${data.playersUpserted} player updates, ${data.squadsSynced} squad rows, ${data.eventsLinked} events linked.`,
      );
      await loadPlayers();
    } else alert(data.error ?? "Map failed");
    setMapping(false);
  }

  async function mergeDuplicates() {
    if (duplicateRows === 0) return;
    if (
      !confirm(
        `Merge ${duplicateRows} duplicate player record${duplicateRows === 1 ? "" : "s"} across ${duplicateGroups} group${duplicateGroups === 1 ? "" : "s"}? Squads, events and transfers will be rewired to the best record.`,
      )
    ) {
      return;
    }
    setDeduping(true);
    const res = await fetch("/api/admin/entities/dedupe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "players" }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Merged ${data.players?.deleted ?? 0} duplicate player record(s).`);
      await loadPlayers();
    } else {
      alert(data.error ?? "Merge failed");
    }
    setDeduping(false);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete player “${name}”?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
    if (res.ok) await loadPlayers();
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
    setDeletingId(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Players"
        description="Top 50 players by Rugby365 rating, with career scoring from match events."
        actions={
          <div className="flex flex-wrap gap-2">
            {duplicateRows > 0 ? (
              <button
                type="button"
                disabled={deduping}
                onClick={mergeDuplicates}
                className="cms-btn cms-btn--secondary touch-target"
              >
                {deduping
                  ? "Merging…"
                  : `Merge ${duplicateRows} duplicate${duplicateRows === 1 ? "" : "s"}`}
              </button>
            ) : null}
            <button
              type="button"
              disabled={refreshingData}
              onClick={refreshAllPlayerData}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {refreshingData ? "Refreshing data…" : "Refresh all player data"}
            </button>
            <button
              type="button"
              disabled={mapping}
              onClick={mapFromMatches}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {mapping ? "Mapping…" : "Map from matches"}
            </button>
            <button
              type="button"
              disabled={bulkWikiEnriching}
              onClick={enrichAllFromWikipedia}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {bulkWikiEnriching ? "Enriching from Wikipedia…" : "Enrich all from Wikipedia"}
            </button>
            <Link href="/admin/players/new" className="cms-btn cms-btn--primary touch-target">
              New player
            </Link>
            <Link href="/admin/players/import" className="cms-btn cms-btn--secondary touch-target">
              RugbyPass import
            </Link>
          </div>
        }
      />
      {wikiMessage ? <p className="text-sm text-zinc-400 mb-4">{wikiMessage}</p> : null}
      {refreshMessage ? <p className="text-sm text-zinc-400 mb-4">{refreshMessage}</p> : null}

      <div className="cms-card mb-4 space-y-4">
        <SeasonCompetitionScope value={scope} onChange={setScope} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Search player
            <input
              className="cms-input w-full mt-1"
              placeholder="Name, slug or full name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Filter by team
            <GroupedTeamSelect
              value={filters.teamId}
              onChange={(value) => updateFilter("teamId", value)}
              groups={teamGroupsForPicker}
              placeholder="All teams"
              className="cms-select block w-full mt-1"
            />
          </label>
        </div>

        <div>
          <p className="text-xs text-zinc-500 mb-2 m-0">Sort &amp; browse</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => updateFilter("sortBy", "rank")}
              className={`cms-btn text-xs px-3 py-1 ${
                filters.sortBy === "rank" ? "cms-btn--primary" : "cms-btn--secondary"
              }`}
            >
              Top by rank
            </button>
            <button
              type="button"
              onClick={() => updateFilter("sortBy", "name")}
              className={`cms-btn text-xs px-3 py-1 ${
                filters.sortBy === "name" ? "cms-btn--primary" : "cms-btn--secondary"
              }`}
            >
              A–Z by name
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-2 m-0">Browse A–Z</p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => updateFilter("letter", "")}
              className={`cms-btn text-xs px-2 py-1 ${
                filters.letter === "" ? "cms-btn--primary" : "cms-btn--secondary"
              }`}
            >
              All
            </button>
            {PLAYER_LIST_LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => updateFilter("letter", letter)}
                className={`cms-btn text-xs px-2 py-1 min-w-[2rem] ${
                  filters.letter === letter ? "cms-btn--primary" : "cms-btn--secondary"
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading || autoMapping || refreshingData ? (
        <p className="text-zinc-500 text-sm">
          {refreshingData
            ? "Refreshing player data…"
            : autoMapping
              ? "Mapping players from matches…"
              : "Loading…"}
        </p>
      ) : players.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">
            {pagination.total === 0
              ? "No players yet. Sync a Sport365 match or map from matches."
              : "No players match these filters."}
          </p>
        </div>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2">Rank</th>
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-2 text-center">Rating</th>
                <th className="py-2 pr-3">Position</th>
                <th className="py-2 pr-3">Club</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-2 text-center">T</th>
                <th className="py-2 pr-2 text-center">C</th>
                <th className="py-2 pr-2 text-center">P</th>
                <th className="py-2 pr-2 text-center">DG</th>
                <th className="py-2 pr-2 text-center">Pts</th>
                <th className="py-2 pr-3">Nation</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {players.map((p, index) => {
                const rank = (pagination.page - 1) * pagination.pageSize + index + 1;
                return (
                  <tr key={p.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-2 font-mono text-zinc-500">
                    {filters.sortBy === "rank" ? rank : "—"}
                  </td>
                  <td className="py-2 pr-2 font-mono text-zinc-500">{p.jerseyNumber ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/players/${p.id}/edit`} className="text-emerald-400 font-medium">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-zinc-600">
                      {p.fixtureCount} squads · {p.eventCount} events
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-center font-mono text-emerald-300">
                    {formatRating(p.displayRating)}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{p.positionName ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {p.clubTeamName ?? p.clubName ?? "—"}
                    {p.internationalTeamName && (
                      <span className="block text-xs text-zinc-600">Int: {p.internationalTeamName}</span>
                    )}
                  </td>
                  <td className={`py-2 pr-3 text-xs font-medium ${statusClass(p.careerStatus)}`}>
                    {careerStatusLabel(p.careerStatus)}
                  </td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.stats.tries)}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.stats.conversions)}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.stats.penalties)}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.stats.dropGoals)}</td>
                  <td className="py-2 pr-2 text-center font-mono text-zinc-200">
                    {p.stats.points > 0 ? p.stats.points : "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400 uppercase text-xs">
                    {p.displayNation ?? "—"}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link href={`/admin/players/${p.id}/edit`} className="cms-btn cms-btn--secondary text-xs mr-1">
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={deletingId === p.id}
                      onClick={() => remove(p.id, p.name)}
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <p className="text-xs text-zinc-600 m-0">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} player
              {pagination.total === 1 ? "" : "s"}
              {filters.sortBy === "rank" ? " · sorted by rank" : " · sorted A–Z"}
              {filters.letter ? ` · ${filters.letter}` : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                className="cms-btn cms-btn--secondary text-xs"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                className="cms-btn cms-btn--secondary text-xs"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
