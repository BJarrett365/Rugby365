"use client";

import { useId, useState } from "react";
import type { SdmsKeyEvent } from "@rugby365/import-sdk";
import type { HalfTimeScore } from "@/lib/match-header-utils";

type MarkerKind = "try" | "conversion" | "penalty" | "drop" | "yellow" | "red";

type PlacedMarker = {
  key: string;
  letter: string;
  kind: MarkerKind;
  side: "home" | "away";
  minute: number;
  left: number;
  playerName: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

function markerForType(type: string): { letter: string; kind: MarkerKind } | null {
  const t = type.toLowerCase();
  if (t.includes("red")) return { letter: "R", kind: "red" };
  if (t.includes("yellow") || t.includes("sin bin") || t.includes("sinbin")) {
    return { letter: "Y", kind: "yellow" };
  }
  if (t.includes("try") && !t.includes("penalty")) return { letter: "T", kind: "try" };
  if (t.includes("conversion")) return { letter: "C", kind: "conversion" };
  if (t.includes("penalty") && !t.includes("try")) return { letter: "P", kind: "penalty" };
  if (t.includes("drop")) return { letter: "D", kind: "drop" };
  return null;
}

/** Push overlapping markers apart so they remain readable on the strip. */
function spreadMarkers(markers: PlacedMarker[], minGapPct: number): PlacedMarker[] {
  const bySide: Record<"home" | "away", PlacedMarker[]> = { home: [], away: [] };
  for (const m of markers) bySide[m.side].push(m);

  for (const side of ["home", "away"] as const) {
    const list = bySide[side].sort((a, b) => a.left - b.left || a.minute - b.minute);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (cur.left - prev.left < minGapPct) {
        cur.left = Math.min(98, prev.left + minGapPct);
      }
    }
    for (let i = list.length - 2; i >= 0; i--) {
      const next = list[i + 1]!;
      const cur = list[i]!;
      if (next.left - cur.left < minGapPct) {
        cur.left = Math.max(2, next.left - minGapPct);
      }
    }
  }

  return [...bySide.home, ...bySide.away];
}

/** Horizontal scoring / card markers: home above the gold line, away below. */
export function MatchEventTimelineStrip({
  events,
  homeTeamId,
  homeTeamName,
  awayTeamName,
  halfTimeScore,
}: {
  events: SdmsKeyEvent[];
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  halfTimeScore?: HalfTimeScore | null;
}) {
  const tipId = useId();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const maxMinute = Math.max(80, ...events.map((e) => e.minute || 0));

  const raw: PlacedMarker[] = [];
  events.forEach((event, i) => {
    const marker = markerForType(event.type);
    if (!marker) return;
    const minute = event.minute || 0;
    const left = Math.min(98, Math.max(2, (minute / maxMinute) * 100));
    const isHome = homeTeamId ? event.team_id === homeTeamId : true;
    raw.push({
      key: `${event.minute}-${marker.letter}-${event.player_id ?? event.player_name ?? i}`,
      letter: marker.letter,
      kind: marker.kind,
      side: isHome ? "home" : "away",
      minute,
      left,
      playerName: event.player_name ?? null,
      homeScore: typeof event.home_score === "number" ? event.home_score : null,
      awayScore: typeof event.away_score === "number" ? event.away_score : null,
    });
  });

  if (raw.length === 0 && !halfTimeScore) return null;

  const placed = spreadMarkers(raw, 2.8);
  const htLeft = Math.min(98, Math.max(2, (40 / maxMinute) * 100));
  const hovered = hoverKey ? placed.find((m) => m.key === hoverKey) : null;

  return (
    <div className="pr-event-strip" aria-label="Scoring timeline">
      <div className="pr-event-strip__axis" aria-hidden>
        <span>0'</span>
        <span>20'</span>
        <span>40'</span>
        <span>60'</span>
        <span>80'</span>
      </div>
      <div className="pr-event-strip__track">
        <div className="pr-event-strip__line" />
        <div className="pr-event-strip__ht" style={{ left: `${htLeft}%` }}>
          <span className="pr-event-strip__ht-label">HT</span>
          {halfTimeScore ? (
            <span className="pr-event-strip__ht-score">
              {halfTimeScore.home}–{halfTimeScore.away}
            </span>
          ) : null}
        </div>
        {placed.map((m) => {
          const teamLabel = m.side === "home" ? homeTeamName ?? "Home" : awayTeamName ?? "Away";
          const scoreBit =
            m.homeScore != null && m.awayScore != null
              ? ` · ${m.homeScore}–${m.awayScore}`
              : "";
          const tip = `${m.letter} ${m.minute}' · ${teamLabel}${m.playerName ? ` · ${m.playerName}` : ""}${scoreBit}`;
          return (
            <button
              key={m.key}
              type="button"
              className={`pr-event-strip__marker pr-event-strip__marker--${m.side} pr-event-strip__marker--${m.kind}${hoverKey === m.key ? " is-active" : ""}`}
              style={{ left: `${m.left}%` }}
              aria-describedby={hoverKey === m.key ? tipId : undefined}
              aria-label={tip}
              onMouseEnter={() => setHoverKey(m.key)}
              onMouseLeave={() => setHoverKey((k) => (k === m.key ? null : k))}
              onFocus={() => setHoverKey(m.key)}
              onBlur={() => setHoverKey((k) => (k === m.key ? null : k))}
            >
              <span className="pr-event-strip__anchor" aria-hidden />
              {m.letter}
            </button>
          );
        })}
        {hovered ? (
          <div
            id={tipId}
            role="tooltip"
            className={`pr-event-strip__tooltip pr-event-strip__tooltip--${hovered.side}`}
            style={{ left: `${hovered.left}%` }}
          >
            <strong>
              {hovered.letter} {hovered.minute}&apos;
            </strong>
            <span>
              {hovered.side === "home" ? homeTeamName ?? "Home" : awayTeamName ?? "Away"}
              {hovered.playerName ? ` · ${hovered.playerName}` : ""}
            </span>
            {hovered.homeScore != null && hovered.awayScore != null ? (
              <span className="pr-event-strip__tooltip-score">
                {hovered.homeScore}–{hovered.awayScore}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="pr-event-strip__legend" aria-hidden>
        <span>
          <i className="pr-event-strip__legend-dot pr-event-strip__legend-dot--home" /> Home
        </span>
        <span>
          <i className="pr-event-strip__legend-dot pr-event-strip__legend-dot--away" /> Away
        </span>
      </div>
    </div>
  );
}
