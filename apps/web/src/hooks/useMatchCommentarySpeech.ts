"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchAnimationAudioCaption } from "@/lib/match-animation-public-audio";
import {
  COMMENTARY_CAPTION_GAP_MS,
  COMMENTARY_SPEAKER_PAUSE_MS,
  buildBroadcastPlayQueue,
  buildPreviewUtteranceQueue,
  captionSpeechKey,
  commentaryPlaybackStatusLabel,
  nextCaptionAfter,
  pickPreviewSpeechVoices,
  resolveCaptionSpeechMode,
  type CommentarySpeechMode,
  type CommentarySpeechPhase,
  type CommentarySpeechSpeaker,
} from "@/lib/match-commentary-speech";

export type MatchCommentarySpeechControls = {
  phase: CommentarySpeechPhase;
  mode: CommentarySpeechMode | null;
  speaker: CommentarySpeechSpeaker | null;
  /** True while Play is walking the feed (auto-advances until Stop / end). */
  streaming: boolean;
  statusLabel: string;
  /** Active caption currently speaking (updates as the stream advances). */
  activeCaption: MatchAnimationAudioCaption | null;
  /**
   * Play a caption. By default chains through subsequent captions when the
   * burst ends. Pass `{ chain: false }` for one-shot (e.g. Normal time dispatch).
   */
  play: (
    caption?: MatchAnimationAudioCaption | null,
    options?: { chain?: boolean },
  ) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Skip to the next caption; keeps the stream chain on. */
  playNext: () => void;
};

/**
 * Play Lead → short pause → Analyst for a caption.
 * Prefer same-origin broadcast TTS; fall back to browser speechSynthesis.
 * With chain enabled (default on Play), auto-advances to the next caption.
 */
