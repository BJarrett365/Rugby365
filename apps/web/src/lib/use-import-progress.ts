"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportProgressEvent, ImportProgressState, ImportStreamLine } from "./import-progress-types";
import { estimateImportDurationSeconds } from "./import-progress-estimate";

const INITIAL_STATE: ImportProgressState = {
  active: false,
  phase: "",
  message: "",
  progress: null,
  elapsedSeconds: 0,
  remainingSeconds: null,
};

type StartOptions = {
  message?: string;
  estimatedSeconds?: number;
};

export function useImportProgress() {
  const [state, setState] = useState<ImportProgressState>(INITIAL_STATE);
  const startedAtRef = useRef<number | null>(null);
  const estimateRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const startedAt = startedAtRef.current;
    if (startedAt == null) return;

    setState((prev) => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      let remainingSeconds = prev.remainingSeconds;

      if (prev.progress != null && prev.progress > 0) {
        const totalEstimate = Math.max(elapsedSeconds / (prev.progress / 100), elapsedSeconds + 1);
        remainingSeconds = Math.max(0, Math.ceil(totalEstimate - elapsedSeconds));
      } else if (estimateRef.current != null) {
        remainingSeconds = Math.max(0, estimateRef.current - elapsedSeconds);
      }

      return { ...prev, elapsedSeconds, remainingSeconds };
    });
  }, []);

  const start = useCallback(
    (options: StartOptions = {}) => {
      stopTimer();
      startedAtRef.current = Date.now();
      estimateRef.current = options.estimatedSeconds ?? null;
      setState({
        active: true,
        phase: "starting",
        message: options.message ?? "Starting import…",
        progress: null,
        elapsedSeconds: 0,
        remainingSeconds: options.estimatedSeconds ?? null,
      });
      timerRef.current = setInterval(tick, 1000);
    },
    [stopTimer, tick],
  );

  const update = useCallback((event: Partial<ImportProgressEvent> & { message: string }) => {
    setState((prev) => ({
      ...prev,
      phase: event.phase ?? prev.phase,
      message: event.message,
      progress: event.progress ?? prev.progress,
      seasonLabel: event.seasonLabel ?? prev.seasonLabel,
      seasonIndex: event.seasonIndex ?? prev.seasonIndex,
      seasonTotal: event.seasonTotal ?? prev.seasonTotal,
    }));
  }, []);

  const stop = useCallback(() => {
    stopTimer();
    startedAtRef.current = null;
    estimateRef.current = null;
    setState(INITIAL_STATE);
  }, [stopTimer]);

  const finish = useCallback(() => {
    stopTimer();
    setState((prev) => ({
      ...prev,
      progress: 100,
      remainingSeconds: 0,
      message: "Import complete",
    }));
    window.setTimeout(() => {
      startedAtRef.current = null;
      estimateRef.current = null;
      setState(INITIAL_STATE);
    }, 600);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  return { state, start, update, stop, finish };
}

export async function postImportWithProgress(
  url: string,
  body: Record<string, unknown>,
  handlers: {
    onProgress: (event: ImportProgressEvent) => void;
    estimateSeconds?: number;
  },
): Promise<Record<string, unknown>> {
  const useStream =
    Boolean(body.streamProgress) ||
    Boolean(body.importAllSeasons) ||
    (handlers.estimateSeconds ?? 0) >= 30;

  if (!useStream) {
    handlers.onProgress({ phase: "working", message: "Downloading and importing data…", progress: 5 });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Import failed");
    handlers.onProgress({ phase: "complete", message: "Import complete", progress: 100 });
    return data;
  }

  handlers.onProgress({ phase: "connecting", message: "Connecting to import service…", progress: 2 });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, streamProgress: true }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Import failed");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-ndjson")) {
    const data = await res.json();
    handlers.onProgress({ phase: "complete", message: "Import complete", progress: 100 });
    return data;
  }

  if (!res.body) {
    throw new Error("Import stream missing");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const parsed = JSON.parse(line) as ImportStreamLine;
        if (parsed.type === "progress") {
          handlers.onProgress(parsed.event);
        } else if (parsed.type === "complete") {
          finalResult = parsed.result;
        } else if (parsed.type === "error") {
          throw new Error(parsed.error);
        }
      }
      newline = buffer.indexOf("\n");
    }
  }

  if (!finalResult) throw new Error("Import finished without a result");
  return finalResult;
}

export { estimateImportDurationSeconds };
