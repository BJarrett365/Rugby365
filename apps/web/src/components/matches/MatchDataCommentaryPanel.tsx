"use client";

import { useCallback, useEffect, useState } from "react";

export type DataCommentaryLine = {
  id: string;
  minute: number;
  second?: number | null;
  body: string;
  outputType?: string | null;
  source?: string | null;
};

function formatCommentaryClock(minute: number, second?: number | null): string {
  const m = Math.max(0, Math.floor(minute));
  const s = Math.max(0, Math.min(59, Math.floor(second ?? 0)));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sortByMatchClockNewestFirst(lines: DataCommentaryLine[]): DataCommentaryLine[] {
  return [...lines].sort((a, b) => {
    if (b.minute !== a.minute) return b.minute - a.minute;
    return (b.second ?? 0) - (a.second ?? 0);
  });
}

function normalizeLines(raw: unknown[]): DataCommentaryLine[] {
  return raw
    .map((row) => {
      const line = row as Partial<DataCommentaryLine>;
      if (!line?.id || typeof line.body !== "string") return null;
      return {
        id: String(line.id),
        minute: Number(line.minute ?? 0),
        second: line.second ?? 0,
        body: line.body,
        outputType: line.outputType ?? null,
        source: line.source ?? null,
      };
    })
    .filter((line): line is DataCommentaryLine => Boolean(line));
}

/** Public Live Commentary feed — polls for timeline updates after CMS Generate. */
export function MatchDataCommentaryPanel({
  fixtureId,
  lines: initialLines,
  homeName,
  awayName,
}: {
  fixtureId: string;
  lines: DataCommentaryLine[];
  homeName: string;
  awayName: string;
}) {
  const [lines, setLines] = useState(initialLines);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}/commentary`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { lines?: unknown[] };
      if (Array.isArray(data.lines)) {
        setLines(normalizeLines(data.lines));
        setLive(true);
      }
    } catch {
      /* keep last good snapshot */
    }
  }, [fixtureId]);

  useEffect(() => {
    setLines(initialLines);
  }, [initialLines]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const ordered = sortByMatchClockNewestFirst(lines);

  if (ordered.length === 0) {
    return (
      <section className="match-data-commentary cms-card">
        <h2 className="match-detail-section__heading">Live Commentary</h2>
        <p className="match-detail-empty">
          No commentary has been generated for {homeName} vs {awayName} yet. Open Admin → Match
          Commentary and run “Generate from match data”.
        </p>
      </section>
    );
  }

  return (
    <section className="match-data-commentary cms-card" aria-label="Live Commentary">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="match-detail-section__heading m-0">Live Commentary</h2>
        {live ? (
          <span className="text-xs uppercase tracking-wide text-emerald-600/90">Updating live</span>
        ) : null}
      </div>
      <ol className="match-data-commentary__list">
        {ordered.map((line) => (
          <li key={line.id} className="match-data-commentary__item">
            <time
              className="match-data-commentary__clock"
              dateTime={`PT${line.minute}M${line.second ?? 0}S`}
            >
              {formatCommentaryClock(line.minute, line.second)}
            </time>
            <div className="match-data-commentary__body">
              <p className="match-data-commentary__text">{line.body}</p>
              {line.outputType ? (
                <span className="match-data-commentary__type">
                  {line.outputType.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
