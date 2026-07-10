export type ImportProgressReporter = (event: ImportProgressEvent) => void;

export type ImportProgressEvent = {
  phase: string;
  message: string;
  progress?: number;
  seasonLabel?: string;
  seasonIndex?: number;
  seasonTotal?: number;
  matchesProcessed?: number;
  matchesTotal?: number;
};

export type ImportProgressState = {
  active: boolean;
  phase: string;
  message: string;
  progress: number | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  seasonLabel?: string;
  seasonIndex?: number;
  seasonTotal?: number;
};

export type ImportStreamLine =
  | { type: "progress"; event: ImportProgressEvent }
  | { type: "complete"; result: Record<string, unknown> }
  | { type: "error"; error: string };
