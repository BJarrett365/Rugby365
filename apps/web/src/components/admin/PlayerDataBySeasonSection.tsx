"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerSeasonStatsRow } from "@/lib/player-season-stats-service";
import { PlayerMatchStatsSection } from "@/components/admin/MatchStatsPanel";
import { PlayerSeasonStatsSection } from "@/components/admin/SeasonStatsPanel";

type FilterOptions = {
  seasons: Array<{ id: string; label: string }>;
  competitions: Array<{ id: string; name: string }>;
};

export function PlayerDataBySeasonSection({
  playerId,
  seasonRows,
}: {
  playerId: string;
  seasonRows: PlayerSeasonStatsRow[];
}) {
  const filterOptions = useMemo<FilterOptions>(() => {
    const seasons = new Map<string, string>();
    const competitions = new Map<string, string>();
    for (const row of seasonRows) {
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
  }, [seasonRows]);

  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");

  useEffect(() => {
    if (!seasonId && filterOptions.seasons.length > 0) {
      setSeasonId(filterOptions.seasons[0].id);
    }
  }, [filterOptions.seasons, seasonId]);

  const filteredSeasonRows = useMemo(
    () =>
      seasonRows.filter((row) => {
        if (seasonId && row.seasonId !== seasonId) return false;
        if (competitionId && row.competitionId !== competitionId) return false;
        return true;
      }),
    [seasonRows, seasonId, competitionId],
  );

  return (
    <div className="cms-card mb-4 overflow-x-auto">
      <h3 className="font-semibold m-0">Player data by season</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Season aggregates and match-by-match SDMS performance. Use the filters to focus on one season or
        competition.
      </p>

      {filterOptions.seasons.length > 0 || filterOptions.competitions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <label className="block text-sm">
            <span className="text-zinc-400">Season</span>
            <select
              className="cms-select w-full mt-1"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              <option value="">All seasons</option>
              {filterOptions.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Competition</span>
            <select
              className="cms-select w-full mt-1"
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
            >
              <option value="">All competitions</option>
              {filterOptions.competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <PlayerSeasonStatsSection
        rows={filteredSeasonRows}
        filterOptions={filterOptions}
        emptyMessage="No season stats yet. Import a Planet Rugby match with performance data to populate player season totals."
        hideOuterCard
        hideFilters
      />

      <div className="border-t border-zinc-800 mt-6 pt-6">
        <h4 className="text-sm font-semibold text-zinc-200 m-0 mb-3">Match-by-match</h4>
        <PlayerMatchStatsSection
          playerId={playerId}
          seasonId={seasonId}
          competitionId={competitionId}
          hideOuterCard
        />
      </div>
    </div>
  );
}
