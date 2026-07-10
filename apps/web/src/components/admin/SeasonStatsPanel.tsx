"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  PlayerSeasonStatsRow,
  SeasonStatsFilterOptions,
  TeamSeasonStatsRow,
} from "@/lib/player-season-stats-service";

export type { PlayerSeasonStatsRow, TeamSeasonStatsRow, SeasonStatsFilterOptions };

function deriveFilterOptions(rows: Array<{ seasonId: string; seasonLabel: string; competitionId: string; competitionName: string }>): SeasonStatsFilterOptions {
  const seasons = new Map<string, string>();
  const competitions = new Map<string, string>();
  for (const row of rows) {
    seasons.set(row.seasonId, row.seasonLabel);
    competitions.set(row.competitionId, row.competitionName);
  }
  return {
    seasons: [...seasons.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => b.label.localeCompare(a.label)),
    competitions: [...competitions.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function SeasonStatsFiltersBar({
  filterOptions,
  seasonId,
  competitionId,
  search,
  showSearch,
  onSeasonChange,
  onCompetitionChange,
  onSearchChange,
}: {
  filterOptions: SeasonStatsFilterOptions;
  seasonId: string;
  competitionId: string;
  search: string;
  showSearch?: boolean;
  onSeasonChange: (value: string) => void;
  onCompetitionChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}) {
  if (filterOptions.seasons.length === 0 && filterOptions.competitions.length === 0 && !showSearch) {
    return null;
  }

  return (
    <div className={`grid gap-3 mb-4 ${showSearch ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {showSearch ? (
        <input
          className="cms-input"
          placeholder="Search player…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      ) : null}
      <select className="cms-select" value={seasonId} onChange={(e) => onSeasonChange(e.target.value)}>
        <option value="">All seasons</option>
        {filterOptions.seasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.label}
          </option>
        ))}
      </select>
      <select
        className="cms-select"
        value={competitionId}
        onChange={(e) => onCompetitionChange(e.target.value)}
      >
        <option value="">All competitions</option>
        {filterOptions.competitions.map((competition) => (
          <option key={competition.id} value={competition.id}>
            {competition.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function PlayerSeasonStatsCard({ row }: { row: PlayerSeasonStatsRow }) {
  return (
    <section>
      <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">
        {row.competitionName}
        <span className="text-zinc-500 font-normal"> · {row.seasonLabel}</span>
        <span className="text-zinc-500 font-normal"> · {row.teamName}</span>
        <span className="text-zinc-600 font-normal ml-2">({row.appearances} apps)</span>
      </h4>
      <div className="grid gap-4 lg:grid-cols-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Core</p>
          <ul className="space-y-1 text-zinc-400 m-0 list-none p-0">
            <li>
              Tackles completed:{" "}
              <span className="font-mono text-zinc-200">{row.tacklesCompleted}</span>
            </li>
            <li>
              Carries: <span className="font-mono text-zinc-200">{row.carries}</span>
            </li>
            <li>
              Tries: <span className="font-mono text-zinc-200">{row.tries}</span>
            </li>
            <li>
              Metres carried: <span className="font-mono text-zinc-200">{row.metresCarried}</span>
            </li>
            <li>
              Turnovers won: <span className="font-mono text-zinc-200">{row.turnoversWon}</span>
            </li>
            <li>
              Dominant tackles: <span className="font-mono text-zinc-200">{row.dominantTackles}</span>
            </li>
            <li>
              Try assists: <span className="font-mono text-zinc-200">{row.tryAssists}</span>
            </li>
          </ul>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mt-4 mb-2">Per-match averages</p>
          <ul className="space-y-1 text-zinc-400 m-0 list-none p-0">
            <li>
              Carries: <span className="font-mono text-zinc-200">{row.averages.carries}</span>
            </li>
            <li>
              Tackles completed:{" "}
              <span className="font-mono text-zinc-200">{row.averages.tacklesCompleted}</span>
            </li>
            <li>
              Metres carried: <span className="font-mono text-zinc-200">{row.averages.metresCarried}</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Attack</p>
          <ul className="space-y-1 text-zinc-400 m-0 list-none p-0">
            <li>
              Rank: <span className="font-mono text-zinc-200">{row.attackRank ?? "—"}</span>
            </li>
            <li>
              Points: <span className="font-mono text-zinc-200">{row.points}</span>
            </li>
            <li>
              Line breaks: <span className="font-mono text-zinc-200">{row.lineBreaks}</span>
            </li>
            <li>
              Carries / min:{" "}
              <span className="font-mono text-zinc-200">{row.carriesPerMinute ?? "—"}</span>
            </li>
            <li>
              Defenders beaten:{" "}
              <span className="font-mono text-zinc-200">{row.defendersBeaten}</span>
            </li>
            <li>
              Touches: <span className="font-mono text-zinc-200">{row.touches}</span>
            </li>
            <li>
              Post-contact m:{" "}
              <span className="font-mono text-zinc-200">{row.postContactMetres || "—"}</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Defence</p>
          <ul className="space-y-1 text-zinc-400 m-0 list-none p-0">
            <li>
              Rank: <span className="font-mono text-zinc-200">{row.defenceRank ?? "—"}</span>
            </li>
            <li>
              Tackles made:{" "}
              <span className="font-mono text-zinc-200">{row.tacklesMade ?? row.tacklesCompleted}</span>
            </li>
            <li>
              Tackles / min:{" "}
              <span className="font-mono text-zinc-200">{row.tacklesPerMinute ?? "—"}</span>
            </li>
            <li>
              Ruck arrival:{" "}
              <span className="font-mono text-zinc-200">{row.ruckArrivalEffectiveness || "—"}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PlayerSeasonStatsSection({
  rows,
  filterOptions,
  emptyMessage = "No season stats yet. Import a Planet Rugby match with performance data to populate player season totals.",
  hideOuterCard = false,
  hideFilters = false,
  title = "Season statistics",
}: {
  rows: PlayerSeasonStatsRow[];
  filterOptions?: SeasonStatsFilterOptions;
  emptyMessage?: string;
  hideOuterCard?: boolean;
  hideFilters?: boolean;
  title?: string;
}) {
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");

  const resolvedFilterOptions = filterOptions ?? deriveFilterOptions(rows);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (seasonId && row.seasonId !== seasonId) return false;
        if (competitionId && row.competitionId !== competitionId) return false;
        return true;
      }),
    [rows, seasonId, competitionId],
  );

  const body =
    rows.length > 0 ? (
      <>
        {!hideFilters ? (
          <SeasonStatsFiltersBar
            filterOptions={resolvedFilterOptions}
            seasonId={seasonId}
            competitionId={competitionId}
            search=""
            showSearch={false}
            onSeasonChange={setSeasonId}
            onCompetitionChange={setCompetitionId}
            onSearchChange={() => undefined}
          />
        ) : null}
        {filteredRows.length > 0 ? (
          <div className="space-y-6">
            {filteredRows.map((row) => (
              <PlayerSeasonStatsCard key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 m-0">No stats match the selected filters.</p>
        )}
      </>
    ) : (
      <p className="text-sm text-zinc-500 m-0">{emptyMessage}</p>
    );

  if (hideOuterCard) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-zinc-200 m-0 mb-3">{title}</h4>
        {body}
      </div>
    );
  }

  return (
    <div className="cms-card mb-4 overflow-x-auto">
      <h3 className="font-semibold m-0">{title}</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Aggregated Planet Rugby / SDMS performance stats by competition, season and team.
      </p>
      {body}
    </div>
  );
}

export function TeamSeasonStatsSection({ teamId }: { teamId: string }) {
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"playerName" | "tries" | "carries" | "tacklesCompleted" | "points">(
    "playerName",
  );
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TeamSeasonStatsRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<SeasonStatsFilterOptions>({
    seasons: [],
    competitions: [],
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (seasonId) params.set("seasonId", seasonId);
      if (competitionId) params.set("competitionId", competitionId);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      params.set("sortBy", sortBy);
      params.set("sortDir", sortBy === "playerName" ? "asc" : "desc");

      try {
        const res = await fetch(`/api/admin/teams/${teamId}/season-stats?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setStats(data.stats ?? []);
          setFilterOptions(data.filterOptions ?? { seasons: [], competitions: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [teamId, seasonId, competitionId, debouncedSearch, sortBy]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, TeamSeasonStatsRow[]>();
    for (const row of stats) {
      const key = `${row.competitionName} · ${row.seasonLabel}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(row);
      buckets.set(key, bucket);
    }
    return [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [stats]);

  return (
    <div className="cms-card mb-4 overflow-x-auto">
      <h3 className="font-semibold m-0">Season statistics</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        All players with imported SDMS performance stats for this team, grouped by competition and season.
      </p>

      <SeasonStatsFiltersBar
        filterOptions={filterOptions}
        seasonId={seasonId}
        competitionId={competitionId}
        search={search}
        showSearch
        onSeasonChange={setSeasonId}
        onCompetitionChange={setCompetitionId}
        onSearchChange={setSearch}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="cms-select text-sm"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="playerName">Sort: player</option>
          <option value="tries">Sort: tries</option>
          <option value="carries">Sort: carries</option>
          <option value="tacklesCompleted">Sort: tackles</option>
          <option value="points">Sort: points</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 m-0">Loading season stats…</p>
      ) : stats.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">
          No season stats for this team yet. Import Planet Rugby matches with performance data.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([groupLabel, groupRows]) => (
            <section key={groupLabel}>
              <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">
                {groupLabel}
                <span className="text-zinc-600 font-normal ml-2">({groupRows.length} players)</span>
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Player</th>
                    <th className="py-2 pr-2 text-center">Apps</th>
                    <th className="py-2 pr-2 text-center">T</th>
                    <th className="py-2 pr-2 text-center">Pts</th>
                    <th className="py-2 pr-2 text-center">Carries</th>
                    <th className="py-2 pr-2 text-center">Metres</th>
                    <th className="py-2 pr-2 text-center">Tackles</th>
                    <th className="py-2 pr-2 text-center">Turnovers</th>
                    <th className="py-2 pr-2 text-center">Atk</th>
                    <th className="py-2 pr-2 text-center">Def</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-800/60">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                          {row.playerName}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">{row.appearances}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.tries}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.points}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.carries}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.metresCarried}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.tacklesCompleted}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.turnoversWon}</td>
                      <td className="py-2 pr-2 text-center font-mono text-zinc-500">{row.attackRank ?? "—"}</td>
                      <td className="py-2 pr-2 text-center font-mono text-zinc-500">{row.defenceRank ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
