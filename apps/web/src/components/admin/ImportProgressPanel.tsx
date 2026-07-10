"use client";

import type { ImportProgressState } from "@/lib/import-progress-types";
import { formatImportDuration } from "@/lib/import-progress-estimate";

type ImportProgressPanelProps = {
  title: string;
  state: ImportProgressState;
};

export function ImportProgressPanel({ title, state }: ImportProgressPanelProps) {
  if (!state.active) return null;

  const progress = state.progress ?? null;
  const showBar = progress != null && progress > 0;

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 space-y-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="m-0 text-sm font-medium text-amber-100">{title}</p>
          <p className="m-0 mt-1 text-sm text-zinc-300">{state.message}</p>
          {state.seasonTotal != null && state.seasonTotal > 1 && state.seasonIndex != null ? (
            <p className="m-0 mt-1 text-xs text-zinc-500">
              Season {state.seasonIndex} of {state.seasonTotal}
              {state.seasonLabel ? ` · ${state.seasonLabel}` : ""}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs tabular-nums text-zinc-400">
          <p className="m-0">
            Elapsed <span className="text-zinc-200">{formatImportDuration(state.elapsedSeconds)}</span>
          </p>
          {state.remainingSeconds != null ? (
            <p className="m-0 mt-1">
              ~<span className="text-zinc-200">{formatImportDuration(state.remainingSeconds)}</span> left
            </p>
          ) : null}
        </div>
      </div>

      <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
        {showBar ? (
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
          />
        ) : (
          <div className="h-full w-1/3 rounded-full bg-amber-500/80 animate-pulse" />
        )}
      </div>

      {showBar ? (
        <p className="m-0 text-xs text-zinc-500 tabular-nums">{Math.round(progress)}% complete</p>
      ) : (
        <p className="m-0 text-xs text-zinc-500">Downloading and processing data…</p>
      )}
    </div>
  );
}
