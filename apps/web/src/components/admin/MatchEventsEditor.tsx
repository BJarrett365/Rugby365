"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MatchCmsInfoHeader } from "@/components/admin/MatchCmsInfoHeader";
import {
  CARD_EVENT_TYPES,
  SCORING_EVENT_TYPES,
  TMO_EVENT_TYPES,
} from "@/lib/match-cms-data-shared";

type SquadPlayer = {
  playerId: string;
  teamId: string;
  playerName: string;
  jerseyNumber?: number | null;
};

type EventRow = {
  id: string;
  eventType: string;
  minute: number;
  teamId: string | null;
  playerId: string | null;
  payload: Record<string, unknown> | null;
  runningScore: [number, number] | null;
};

type FixtureMeta = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  kickoffAt: string | Date | null;
  status: string;
};

function payloadName(payload: Record<string, unknown> | null, key: string): string {
  const v = payload?.[key];
  return typeof v === "string" ? v : "";
}

function EventTable({
  rows,
  teamName,
  onDelete,
  busy,
  showScore,
  showAssist,
  showSub,
}: {
  rows: EventRow[];
  teamName: (teamId: string | null) => string;
  onDelete: (id: string) => void;
  busy: boolean;
  showScore?: boolean;
  showAssist?: boolean;
  showSub?: boolean;
}) {
  return (
    <div className="cms-table-scroll">
      <table className="cms-table w-full text-sm match-cms-dense-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Type</th>
            {showSub ? (
              <>
                <th>Out</th>
                <th>In</th>
              </>
            ) : (
              <th>Player</th>
            )}
            {showAssist ? <th>Assist</th> : null}
            <th>Min</th>
            {showScore ? <th>Score</th> : null}
            <th> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{teamName(row.teamId)}</td>
              <td className="capitalize">{row.eventType.replace(/_/g, " ")}</td>
              {showSub ? (
                <>
                  <td>{payloadName(row.payload, "playerOutName") || "—"}</td>
                  <td>{payloadName(row.payload, "playerInName") || "—"}</td>
                </>
              ) : (
                <td>{payloadName(row.payload, "playerName") || "—"}</td>
              )}
              {showAssist ? <td>{payloadName(row.payload, "assistPlayerName") || "—"}</td> : null}
              <td className="font-mono">{row.minute}&apos;</td>
              {showScore ? (
                <td className="font-mono">
                  {row.runningScore ? `${row.runningScore[0]}–${row.runningScore[1]}` : "—"}
                </td>
              ) : null}
              <td>
                <button
                  type="button"
                  className="cms-btn cms-btn--danger text-xs"
                  disabled={busy}
                  onClick={() => onDelete(row.id)}
                >
                  Del
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="match-cms-muted">
                No events in this section yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function MatchEventsEditor({ fixtureId }: { fixtureId: string }) {
  const [fixture, setFixture] = useState<FixtureMeta | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [goalTeamId, setGoalTeamId] = useState("");
  const [goalType, setGoalType] = useState<string>("try");
  const [goalPlayerId, setGoalPlayerId] = useState("");
  const [goalAssistId, setGoalAssistId] = useState("");
  const [goalMinute, setGoalMinute] = useState("");

  const [cardTeamId, setCardTeamId] = useState("");
  const [cardType, setCardType] = useState<string>("yellow_card");
  const [cardPlayerId, setCardPlayerId] = useState("");
  const [cardMinute, setCardMinute] = useState("");

  const [subTeamId, setSubTeamId] = useState("");
  const [subOutId, setSubOutId] = useState("");
  const [subInId, setSubInId] = useState("");
  const [subMinute, setSubMinute] = useState("");

  const [tmoTeamId, setTmoTeamId] = useState("");
  const [tmoType, setTmoType] = useState<string>("tmo_review");
  const [tmoMinute, setTmoMinute] = useState("");
  const [tmoNote, setTmoNote] = useState("");

  const reload = useCallback(async () => {
    const [matchRes, eventsRes, squadRes] = await Promise.all([
      fetch(`/api/admin/matches/${fixtureId}`),
      fetch(`/api/admin/matches/${fixtureId}/events`),
      fetch(`/api/admin/squads/${fixtureId}`),
    ]);
    const match = await matchRes.json();
    const ev = await eventsRes.json();
    const sq = await squadRes.json();
    if (!matchRes.ok) throw new Error(match.error ?? "Failed to load match");
    if (!eventsRes.ok) throw new Error(ev.error ?? "Failed to load events");
    setFixture(match.fixture as FixtureMeta);
    setEvents((ev.events ?? []) as EventRow[]);
    setSquad((sq.squad ?? []) as SquadPlayer[]);
    if (!goalTeamId && match.fixture?.homeTeamId) setGoalTeamId(match.fixture.homeTeamId);
    if (!cardTeamId && match.fixture?.homeTeamId) setCardTeamId(match.fixture.homeTeamId);
    if (!subTeamId && match.fixture?.homeTeamId) setSubTeamId(match.fixture.homeTeamId);
    if (!tmoTeamId && match.fixture?.homeTeamId) setTmoTeamId(match.fixture.homeTeamId);
  }, [fixtureId, goalTeamId, cardTeamId, subTeamId, tmoTeamId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [fixtureId]);

  const teamName = useCallback(
    (teamId: string | null) => {
      if (!fixture || !teamId) return "—";
      if (teamId === fixture.homeTeamId) return fixture.homeTeam?.name ?? "Home";
      if (teamId === fixture.awayTeamId) return fixture.awayTeam?.name ?? "Away";
      return "—";
    },
    [fixture],
  );

  const playersFor = useCallback(
    (teamId: string) => squad.filter((p) => p.teamId === teamId),
    [squad],
  );

  const scoring = useMemo(
    () => events.filter((e) => (SCORING_EVENT_TYPES as readonly string[]).includes(e.eventType)),
    [events],
  );
  const cards = useMemo(
    () => events.filter((e) => (CARD_EVENT_TYPES as readonly string[]).includes(e.eventType)),
    [events],
  );
  const subs = useMemo(() => events.filter((e) => e.eventType === "substitution"), [events]);
  const tmoEvents = useMemo(
    () => events.filter((e) => (TMO_EVENT_TYPES as readonly string[]).includes(e.eventType)),
    [events],
  );

  async function createEvent(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setEvents((json.events ?? []) as EventRow[]);
      setMessage("Event saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(eventId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/matches/${fixtureId}/events?eventId=${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setEvents((json.events ?? []) as EventRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="match-cms-muted text-sm m-0">Loading events…</p>;
  if (error && !fixture) return <p className="match-cms-error m-0">{error}</p>;
  if (!fixture) return null;

  const teamOptions = [
    fixture.homeTeamId
      ? { id: fixture.homeTeamId, name: fixture.homeTeam?.name ?? "Home" }
      : null,
    fixture.awayTeamId
      ? { id: fixture.awayTeamId, name: fixture.awayTeam?.name ?? "Away" }
      : null,
  ].filter(Boolean) as Array<{ id: string; name: string }>;

  return (
    <div className="match-cms-editor space-y-5">
      <MatchCmsInfoHeader
        matchId={fixture.id}
        homeTeam={fixture.homeTeam}
        awayTeam={fixture.awayTeam}
        kickoffAt={fixture.kickoffAt}
        status={fixture.status}
      />

      <section className="cms-card--nested p-3 space-y-3">
        <h4 className="cms-section-title text-sm m-0">Scoring</h4>
        <div className="match-cms-editor-form">
          <select className="cms-select" value={goalTeamId} onChange={(e) => setGoalTeamId(e.target.value)}>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="cms-select" value={goalType} onChange={(e) => setGoalType(e.target.value)}>
            {SCORING_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "missed_conversion"
                  ? "missed conversion"
                  : t === "drop_goal"
                    ? "drop goal"
                    : t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select className="cms-select" value={goalPlayerId} onChange={(e) => setGoalPlayerId(e.target.value)}>
            <option value="">Player</option>
            {playersFor(goalTeamId).map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
          <select className="cms-select" value={goalAssistId} onChange={(e) => setGoalAssistId(e.target.value)}>
            <option value="">Assist</option>
            {playersFor(goalTeamId).map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
          <input
            className="cms-input"
            placeholder="Min"
            inputMode="numeric"
            value={goalMinute}
            onChange={(e) => setGoalMinute(e.target.value.replace(/[^\d]/g, ""))}
          />
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy || !goalTeamId || goalMinute === ""}
            onClick={() => {
              const player = squad.find((p) => p.playerId === goalPlayerId);
              const assist = squad.find((p) => p.playerId === goalAssistId);
              void createEvent({
                eventType: goalType,
                teamId: goalTeamId,
                playerId: goalPlayerId || null,
                minute: Number(goalMinute || 0),
                playerName: player?.playerName,
                assistPlayerName: assist?.playerName,
                jerseyNumber: player?.jerseyNumber ?? undefined,
              }).then(() => {
                setGoalMinute("");
                setGoalPlayerId("");
                setGoalAssistId("");
              });
            }}
          >
            Save
          </button>
        </div>
        <EventTable
          rows={scoring}
          teamName={teamName}
          onDelete={(id) => {
            void deleteEvent(id);
          }}
          busy={busy}
          showScore
          showAssist
        />
      </section>

      <section className="cms-card--nested p-3 space-y-3">
        <h4 className="cms-section-title text-sm m-0">Cards</h4>
        <div className="match-cms-editor-form">
          <select className="cms-select" value={cardTeamId} onChange={(e) => setCardTeamId(e.target.value)}>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="cms-select" value={cardType} onChange={(e) => setCardType(e.target.value)}>
            {CARD_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select className="cms-select" value={cardPlayerId} onChange={(e) => setCardPlayerId(e.target.value)}>
            <option value="">Player</option>
            {playersFor(cardTeamId).map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
          <input
            className="cms-input"
            placeholder="Min"
            inputMode="numeric"
            value={cardMinute}
            onChange={(e) => setCardMinute(e.target.value.replace(/[^\d]/g, ""))}
          />
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy || !cardTeamId || cardMinute === ""}
            onClick={() => {
              const player = squad.find((p) => p.playerId === cardPlayerId);
              void createEvent({
                eventType: cardType,
                teamId: cardTeamId,
                playerId: cardPlayerId || null,
                minute: Number(cardMinute || 0),
                playerName: player?.playerName,
                jerseyNumber: player?.jerseyNumber ?? undefined,
              }).then(() => {
                setCardMinute("");
                setCardPlayerId("");
              });
            }}
          >
            Save
          </button>
        </div>
        <EventTable
          rows={cards}
          teamName={teamName}
          onDelete={(id) => {
            void deleteEvent(id);
          }}
          busy={busy}
        />
      </section>

      <section className="cms-card--nested p-3 space-y-3">
        <h4 className="cms-section-title text-sm m-0">Substitutions</h4>
        <div className="match-cms-editor-form">
          <select className="cms-select" value={subTeamId} onChange={(e) => setSubTeamId(e.target.value)}>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="cms-select" value={subOutId} onChange={(e) => setSubOutId(e.target.value)}>
            <option value="">Player out</option>
            {playersFor(subTeamId).map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
          <select className="cms-select" value={subInId} onChange={(e) => setSubInId(e.target.value)}>
            <option value="">Player in</option>
            {playersFor(subTeamId).map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
          <input
            className="cms-input"
            placeholder="Min"
            inputMode="numeric"
            value={subMinute}
            onChange={(e) => setSubMinute(e.target.value.replace(/[^\d]/g, ""))}
          />
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy || !subTeamId || subMinute === ""}
            onClick={() => {
              const outP = squad.find((p) => p.playerId === subOutId);
              const inP = squad.find((p) => p.playerId === subInId);
              void createEvent({
                eventType: "substitution",
                teamId: subTeamId,
                playerId: subInId || subOutId || null,
                minute: Number(subMinute || 0),
                playerOutName: outP?.playerName,
                playerInName: inP?.playerName,
              }).then(() => {
                setSubMinute("");
                setSubOutId("");
                setSubInId("");
              });
            }}
          >
            Save
          </button>
        </div>
        <EventTable
          rows={subs}
          teamName={teamName}
          onDelete={(id) => {
            void deleteEvent(id);
          }}
          busy={busy}
          showSub
        />
      </section>

      <section className="cms-card--nested p-3 space-y-3">
        <h4 className="cms-section-title text-sm m-0">TMO / TV referee</h4>
        <p className="m-0 text-xs text-zinc-500">
          Fourth official / television match official review. Publishes to public Match Animation signals.
        </p>
        <div className="match-cms-editor-form">
          <select className="cms-select" value={tmoTeamId} onChange={(e) => setTmoTeamId(e.target.value)}>
            <option value="">No team</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="cms-select" value={tmoType} onChange={(e) => setTmoType(e.target.value)}>
            {TMO_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "tmo_review"
                  ? "TMO review"
                  : t === "tmo_decision"
                    ? "TMO decision"
                    : "Decision overturned"}
              </option>
            ))}
          </select>
          <input
            className="cms-input"
            placeholder="Min"
            inputMode="numeric"
            value={tmoMinute}
            onChange={(e) => setTmoMinute(e.target.value.replace(/[^\d]/g, ""))}
          />
          <input
            className="cms-input"
            placeholder="Note (optional)"
            value={tmoNote}
            onChange={(e) => setTmoNote(e.target.value)}
          />
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy || tmoMinute === ""}
            onClick={() => {
              void createEvent({
                eventType: tmoType,
                teamId: tmoTeamId || null,
                minute: Number(tmoMinute || 0),
                note: tmoNote.trim() || undefined,
              }).then(() => {
                setTmoMinute("");
                setTmoNote("");
              });
            }}
          >
            Save
          </button>
        </div>
        <EventTable
          rows={tmoEvents}
          teamName={teamName}
          onDelete={(id) => {
            void deleteEvent(id);
          }}
          busy={busy}
        />
      </section>

      {error ? <p className="match-cms-error">{error}</p> : null}
      {message ? <p className="match-sources__ok">{message}</p> : null}
    </div>
  );
}
