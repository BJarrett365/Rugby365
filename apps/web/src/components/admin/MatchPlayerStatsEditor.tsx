"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MatchCmsInfoHeader } from "@/components/admin/MatchCmsInfoHeader";
import type { PlayerMatchStatsRow } from "@/lib/player-season-stats-service";

type SquadPlayer = {
  id: string;
  playerId: string;
  teamId: string;
  playerName: string;
  jerseyNumber: number | null;
};

type Draft = {
  playerId: string;
  teamId: string;
  playerName: string;
  minutesPlayed: string;
  points: string;
  tries: string;
  carries: string;
  metresCarried: string;
  lineBreaks: string;
  defendersBeaten: string;
  tacklesCompleted: string;
  turnoversWon: string;
};

const COLS: Array<{ key: keyof Draft; label: string }> = [
  { key: "minutesPlayed", label: "MINS" },
  { key: "points", label: "PTS" },
  { key: "tries", label: "TRS" },
  { key: "carries", label: "CAR" },
  { key: "metresCarried", label: "MET" },
  { key: "lineBreaks", label: "CLR" },
  { key: "defendersBeaten", label: "DEB" },
  { key: "tacklesCompleted", label: "TCK" },
  { key: "turnoversWon", label: "TOV" },
];

function toDraft(player: SquadPlayer, stats?: PlayerMatchStatsRow): Draft {
  return {
    playerId: player.playerId,
    teamId: player.teamId,
    playerName: player.playerName,
    minutesPlayed: String(stats?.minutesPlayed ?? 0),
    points: String(stats?.points ?? 0),
    tries: String(stats?.tries ?? 0),
    carries: String(stats?.carries ?? 0),
    metresCarried: String(stats?.metresCarried ?? 0),
    lineBreaks: String(stats?.lineBreaks ?? 0),
    defendersBeaten: String(stats?.defendersBeaten ?? 0),
    tacklesCompleted: String(stats?.tacklesCompleted ?? 0),
    turnoversWon: String(stats?.turnoversWon ?? 0),
  };
}

function SideGrid({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: Draft[];
  onChange: (playerId: string, key: keyof Draft, value: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h4 className="cms-section-title text-sm m-0">{title}</h4>
      <div className="cms-table-scroll">
        <table className="cms-table w-full text-xs match-cms-dense-table match-cms-player-stats-grid">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1]">Player</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId}>
                <td className="sticky left-0 z-[1] whitespace-nowrap">
                  <Link href={`/admin/players/${row.playerId}/edit`} className="match-cms-team-link">
                    {row.playerName}
                  </Link>
                </td>
                {COLS.map((c) => (
                  <td key={c.key}>
                    <input
                      className="cms-input match-cms-score-input"
                      inputMode="numeric"
                      value={row[c.key]}
                      onChange={(e) => onChange(row.playerId, c.key, e.target.value.replace(/[^\d]/g, ""))}
                      aria-label={`${row.playerName} ${c.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className="match-cms-muted">
                  No squad players — sync lineups first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MatchPlayerStatsEditor({ fixtureId }: { fixtureId: string }) {
  const [fixtureMeta, setFixtureMeta] = useState<{
    id: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
    kickoffAt: string | null;
    status: string;
  } | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const [statsRes, squadRes] = await Promise.all([
      fetch(`/api/admin/matches/${fixtureId}/stats`),
      fetch(`/api/admin/squads/${fixtureId}`),
    ]);
    const stats = await statsRes.json();
    const squad = await squadRes.json();
    if (!statsRes.ok) throw new Error(stats.error ?? "Failed to load stats");
    if (!squadRes.ok) throw new Error(squad.error ?? "Failed to load squad");

    setFixtureMeta(stats.fixture);
    const squadPlayers = (squad.squad ?? []) as SquadPlayer[];
    const playerStats = (stats.playerStats ?? []) as PlayerMatchStatsRow[];
    const byPlayer = new Map(playerStats.map((r) => [r.playerId, r]));

    const fromSquad = squadPlayers.map((p) => toDraft(p, byPlayer.get(p.playerId)));
    if (fromSquad.length > 0) {
      setDrafts(fromSquad);
      return;
    }

    // Fall back to existing player stats rows when squad is empty
    setDrafts(
      playerStats.map((r) =>
        toDraft(
          {
            id: r.id,
            playerId: r.playerId,
            teamId: r.teamId,
            playerName: r.playerName,
            jerseyNumber: null,
          },
          r,
        ),
      ),
    );
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const homeRows = useMemo(
    () => drafts.filter((d) => d.teamId === fixtureMeta?.homeTeamId),
    [drafts, fixtureMeta?.homeTeamId],
  );
  const awayRows = useMemo(
    () => drafts.filter((d) => d.teamId === fixtureMeta?.awayTeamId),
    [drafts, fixtureMeta?.awayTeamId],
  );

  function onChange(playerId: string, key: keyof Draft, value: string) {
    setDrafts((prev) => prev.map((row) => (row.playerId === playerId ? { ...row, [key]: value } : row)));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "player_batch",
          drafts: drafts.map((d) => ({
            playerId: d.playerId,
            teamId: d.teamId,
            minutesPlayed: Number(d.minutesPlayed || 0),
            points: Number(d.points || 0),
            tries: Number(d.tries || 0),
            carries: Number(d.carries || 0),
            metresCarried: Number(d.metresCarried || 0),
            lineBreaks: Number(d.lineBreaks || 0),
            defendersBeaten: Number(d.defendersBeaten || 0),
            tacklesMade: Number(d.tacklesCompleted || 0),
            tacklesCompleted: Number(d.tacklesCompleted || 0),
            turnoversWon: Number(d.turnoversWon || 0),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMessage(`Saved player stats for ${drafts.length} players.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="match-cms-muted text-sm m-0">Loading player stats…</p>;
  if (error && !fixtureMeta) return <p className="match-cms-error m-0">{error}</p>;
  if (!fixtureMeta) return null;

  return (
    <div className="match-cms-editor space-y-4">
      <MatchCmsInfoHeader
        matchId={fixtureMeta.id}
        homeTeam={{ id: fixtureMeta.homeTeamId, name: fixtureMeta.homeTeamName }}
        awayTeam={{ id: fixtureMeta.awayTeamId, name: fixtureMeta.awayTeamName }}
        kickoffAt={fixtureMeta.kickoffAt}
        status={fixtureMeta.status}
        actions={
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={saving || drafts.length === 0}
            onClick={() => {
              void save();
            }}
          >
            {saving ? "Saving…" : "Save player stats"}
          </button>
        }
      />

      <SideGrid
        title={`Home · ${fixtureMeta.homeTeamName ?? "Home"}`}
        rows={homeRows}
        onChange={onChange}
      />
      <SideGrid
        title={`Away · ${fixtureMeta.awayTeamName ?? "Away"}`}
        rows={awayRows}
        onChange={onChange}
      />

      {error ? <p className="match-cms-error">{error}</p> : null}
      {message ? <p className="match-sources__ok">{message}</p> : null}
    </div>
  );
}
