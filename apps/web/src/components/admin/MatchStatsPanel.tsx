"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlayerMatchStatsRow } from "@/lib/player-season-stats-service";
import type { TeamMatchStatsRow } from "@/lib/team-match-stats-service";

const SUMMARY_LABELS: Array<{ key: keyof TeamMatchStatsRow; label: string }> = [
  { key: "tries", label: "Tries" },
  { key: "conversions", label: "Conversions" },
  { key: "penalties", label: "Penalties" },
  { key: "dropGoals", label: "Drop goals" },
  { key: "carries", label: "Carries" },
  { key: "metres", label: "Metres" },
  { key: "tackles", label: "Tackles" },
  { key: "turnoversWon", label: "Turnovers won" },
];

function formatKickoff(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamSideCard({ row, align }: { row: TeamMatchStatsRow; align: "left" | "right" }) {
  return (
    <div className={`cms-card--nested p-4 ${align === "right" ? "text-right" : ""}`}>
      <h4 className="cms-section-title text-sm mb-3">{row.teamName}</h4>
      <dl className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm m-0 ${align === "right" ? "justify-items-end" : ""}`}>
        {SUMMARY_LABELS.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="font-mono text-zinc-200 m-0">{row[key] as number}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SectionGrid({ title, sections }: { title: string; sections: Record<string, Record<string, number>> }) {
  const entries = Object.entries(sections).filter(([, values]) => Object.keys(values).length > 0);
  if (entries.length === 0) return null;

  return (
    <section className="mt-4">
      <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">{title}</h4>
      <div className="grid gap-4 lg:grid-cols-2">
        {entries.map(([sectionName, values]) => (
          <div key={sectionName} className="cms-card--nested p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500 m-0 mb-2">
              {sectionName.replace(/_/g, " ")}
            </p>
            <ul className="space-y-1 text-sm text-zinc-400 m-0 list-none p-0">
              {Object.entries(values).map(([metric, value]) => (
                <li key={metric} className="flex justify-between gap-3">
                  <span>{metric.replace(/_/g, " ")}</span>
                  <span className="font-mono text-zinc-200">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerSquadTable({ title, rows }: { title: string; rows: PlayerMatchStatsRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-4">
      <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-2 text-center">Min</th>
            <th className="py-2 pr-2 text-center">T</th>
            <th className="py-2 pr-2 text-center">Carries</th>
            <th className="py-2 pr-2 text-center">Metres</th>
            <th className="py-2 pr-2 text-center">Tackles</th>
            <th className="py-2 pr-2 text-center">Turnovers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-zinc-800/60">
              <td className="py-2 pr-3">
                <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                  {row.playerName}
                </Link>
              </td>
              <td className="py-2 pr-2 text-center font-mono">{row.minutesPlayed}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.tries}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.carries}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.metresCarried}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.tacklesCompleted}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.turnoversWon}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function MatchStatsPanel({ fixtureId }: { fixtureId: string }) {
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<TeamMatchStatsRow[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerMatchStatsRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/matches/${fixtureId}/stats`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setTeamStats(data.teamStats ?? []);
          setPlayerStats(data.playerStats ?? []);
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
  }, [fixtureId]);

  const homeTeam = useMemo(() => teamStats.find((row) => row.side === "home"), [teamStats]);
  const awayTeam = useMemo(() => teamStats.find((row) => row.side === "away"), [teamStats]);
  const homePlayers = useMemo(
    () => playerStats.filter((row) => row.teamId === homeTeam?.teamId),
    [playerStats, homeTeam?.teamId],
  );
  const awayPlayers = useMemo(
    () => playerStats.filter((row) => row.teamId === awayTeam?.teamId),
    [playerStats, awayTeam?.teamId],
  );

  if (loading) {
    return <p className="text-sm text-zinc-500 m-0">Loading match stats…</p>;
  }

  if (teamStats.length === 0 && playerStats.length === 0) {
    return (
      <p className="text-sm text-zinc-500 m-0">
        No imported match stats yet. Sync or enrich this fixture from Planet Rugby / SDMS.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {homeTeam && awayTeam ? (
        <>
          <div>
            <h3 className="cms-section-title">Match summary</h3>
            <div className="cms-grid-2">
              <TeamSideCard row={homeTeam} align="left" />
              <TeamSideCard row={awayTeam} align="right" />
            </div>
          </div>
          <SectionGrid title="Full team stats (home)" sections={homeTeam.sections} />
          <SectionGrid title="Full team stats (away)" sections={awayTeam.sections} />
        </>
      ) : null}
      <PlayerSquadTable title={`Home squad stats${homeTeam ? ` · ${homeTeam.teamName}` : ""}`} rows={homePlayers} />
      <PlayerSquadTable title={`Away squad stats${awayTeam ? ` · ${awayTeam.teamName}` : ""}`} rows={awayPlayers} />
    </div>
  );
}

export function TeamMatchStatsSection({ teamId }: { teamId: string }) {
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TeamMatchStatsRow[]>([]);
  const [seasonSummaries, setSeasonSummaries] = useState<
    Array<{
      seasonLabel: string;
      competitionName: string;
      matches: number;
      totals: Record<string, number>;
      averages: Record<string, number>;
    }>
  >([]);
  const [filterOptions, setFilterOptions] = useState<{ seasons: Array<{ id: string; label: string }>; competitions: Array<{ id: string; name: string }> }>({
    seasons: [],
    competitions: [],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (seasonId) params.set("seasonId", seasonId);
      if (competitionId) params.set("competitionId", competitionId);
      try {
        const res = await fetch(`/api/admin/teams/${teamId}/match-stats?${params}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setStats(data.stats ?? []);
          setSeasonSummaries(data.seasonSummaries ?? []);
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
  }, [teamId, seasonId, competitionId]);

  return (
    <div className="cms-card mb-4 overflow-x-auto">
      <h3 className="font-semibold m-0">Team match statistics</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Match-by-match team stats imported from SDMS, with season totals and averages calculated from those records.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <select className="cms-select" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
          <option value="">All seasons</option>
          {filterOptions.seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </select>
        <select className="cms-select" value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
          <option value="">All competitions</option>
          {filterOptions.competitions.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 m-0">Loading team match stats…</p>
      ) : stats.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">No team match stats imported yet.</p>
      ) : (
        <>
          {seasonSummaries.length > 0 ? (
            <div className="space-y-4 mb-6">
              {seasonSummaries.map((summary) => (
                <section key={`${summary.seasonLabel}-${summary.competitionName}`} className="rounded-lg border border-zinc-800 p-4">
                  <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">
                    {summary.competitionName} · {summary.seasonLabel}
                    <span className="text-zinc-600 font-normal ml-2">({summary.matches} matches)</span>
                  </h4>
                  <div className="grid gap-4 lg:grid-cols-2 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Season totals</p>
                      <ul className="space-y-1 text-zinc-400 m-0 list-none p-0">
                        {SUMMARY_LABELS.map(({ key, label }) => (
                          <li key={key}>
                            {label}: <span className="font-mono text-zinc-200">{summary.totals[key] ?? 0}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Per-match averages</p>
                      <ul className="space-y-1 text-zinc-400 m-0 list-none p-0">
                        {SUMMARY_LABELS.map(({ key, label }) => (
                          <li key={key}>
                            {label}: <span className="font-mono text-zinc-200">{summary.averages[key] ?? 0}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Fixture</th>
                <th className="py-2 pr-3">Opponent</th>
                <th className="py-2 pr-2 text-center">T</th>
                <th className="py-2 pr-2 text-center">Carries</th>
                <th className="py-2 pr-2 text-center">Metres</th>
                <th className="py-2 pr-2 text-center">Tackles</th>
                <th className="py-2 pr-2 text-center">Turnovers</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/matches/${row.fixtureId}/edit`} className="text-emerald-400">
                      {row.fixtureSlug}
                    </Link>
                    <span className="block text-xs text-zinc-600">{formatKickoff(row.kickoffAt)}</span>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{row.opponentName ?? "—"}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.tries}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.carries}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.metres}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.tackles}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.turnoversWon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function PlayerMatchStatsSection({
  playerId,
  seasonId: controlledSeasonId,
  competitionId: controlledCompetitionId,
  hideOuterCard = false,
  hideFilters = false,
}: {
  playerId: string;
  seasonId?: string;
  competitionId?: string;
  hideOuterCard?: boolean;
  hideFilters?: boolean;
}) {
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerMatchStatsRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ seasons: Array<{ id: string; label: string }>; competitions: Array<{ id: string; name: string }> }>({
    seasons: [],
    competitions: [],
  });

  const resolvedSeasonId = controlledSeasonId ?? seasonId;
  const resolvedCompetitionId = controlledCompetitionId ?? competitionId;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (resolvedSeasonId) params.set("seasonId", resolvedSeasonId);
      if (resolvedCompetitionId) params.set("competitionId", resolvedCompetitionId);
      if (teamId) params.set("teamId", teamId);
      try {
        const res = await fetch(`/api/admin/players/${playerId}/match-stats?${params}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
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
  }, [playerId, resolvedSeasonId, resolvedCompetitionId, teamId]);

  const teamOptions = useMemo(() => {
    const teams = new Map<string, string>();
    for (const row of stats) teams.set(row.teamId, row.teamName);
    return [...teams.entries()].map(([id, name]) => ({ id, name }));
  }, [stats]);

  const filters = !hideFilters ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
      <select className="cms-select" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
        <option value="">All seasons</option>
        {filterOptions.seasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.label}
          </option>
        ))}
      </select>
      <select className="cms-select" value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
        <option value="">All competitions</option>
        {filterOptions.competitions.map((competition) => (
          <option key={competition.id} value={competition.id}>
            {competition.name}
          </option>
        ))}
      </select>
      <select className="cms-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">All teams</option>
        {teamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const tableBody =
    loading ? (
      <p className="text-sm text-zinc-500 m-0">Loading match stats…</p>
    ) : stats.length === 0 ? (
      <p className="text-sm text-zinc-500 m-0">No match stats imported yet.</p>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-3">Fixture</th>
            <th className="py-2 pr-3">Team</th>
            <th className="py-2 pr-2 text-center">Min</th>
            <th className="py-2 pr-2 text-center">T</th>
            <th className="py-2 pr-2 text-center">Carries</th>
            <th className="py-2 pr-2 text-center">Metres</th>
            <th className="py-2 pr-2 text-center">Tackles</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.id} className="border-b border-zinc-800/60">
              <td className="py-2 pr-3">
                <Link href={`/admin/matches/${row.fixtureId}/edit`} className="text-emerald-400">
                  {row.fixtureSlug}
                </Link>
                <span className="block text-xs text-zinc-600">{formatKickoff(row.kickoffAt)}</span>
              </td>
              <td className="py-2 pr-3 text-zinc-400">{row.teamName}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.minutesPlayed}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.tries}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.carries}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.metresCarried}</td>
              <td className="py-2 pr-2 text-center font-mono">{row.tacklesCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  if (hideOuterCard) {
    return (
      <div>
        {filters}
        {tableBody}
      </div>
    );
  }

  return (
    <div className="cms-card mb-4 overflow-x-auto">
      <h3 className="font-semibold m-0">Match statistics</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Match-by-match player performance imported from SDMS. Season totals above are calculated from these records.
      </p>
      {filters}
      {tableBody}
    </div>
  );
}