export function useMatchCommentarySpeech(input: {
  matchId: string;
  /** Listen toggle — when true + streaming, auto-plays ready TTS as the caption clock changes. */
  enabled: boolean;
  volume: number;
  status: string;
  caption: MatchAnimationAudioCaption | null;
  captions?: MatchAnimationAudioCaption[];
  /** Called before Play so Listen turns on from a user gesture. */
  onEnsureListen?: () => void;
  /** When true, skip Listen-driven autoplay (used by Normal time / Audio tab). */
  suppressAutoPlay?: boolean;
  /** Fired when the speaking caption changes (keeps scrubber in sync during stream). */
  onActiveCaptionChange?: (caption: MatchAnimationAudioCaption | null) => void;
}): MatchCommentarySpeechControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Array<{ speaker: CommentarySpeechSpeaker; url: string }>>([]);
  const generationRef = useRef(0);
  const autoKeyRef = useRef("");
  const pauseTimerRef = useRef<number | null>(null);
  const chainRef = useRef(false);
  const captionRef = useRef(input.caption);
  const captionsRef = useRef(input.captions ?? []);
  const volumeRef = useRef(input.volume);
  const matchIdRef = useRef(input.matchId);
  const onEnsureListenRef = useRef(input.onEnsureListen);
  const onActiveCaptionChangeRef = useRef(input.onActiveCaptionChange);
  /** Stable refs to play helpers so onended can continue the chain. */
  const playBurstRef = useRef<
    (caption: MatchAnimationAudioCaption, generation: number) => void
  >(() => undefined);

  const [phase, setPhase] = useState<CommentarySpeechPhase>("idle");
  const [mode, setMode] = useState<CommentarySpeechMode | null>(null);
  const [speaker, setSpeaker] = useState<CommentarySpeechSpeaker | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [activeCaption, setActiveCaption] = useState<MatchAnimationAudioCaption | null>(
    null,
  );

  captionRef.current = input.caption;
  captionsRef.current = input.captions ?? [];
  volumeRef.current = input.volume;
  matchIdRef.current = input.matchId;
  onEnsureListenRef.current = input.onEnsureListen;
  onActiveCaptionChangeRef.current = input.onActiveCaptionChange;

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    if (!preloadRef.current) {
      preloadRef.current = new Audio();
      preloadRef.current.preload = "auto";
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, input.volume));
    }
  }, [input.volume]);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current != null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const setSpeakingCaption = (caption: MatchAnimationAudioCaption | null) => {
    setActiveCaption(caption);
    onActiveCaptionChangeRef.current?.(caption);
  };

  const hardStopMedia = () => {
    clearPauseTimer();
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onpause = null;
      audio.onplay = null;
      audio.pause();
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {
        /* ignore */
      }
    }
    const preload = preloadRef.current;
    if (preload) {
      preload.removeAttribute("src");
      try {
        preload.load();
      } catch {
        /* ignore */
      }
    }
    queueRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const stop = () => {
    generationRef.current += 1;
    chainRef.current = false;
    setStreaming(false);
    hardStopMedia();
    setPhase("idle");
    setMode(null);
    setSpeaker(null);
    setSpeakingCaption(null);
    autoKeyRef.current = "";
  };

  const pause = () => {
    const audio = audioRef.current;
    if (mode === "broadcast" && audio && !audio.paused) {
      audio.pause();
      setPhase("paused");
      return;
    }
    if (mode === "preview" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setPhase("paused");
    }
  };

  const resume = () => {
    const audio = audioRef.current;
    if (mode === "broadcast" && audio && audio.paused && audio.src) {
      void audio.play().catch(() => {
        /* ignore */
      });
      setPhase("playing");
      return;
    }
    if (mode === "preview" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setPhase("playing");
    }
  };

  const preloadNextUrls = (
    current: MatchAnimationAudioCaption,
    remainingInBurst: Array<{ speaker: CommentarySpeechSpeaker; url: string }>,
  ) => {
    const preload = preloadRef.current;
    if (!preload) return;
    const nextUrl =
      remainingInBurst[0]?.url ??
      (() => {
        const nextCap = nextCaptionAfter(captionsRef.current, current);
        if (!nextCap) return null;
        const q = buildBroadcastPlayQueue(matchIdRef.current, nextCap);
        return q[0]?.url ?? null;
      })();
    if (!nextUrl) return;
    if (preload.src && preload.src.endsWith(nextUrl.split("?")[0] ?? "")) return;
    try {
      preload.src = nextUrl;
      preload.load();
    } catch {
      /* ignore */
    }
  };

  const advanceAfterBurst = (
    finishedCaption: MatchAnimationAudioCaption,
    generation: number,
  ) => {
    if (generationRef.current !== generation) return;
    if (!chainRef.current) {
      setPhase("idle");
      setSpeaker(null);
      setMode(null);
      setStreaming(false);
      return;
    }
    const next = nextCaptionAfter(captionsRef.current, finishedCaption);
    if (!next) {
      chainRef.current = false;
      setStreaming(false);
      setPhase("idle");
      setSpeaker(null);
      setMode(null);
      return;
    }
    clearPauseTimer();
    pauseTimerRef.current = window.setTimeout(() => {
      if (generationRef.current !== generation) return;
      playBurstRef.current(next, generation);
    }, COMMENTARY_CAPTION_GAP_MS);
  };

  const playBroadcast = (caption: MatchAnimationAudioCaption, generation: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const items = buildBroadcastPlayQueue(matchIdRef.current, caption);
    if (!items.length) {
      void playPreview(caption, generation);
      return;
    }

    setMode("broadcast");
    setPhase("playing");
    setSpeakingCaption(caption);
    autoKeyRef.current = captionSpeechKey(caption);
    queueRef.current = items;
    preloadNextUrls(caption, items.slice(1));

    const playNextInQueue = () => {
      if (generationRef.current !== generation) return;
      const next = queueRef.current.shift();
      if (!next) {
        advanceAfterBurst(caption, generation);
        return;
      }
      setSpeaker(next.speaker);
      audio.src = next.url;
      audio.volume = Math.max(0, Math.min(1, volumeRef.current));
      preloadNextUrls(caption, queueRef.current);
      audio.onended = () => {
        if (generationRef.current !== generation) return;
        if (!queueRef.current.length) {
          advanceAfterBurst(caption, generation);
          return;
        }
        clearPauseTimer();
        pauseTimerRef.current = window.setTimeout(() => {
          playNextInQueue();
        }, COMMENTARY_SPEAKER_PAUSE_MS);
      };
      void audio.play().catch(() => {
        // Proxy 404 / decode — fall back to preview for this caption.
        if (generationRef.current !== generation) return;
        hardStopMedia();
        void playPreview(caption, generation);
      });
    };

    playNextInQueue();
  };

  const playPreview = (caption: MatchAnimationAudioCaption, generation: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      advanceAfterBurst(caption, generation);
      return;
    }

    const items = buildPreviewUtteranceQueue(caption);
    if (!items.length) {
      advanceAfterBurst(caption, generation);
      return;
    }

    window.speechSynthesis.cancel();
    setMode("preview");
    setPhase("playing");
    setSpeakingCaption(caption);
    autoKeyRef.current = captionSpeechKey(caption);

    // Warm the next broadcast URL while preview speaks (if any).
    preloadNextUrls(caption, []);

    const voices = window.speechSynthesis.getVoices();
    const picked = pickPreviewSpeechVoices(voices);

    let index = 0;
    const speakNext = () => {
      if (generationRef.current !== generation) return;
      const item = items[index++];
      if (!item) {
        advanceAfterBurst(caption, generation);
        return;
      }
      setSpeaker(item.speaker);
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.volume = Math.max(0, Math.min(1, volumeRef.current));
      if (item.speaker === "lead") {
        if (picked.lead) utter.voice = picked.lead;
        utter.rate = 1.02;
        utter.pitch = 0.92;
      } else {
        if (picked.analyst) utter.voice = picked.analyst;
        utter.rate = 1.08;
        utter.pitch = 1.05;
      }
      utter.onend = () => {
        if (generationRef.current !== generation) return;
        if (index >= items.length) {
          advanceAfterBurst(caption, generation);
          return;
        }
        clearPauseTimer();
        pauseTimerRef.current = window.setTimeout(() => {
          speakNext();
        }, COMMENTARY_SPEAKER_PAUSE_MS);
      };
      utter.onerror = () => {
        if (generationRef.current !== generation) return;
        speakNext();
      };
      window.speechSynthesis.speak(utter);
    };

    // Some browsers load voices async — retry once after voiceschanged.
    if (!voices.length) {
      const onVoices = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        if (generationRef.current !== generation) return;
        speakNext();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      window.setTimeout(() => {
        if (generationRef.current !== generation) return;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        speakNext();
      }, 250);
      return;
    }

    speakNext();
  };

  playBurstRef.current = (caption, generation) => {
    const resolved = resolveCaptionSpeechMode(caption);
    if (!resolved) {
      advanceAfterBurst(caption, generation);
      return;
    }
    if (resolved === "broadcast") {
      playBroadcast(caption, generation);
      return;
    }
    void playPreview(caption, generation);
  };

  const play = (
    captionArg?: MatchAnimationAudioCaption | null,
    options?: { chain?: boolean },
  ) => {
    const caption = captionArg ?? captionRef.current;
    if (!caption) return;
    onEnsureListenRef.current?.();
    const chain = options?.chain !== false;
    chainRef.current = chain;
    setStreaming(chain);
    generationRef.current += 1;
    const generation = generationRef.current;
    hardStopMedia();
    autoKeyRef.current = captionSpeechKey(caption);
    playBurstRef.current(caption, generation);
  };

  const playNext = () => {
    const next = nextCaptionAfter(captionsRef.current, activeCaption ?? captionRef.current);
    if (!next) return;
    // Keep stream going when skipping ahead.
    play(next, { chain: chainRef.current || true });
  };

  // Auto-play ready TTS when Listen is on (Animation / live clock). Preview never auto-fires.
  useEffect(() => {
    if (input.suppressAutoPlay) return;
    if (!input.enabled || input.status !== "streaming" || !input.caption) {
      return;
    }
    if (!(input.caption.leadAudio || input.caption.analystAudio)) return;

    const key = captionSpeechKey(input.caption);
    if (autoKeyRef.current === key) return;
    autoKeyRef.current = key;

    // Clock-driven Listen: one burst at a time (Normal time / live owns sequencing).
    chainRef.current = false;
    setStreaming(false);
    generationRef.current += 1;
    const generation = generationRef.current;
    hardStopMedia();
    playBurstRef.current(input.caption, generation);

    return () => {
      /* leave playback running across minor re-renders; stop on disable below */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional clock-driven autoplay
  }, [input.enabled, input.status, input.matchId, input.caption, input.suppressAutoPlay]);

  useEffect(() => {
    if (!input.enabled) {
      // Don't yank explicit Play if user only toggled Listen off mid-preview —
      // but stop autoplay stream when Listen is off.
      if ((mode === "broadcast" || streaming) && phase !== "idle") {
        stop();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      chainRef.current = false;
      hardStopMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase,
    mode,
    speaker,
    streaming,
    statusLabel: commentaryPlaybackStatusLabel({
      phase,
      mode,
      speaker,
      streaming,
    }),
    activeCaption,
    play,
    pause,
    resume,
    stop,
    playNext,
  };
}
