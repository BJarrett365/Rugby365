"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type SquadPlayer = {
  id: string;
  playerId: string;
  teamId: string;
  playerName: string;
  jerseyNumber: number | null;
  squadRole: string;
  positionName: string | null;
  clubName: string | null;
};

type PlayerOption = { id: string; name: string };

export default function FixtureSquadPage() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fixtureLabel, setFixtureLabel] = useState("");
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [teams, setTeams] = useState<TeamPickerGroup[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [addForm, setAddForm] = useState({
    playerId: "",
    teamId: "",
    jerseyNumber: "",
    squadRole: "starting",
    positionName: "",
    clubName: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [squadRes, teamsRes, playersRes] = await Promise.all([
      fetch(`/api/admin/squads/${fixtureId}`),
      fetch("/api/admin/teams?grouped=1"),
      fetch("/api/admin/players"),
    ]);
    const squadData = await squadRes.json();
    const teamsData = await teamsRes.json();
    const playersData = await playersRes.json();

    if (squadData.fixture) {
      const f = squadData.fixture;
      setFixtureLabel(`${f.homeTeam?.name ?? "Home"} vs ${f.awayTeam?.name ?? "Away"}`);
      setAddForm((form) => ({
        ...form,
        teamId: form.teamId || f.homeTeamId || "",
      }));
    }
    setSquad(squadData.squad ?? []);
    setSnapshotCount(squadData.snapshotPlayerCount ?? 0);
    setHasSnapshot(Boolean(squadData.hasSnapshotLineups));
    setTeams(teamsData.groups ?? []);
    setPlayers((playersData.players ?? []).map((p: PlayerOption) => ({ id: p.id, name: p.name })));
    setLoading(false);
  }, [fixtureId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function syncFromMatch() {
    setSyncing(true);
    const res = await fetch(`/api/admin/squads/${fixtureId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-from-match" }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Synced ${data.synced} players from match lineups.`);
      await load();
    } else alert(data.error ?? "Sync failed");
    setSyncing(false);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/squads/${fixtureId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        jerseyNumber: addForm.jerseyNumber ? Number(addForm.jerseyNumber) : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddForm((f) => ({ ...f, playerId: "", jerseyNumber: "", positionName: "", clubName: "" }));
      await load();
    } else alert(data.error ?? "Failed to add player");
  }

  async function removeSquadPlayer(squadPlayerId: string, name: string) {
    if (!confirm(`Remove ${name} from squad?`)) return;
    const res = await fetch(`/api/admin/squads/${fixtureId}?squadPlayerId=${squadPlayerId}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else {
      const data = await res.json();
      alert(data.error ?? "Remove failed");
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title={fixtureLabel || "Match squad"}
        description={
          hasSnapshot
            ? `${snapshotCount} players in Sport365 snapshot · ${squad.length} stored in database`
            : "No lineups in match snapshot — sync Sport365 on the match first"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {hasSnapshot && (
              <button
                type="button"
                disabled={syncing}
                onClick={syncFromMatch}
                className="cms-btn cms-btn--secondary touch-target"
              >
                {syncing ? "Syncing…" : "Map from match lineups"}
              </button>
            )}
            <Link href="/admin/squads" className="cms-btn cms-btn--secondary touch-target">
              All squads
            </Link>
          </div>
        }
      />

      <div className="cms-card mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Player</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Position</th>
              <th className="py-2 pr-3">Club</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {squad.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">
                  No squad stored. Map from match lineups or add players below.
                </td>
              </tr>
            )}
            {squad.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/60">
                <td className="py-2 pr-3 font-mono">{p.jerseyNumber ?? "—"}</td>
                <td className="py-2 pr-3">
                  <Link href={`/admin/players/${p.playerId}/edit`} className="text-emerald-400">
                    {p.playerName}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-zinc-400">{p.squadRole}</td>
                <td className="py-2 pr-3 text-zinc-400">{p.positionName ?? "—"}</td>
                <td className="py-2 pr-3 text-zinc-400">{p.clubName ?? "—"}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeSquadPlayer(p.id, p.playerName)}
                    className="text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addPlayer} className="cms-card space-y-3 max-w-xl">
        <h3 className="font-semibold m-0">Add player to squad</h3>
        <select
          className="cms-input w-full"
          value={addForm.playerId}
          onChange={(e) => setAddForm((f) => ({ ...f, playerId: e.target.value }))}
          required
        >
          <option value="">Select player</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <GroupedTeamSelect
          value={addForm.teamId}
          onChange={(value) => setAddForm((f) => ({ ...f, teamId: value }))}
          groups={teams}
          placeholder="Select team"
          required
          className="cms-input w-full"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="cms-input"
            placeholder="Jersey #"
            value={addForm.jerseyNumber}
            onChange={(e) => setAddForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
          />
          <select
            className="cms-input"
            value={addForm.squadRole}
            onChange={(e) => setAddForm((f) => ({ ...f, squadRole: e.target.value }))}
          >
            <option value="starting">Starting</option>
            <option value="substitute">Substitute</option>
          </select>
        </div>
        <input
          className="cms-input w-full"
          placeholder="Position (fly-half)"
          value={addForm.positionName}
          onChange={(e) => setAddForm((f) => ({ ...f, positionName: e.target.value }))}
        />
        <input
          className="cms-input w-full"
          placeholder="Club (Ospreys)"
          value={addForm.clubName}
          onChange={(e) => setAddForm((f) => ({ ...f, clubName: e.target.value }))}
        />
        <button type="submit" className="cms-btn cms-btn--primary text-sm">
          Add to squad
        </button>
      </form>
    </>
  );
}
