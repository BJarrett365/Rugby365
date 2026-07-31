"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MatchCmsInfoHeader } from "@/components/admin/MatchCmsInfoHeader";
import { AdminMatchLineupSection } from "@/components/admin/AdminMatchLineupSection";
import type { Sport365Lineups } from "@rugby365/match-operator-agent";

type SquadPlayer = {
  id: string;
  playerId: string;
  teamId: string;
  jerseyNumber: number | null;
  squadRole: string;
  positionName: string | null;
  playerName: string;
};

type PickerPlayer = { id: string; name: string };

type SquadDetail = {
  fixture: {
    id: string;
    status: string;
    kickoffAt: string | Date | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
    halfTimeHome?: number | null;
    halfTimeAway?: number | null;
    attendance?: number | null;
    competitionName?: string | null;
    competition?: { slug?: string | null; name?: string | null } | null;
    providerSnapshot?: { lineups?: Sport365Lineups } | null;
  };
  squad: SquadPlayer[];
  hasSnapshotLineups: boolean;
};

const ROLES = ["starting", "substitute", "bench"] as const;

function TeamLineupColumn({
  title,
  teamId,
  players,
  picker,
  busy,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  teamId: string;
  players: SquadPlayer[];
  picker: PickerPlayer[];
  busy: boolean;
  onAdd: (input: {
    playerId: string;
    jerseyNumber: number;
    squadRole: string;
    positionName: string;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    patch: { jerseyNumber?: number; squadRole?: string; positionName?: string },
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [playerId, setPlayerId] = useState("");
  const [jersey, setJersey] = useState("");
  const [role, setRole] = useState<string>("starting");
  const [position, setPosition] = useState("");

  const sorted = useMemo(
    () =>
      [...players].sort(
        (a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99) || a.playerName.localeCompare(b.playerName),
      ),
    [players],
  );

  return (
    <div className="cms-card--nested p-3 match-cms-editor-col">
      <h4 className="cms-section-title text-sm m-0 mb-3">{title}</h4>
      <div className="match-cms-editor-form">
        <select
          className="cms-select"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          aria-label={`${title} player`}
        >
          <option value="">Player</option>
          {picker.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className="cms-input"
          placeholder="Pos"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          aria-label="Position"
        />
        <input
          className="cms-input"
          placeholder="#"
          inputMode="numeric"
          value={jersey}
          onChange={(e) => setJersey(e.target.value.replace(/[^\d]/g, ""))}
          aria-label="Order"
        />
        <select className="cms-select" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={busy || !playerId}
          onClick={() => {
            void onAdd({
              playerId,
              jerseyNumber: Number(jersey || 0),
              squadRole: role,
              positionName: position,
            }).then(() => {
              setPlayerId("");
              setJersey("");
              setPosition("");
              setRole("starting");
            });
          }}
        >
          Add
        </button>
      </div>

      <div className="cms-table-scroll max-h-[28rem] mt-3">
        <table className="cms-table w-full text-sm match-cms-dense-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Name</th>
              <th>Position</th>
              <th>Role</th>
              <th className="w-16"> </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className={
                  row.squadRole === "starting" ? undefined : "match-cms-lineup-row--bench"
                }
              >
                <td>
                  <input
                    className="cms-input match-cms-score-input"
                    value={row.jerseyNumber ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, "") || 0);
                      void onUpdate(row.id, { jerseyNumber: n });
                    }}
                    aria-label={`${row.playerName} jersey`}
                  />
                </td>
                <td>
                  <Link href={`/admin/players/${row.playerId}/edit`} className="match-cms-team-link">
                    {row.playerName}
                  </Link>
                </td>
                <td>
                  <input
                    className="cms-input text-xs h-7"
                    value={row.positionName ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      void onUpdate(row.id, { positionName: e.target.value });
                    }}
                    aria-label={`${row.playerName} position`}
                  />
                </td>
                <td>
                  <select
                    className="cms-select text-xs h-7"
                    value={row.squadRole}
                    disabled={busy}
                    onChange={(e) => {
                      void onUpdate(row.id, { squadRole: e.target.value });
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="cms-btn cms-btn--danger text-xs"
                    disabled={busy}
                    onClick={() => {
                      void onRemove(row.id);
                    }}
                  >
                    Del
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="match-cms-muted text-sm">
                  No squad players yet for this side.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="match-cms-muted text-xs m-0 mt-2">Team id used for adds: {teamId.slice(0, 8)}…</p>
    </div>
  );
}

export function MatchLineupsEditor({
  fixtureId,
  onChanged,
}: {
  fixtureId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const [detail, setDetail] = useState<SquadDetail | null>(null);
  const [picker, setPicker] = useState<PickerPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/squads/${fixtureId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load squad");
    setDetail(data as SquadDetail);
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError("");
      try {
        const [squadRes, playersRes] = await Promise.all([
          fetch(`/api/admin/squads/${fixtureId}`),
          fetch("/api/admin/players?picker=1"),
        ]);
        const squadData = await squadRes.json();
        const playersData = await playersRes.json();
        if (!squadRes.ok) throw new Error(squadData.error ?? "Failed to load squad");
        if (!cancelled) {
          setDetail(squadData as SquadDetail);
          const rows = (playersData.players ?? playersData ?? []) as Array<{ id: string; name: string }>;
          setPicker(rows.map((p) => ({ id: p.id, name: p.name })).slice(0, 800));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load lineups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  async function syncFromSnapshot() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/squads/${fixtureId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-from-match" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      await reload();
      setMessage("Lineup players saved to squad from match snapshot.");
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer(
    teamId: string,
    input: { playerId: string; jerseyNumber: number; squadRole: string; positionName: string },
  ) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/squads/${fixtureId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, teamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed");
      await reload();
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function updatePlayer(
    id: string,
    patch: { jerseyNumber?: number; squadRole?: string; positionName?: string },
  ) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/squads/${fixtureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squadPlayerId: id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/squads/${fixtureId}?squadPlayerId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remove failed");
      await reload();
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="match-cms-muted text-sm m-0">Loading lineups…</p>;
  if (error && !detail) return <p className="match-cms-error m-0">{error}</p>;
  if (!detail) return null;

  const homeId = detail.fixture.homeTeamId ?? "";
  const awayId = detail.fixture.awayTeamId ?? "";
  const homePlayers = detail.squad.filter((p) => p.teamId === homeId);
  const awayPlayers = detail.squad.filter((p) => p.teamId === awayId);
  const lineups = detail.fixture.providerSnapshot?.lineups;

  return (
    <div className="match-cms-editor space-y-4">
      <MatchCmsInfoHeader
        matchId={detail.fixture.id}
        homeTeam={detail.fixture.homeTeam}
        awayTeam={detail.fixture.awayTeam}
        kickoffAt={detail.fixture.kickoffAt}
        status={detail.fixture.status}
        halfTimeHome={detail.fixture.halfTimeHome}
        halfTimeAway={detail.fixture.halfTimeAway}
        attendance={detail.fixture.attendance}
        competitionSlug={detail.fixture.competition?.slug ?? null}
        competitionName={detail.fixture.competition?.name ?? detail.fixture.competitionName}
        actions={
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy || !detail.hasSnapshotLineups}
            onClick={() => {
              void syncFromSnapshot();
            }}
          >
            Save lineup players to squad
          </button>
        }
      />

      <div className="cms-grid-2">
        {homeId ? (
          <TeamLineupColumn
            title={`${detail.fixture.homeTeam?.name ?? "Home"} lineups`}
            teamId={homeId}
            players={homePlayers}
            picker={picker}
            busy={busy}
            onAdd={(input) => addPlayer(homeId, input)}
            onUpdate={updatePlayer}
            onRemove={removePlayer}
          />
        ) : null}
        {awayId ? (
          <TeamLineupColumn
            title={`${detail.fixture.awayTeam?.name ?? "Away"} lineups`}
            teamId={awayId}
            players={awayPlayers}
            picker={picker}
            busy={busy}
            onAdd={(input) => addPlayer(awayId, input)}
            onUpdate={updatePlayer}
            onRemove={removePlayer}
          />
        ) : null}
      </div>

      {lineups ? (
        <div>
          <h4 className="cms-section-title text-sm">Player ratings</h4>
          <AdminMatchLineupSection
            lineups={lineups}
            homeFallback={detail.fixture.homeTeam?.name ?? "Home"}
            awayFallback={detail.fixture.awayTeam?.name ?? "Away"}
            fixtureId={fixtureId}
            matchStatus={detail.fixture.status}
          />
        </div>
      ) : null}

      {error ? <p className="match-cms-error">{error}</p> : null}
      {message ? <p className="match-sources__ok">{message}</p> : null}
    </div>
  );
}
