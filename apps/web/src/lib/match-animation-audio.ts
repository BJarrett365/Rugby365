/** Web Audio stings for Match Animation try / conversion cues (no asset files). */

export type MatchAnimationSoundCue = "try" | "conversion" | "conversion_miss";

export const MATCH_ANIMATION_SOUND_KEY = "r365-ma-sound";

let sharedCtx: AudioContext | null = null;

function AudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

export function getMatchAnimationAudioContext(): AudioContext | null {
  const Ctor = AudioContextCtor();
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

/** Call from a user gesture so the browser allows playback. */
export async function unlockMatchAnimationAudio(): Promise<void> {
  const ctx = getMatchAnimationAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
}

export function readMatchAnimationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MATCH_ANIMATION_SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMatchAnimationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MATCH_ANIMATION_SOUND_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function tone(
  ctx: AudioContext,
  opts: {
    type: OscillatorType;
    freq: number;
    freqEnd?: number;
    start: number;
    duration: number;
    gain: number;
    gainEnd?: number;
  },
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, opts.start);
  if (opts.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), opts.start + opts.duration);
  }
  gain.gain.setValueAtTime(0.0001, opts.start);
  gain.gain.exponentialRampToValueAtTime(opts.gain, opts.start + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, opts.gainEnd ?? 0.0001),
    opts.start + opts.duration,
  );
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(opts.start);
  osc.stop(opts.start + opts.duration + 0.02);
}

function noiseBurst(ctx: AudioContext, start: number, duration: number, gainValue: number) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(start);
  src.stop(start + duration);
}

function playTrySting(ctx: AudioContext) {
  const t = ctx.currentTime;
  noiseBurst(ctx, t, 0.45, 0.12);
  tone(ctx, { type: "triangle", freq: 196, freqEnd: 392, start: t, duration: 0.35, gain: 0.14 });
  tone(ctx, { type: "sawtooth", freq: 262, freqEnd: 523, start: t + 0.08, duration: 0.4, gain: 0.08 });
  tone(ctx, { type: "square", freq: 392, freqEnd: 784, start: t + 0.18, duration: 0.35, gain: 0.05 });
}

function playConversionSting(ctx: AudioContext) {
  const t = ctx.currentTime;
  // Kick thump
  tone(ctx, {
    type: "sine",
    freq: 140,
    freqEnd: 55,
    start: t,
    duration: 0.18,
    gain: 0.16,
  });
  // Posts success
  tone(ctx, { type: "triangle", freq: 523, start: t + 0.2, duration: 0.22, gain: 0.1 });
  tone(ctx, { type: "triangle", freq: 659, start: t + 0.32, duration: 0.28, gain: 0.09 });
  tone(ctx, { type: "triangle", freq: 784, start: t + 0.45, duration: 0.35, gain: 0.07 });
}

function playConversionMissSting(ctx: AudioContext) {
  const t = ctx.currentTime;
  tone(ctx, {
    type: "sine",
    freq: 140,
    freqEnd: 55,
    start: t,
    duration: 0.16,
    gain: 0.12,
  });
  tone(ctx, {
    type: "sawtooth",
    freq: 220,
    freqEnd: 110,
    start: t + 0.18,
    duration: 0.35,
    gain: 0.06,
  });
}

export function playMatchAnimationCue(
  cue: MatchAnimationSoundCue,
  enabled: boolean,
): void {
  if (!enabled) return;
  const ctx = getMatchAnimationAudioContext();
  if (!ctx) return;
  void ctx.resume().then(() => {
    if (cue === "try") playTrySting(ctx);
    else if (cue === "conversion") playConversionSting(ctx);
    else playConversionMissSting(ctx);
  });
}

export function soundCueForSignalKind(
  kind: string | null | undefined,
): MatchAnimationSoundCue | null {
  if (!kind) return null;
  if (kind === "try_awarded") return "try";
  if (kind === "conversion_awarded") return "conversion";
  if (kind === "conversion_missed") return "conversion_miss";
  return null;
}
