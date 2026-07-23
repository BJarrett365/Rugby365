import type { SdmsKeyEvent } from "@rugby365/import-sdk";

type MarkerKind = "try" | "conversion" | "penalty" | "drop" | "yellow" | "red";

type PlacedMarker = {
  key: string;
  letter: string;
  kind: MarkerKind;
  side: "home" | "away";
  minute: number;
  left: number;
  title: string;
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
    // If we ran off the right edge, pull the cluster left while keeping gaps.
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
}: {
  events: SdmsKeyEvent[];
  homeTeamId?: string;
}) {
  const raw: PlacedMarker[] = [];
  const maxMinute = Math.max(
    80,
    ...events.map((e) => e.minute || 0),
  );

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
      title: `${marker.letter} ${minute}'${event.player_name ? ` · ${event.player_name}` : ""}`,
    });
  });

  if (raw.length === 0) return null;

  const placed = spreadMarkers(raw, 5.5);

  return (
    <div className="pr-event-strip" aria-label="Scoring timeline">
      <div className="pr-event-strip__line" />
      {placed.map((m) => (
        <span
          key={m.key}
          className={`pr-event-strip__marker pr-event-strip__marker--${m.side} pr-event-strip__marker--${m.kind}`}
          style={{ left: `${m.left}%` }}
          title={m.title}
        >
          {m.letter}
        </span>
      ))}
    </div>
  );
}
