"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MATCH_ACTION_OPTIONS,
  MATCH_PHASE_OPTIONS,
  buildCommentaryBody,
  formatPlayerRole,
  type MatchAction,
  type MatchPhase,
} from "@/lib/commentary-entry";
import type { FixtureSummary } from "./CommentaryFeed";

type SquadPlayer = {
  playerId?: string;
  name: string;
  jerseyNumber?: number | null;
  positionName?: string | null;
  clubName?: string | null;
  side: "home" | "away" | null;
};

export function CommentaryEntryForm({
  fixtureId,
  fixture,
  homeName,
  awayName,
  onPublished,
}: {
  fixtureId: string;
  fixture: FixtureSummary;
  homeName: string;
  awayName: string;
  onPublished: (line: { id: string; minute: number; body: string; publishedAt: string }) => void;
}) {
  const [minute, setMinute] = useState("23");
  const [phase, setPhase] = useState<MatchPhase>("match_event");
  const [teamSide, setTeamSide] = useState<"home" | "away">("away");
  const [action, setAction] = useState<MatchAction>("try");
  const [playerKey, setPlayerKey] = useState("");
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/fixtures/${fixtureId}/squad`)
      .then((r) => r.json())
      .then((d) => {
        const fromDb: SquadPlayer[] = (d.squad ?? []).map(
          (p: {
            playerId: string;
            name: string;
            jerseyNumber: number | null;
            positionName: string | null;
            clubName: string | null;
            side: "home" | "away" | null;
          }) => ({
            playerId: p.playerId,
            name: p.name,
            jerseyNumber: p.jerseyNumber,
            positionName: p.positionName,
            clubName: p.clubName,
            side: p.side,
          }),
        );
        const fromSnap: SquadPlayer[] = (d.snapshotPlayers ?? []).map(
          (p: {
            name: string;
            jerseyNumber: number;
            positionName?: string;
            clubName?: string;
            side: "home" | "away";
          }) => ({
            name: p.name,
            jerseyNumber: p.jerseyNumber,
            positionName: p.positionName ?? null,
            clubName: p.clubName ?? null,
            side: p.side,
          }),
        );
        const merged = fromDb.length > 0 ? fromDb : fromSnap;
        setSquadPlayers(merged);
      })
      .catch(() => setSquadPlayers([]));
  }, [fixtureId]);

  useEffect(() => {
    const defaults = MATCH_PHASE_OPTIONS.find((p) => p.value === phase);
    if (defaults?.defaultMinute !== undefined && phase !== "match_event") {
      setMinute(String(defaults.defaultMinute));
    }
  }, [phase]);

  const teamPlayers = useMemo(
    () => squadPlayers.filter((p) => p.side === teamSide),
    [squadPlayers, teamSide],
  );

  const selectedPlayer = useMemo(() => {
    if (!playerKey) return null;
    return teamPlayers.find((p) => playerOptionKey(p) === playerKey) ?? null;
  }, [playerKey, teamPlayers]);

  const preview = useMemo(() => {
    const parsedMinute = Number(minute);
    const playerRole = selectedPlayer
      ? formatPlayerRole(
          selectedPlayer.positionName ?? undefined,
          selectedPlayer.clubName ?? undefined,
        )
      : "";
    return buildCommentaryBody({
      minute: Number.isFinite(parsedMinute) ? parsedMinute : 0,
      phase,
      action: phase === "match_event" ? action : undefined,
      teamSide: phase === "match_event" ? teamSide : undefined,
      homeName,
      awayName,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      venueName: fixture.venueName ?? undefined,
      playerName: selectedPlayer?.name,
      playerRole,
    }).body;
  }, [
    minute,
    phase,
    action,
    teamSide,
    homeName,
    awayName,
    fixture.homeScore,
    fixture.awayScore,
    fixture.venueName,
    selectedPlayer,
  ]);

  const showEventFields = phase === "match_event";
  const actionMeta = MATCH_ACTION_OPTIONS.find((a) => a.value === action);
  const showPlayer = showEventFields && (actionMeta?.needsPlayer ?? true);

  async function publish() {
    setPublishing(true);
    setError("");
    const parsedMinute = Number(minute);
    const playerRole = selectedPlayer
      ? formatPlayerRole(
          selectedPlayer.positionName ?? undefined,
          selectedPlayer.clubName ?? undefined,
        )
      : "";

    const res = await fetch(`/api/fixtures/${fixtureId}/commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minute: Number.isFinite(parsedMinute) ? parsedMinute : 0,
        phase,
        action: showEventFields ? action : undefined,
        teamSide: showEventFields ? teamSide : undefined,
        playerName: selectedPlayer?.name,
        playerRole,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onPublished(data.line);
      if (phase === "match_event" && action === "try") {
        setMinute(String(parsedMinute));
      }
    } else {
      setError(data.error ?? "Failed to publish");
    }
    setPublishing(false);
  }

  return (
    <div className="cms-card mb-4 no-print">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 m-0">
        Add commentary
      </h2>
      <p className="text-xs text-zinc-500 mt-1 mb-4">
        Set the minute and match moment, then pick team, player and action to build the line.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs text-zinc-500">Minute</span>
          <input
            type="number"
            min={0}
            max={120}
            className="cms-input w-full mt-1"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-500">Match moment</span>
          <select
            className="cms-input w-full mt-1"
            value={phase}
            onChange={(e) => setPhase(e.target.value as MatchPhase)}
          >
            {MATCH_PHASE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {showEventFields && (
          <>
            <label className="block">
              <span className="text-xs text-zinc-500">Action</span>
              <select
                className="cms-input w-full mt-1"
                value={action}
                onChange={(e) => setAction(e.target.value as MatchAction)}
              >
                {MATCH_ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="block sm:col-span-2">
              <legend className="text-xs text-zinc-500 mb-1">Team</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`cms-btn text-xs flex-1 ${teamSide === "home" ? "cms-btn--primary" : "cms-btn--secondary"}`}
                  onClick={() => {
                    setTeamSide("home");
                    setPlayerKey("");
                  }}
                >
                  Home — {homeName}
                </button>
                <button
                  type="button"
                  className={`cms-btn text-xs flex-1 ${teamSide === "away" ? "cms-btn--primary" : "cms-btn--secondary"}`}
                  onClick={() => {
                    setTeamSide("away");
                    setPlayerKey("");
                  }}
                >
                  Away — {awayName}
                </button>
              </div>
            </fieldset>

            {showPlayer && (
              <label className="block sm:col-span-2">
                <span className="text-xs text-zinc-500">Player</span>
                <select
                  className="cms-input w-full mt-1"
                  value={playerKey}
                  onChange={(e) => setPlayerKey(e.target.value)}
                >
                  <option value="">Select player</option>
                  {teamPlayers.map((p) => (
                    <option key={playerOptionKey(p)} value={playerOptionKey(p)}>
                      {formatPlayerOption(p)}
                    </option>
                  ))}
                </select>
                {teamPlayers.length === 0 && (
                  <span className="text-xs text-amber-500/90 mt-1 block">
                    No squad loaded — sync Sport365 or add squad in CMS.
                  </span>
                )}
              </label>
            )}
          </>
        )}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
        <p className="text-xs text-zinc-500 m-0 mb-1">Preview</p>
        <p className="text-sm text-zinc-100 m-0">{preview}</p>
      </div>

      {error && <p className="text-red-400 text-sm mt-2 m-0">{error}</p>}

      <button
        type="button"
        disabled={publishing || (showPlayer && actionMeta?.needsPlayer && !selectedPlayer)}
        onClick={publish}
        className="cms-btn cms-btn--primary mt-4"
      >
        {publishing ? "Publishing…" : "Publish commentary"}
      </button>
    </div>
  );
}

function playerOptionKey(p: SquadPlayer) {
  return `${p.name}:${p.jerseyNumber ?? ""}`;
}

function formatPlayerOption(p: SquadPlayer) {
  const role = formatPlayerRole(p.positionName ?? undefined, p.clubName ?? undefined);
  const jersey = p.jerseyNumber != null ? `#${p.jerseyNumber} ` : "";
  return `${jersey}${p.name}${role}`;
}
