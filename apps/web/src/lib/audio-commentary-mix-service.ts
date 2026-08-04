/**
 * Stadium mix stub for Live Audio Commentary.
 * Real FFmpeg mix lands when binary + bed assets are available in the deploy env.
 */

export type MixBurstInput = {
  fixtureId: string;
  scriptId: string;
  leadStoragePath?: string | null;
  analystStoragePath?: string | null;
  stadiumBedPath?: string | null;
};

export type MixBurstResult = {
  ok: boolean;
  status: "stubbed" | "mixed";
  message: string;
  /** Private storage path when mix succeeds — never expose publicly. */
  mixedStoragePath?: string;
};

/**
 * Placeholder mix step. Returns a clear stub until FFmpeg is wired in the environment.
 */
export async function mixAudioCommentaryBurst(input: MixBurstInput): Promise<MixBurstResult> {
  if (!input.leadStoragePath && !input.analystStoragePath) {
    return {
      ok: false,
      status: "stubbed",
      message: "No speaker segments available to mix.",
    };
  }

  // Detect FFmpeg without failing the process if missing.
  let hasFfmpeg = false;
  try {
    const { spawnSync } = await import("node:child_process");
    const probe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
    hasFfmpeg = probe.status === 0;
  } catch {
    hasFfmpeg = false;
  }

  if (!hasFfmpeg) {
    return {
      ok: true,
      status: "stubbed",
      message:
        "Mix stubbed — FFmpeg not available. Segments remain separate; Match Animation can still schedule bursts later.",
    };
  }

  return {
    ok: true,
    status: "stubbed",
    message:
      "FFmpeg detected but stadium-bed mix pipeline is not wired yet. Use separate Lead/Analyst segments for now.",
  };
}
