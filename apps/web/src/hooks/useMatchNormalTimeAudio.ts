"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchAnimationAudioCaption } from "@/lib/match-animation-public-audio";
import { captionSpeechKey } from "@/lib/match-commentary-speech";
import {
  captionMatchSeconds,
  clockFromMatchSeconds,
  normalTimeEndSeconds,
  normalTimeStatusLabel,
  selectNormalTimeBurst,
  type NormalTimePhase,
} from "@/lib/match-normal-time-audio";

type SpeechPhase = "idle" | "playing" | "paused";

/**
 * 1× match-clock playback: advances MM:SS in real seconds and triggers
 * Lead → Analyst bursts as each caption time is reached.
 */
export function useMatchNormalTimeAudio(input: {
  captions: MatchAnimationAudioCaption[];
  /** Current scrubber clock (used as start point for "from here"). */
  clockMinute: number;
  clockSecond: number;
  speechPhase: SpeechPhase;
  playCaption: (caption: MatchAnimationAudioCaption) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
  onEnsureListen?: () => void;
  /** Drive the shared panel clock while normal time runs. */
  onClockTick: (minute: number, second: number) => void;
}) {
  const [phase, setPhase] = useState<NormalTimePhase>("idle");
  const [runMinute, setRunMinute] = useState(0);
  const [runSecond, setRunSecond] = useState(0);

  const phaseRef = useRef<NormalTimePhase>("idle");
  const matchSecondsRef = useRef(0);
  const anchorWallRef = useRef(0);
  const anchorMatchRef = useRef(0);
  const handledRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const captionsRef = useRef(input.captions);
  const speechPhaseRef = useRef(input.speechPhase);
  const playCaptionRef = useRef(input.playCaption);
  const onClockTickRef = useRef(input.onClockTick);
  const onEnsureListenRef = useRef(input.onEnsureListen);
  const pauseSpeechRef = useRef(input.pauseSpeech);
  const resumeSpeechRef = useRef(input.resumeSpeech);
  const stopSpeechRef = useRef(input.stopSpeech);

  captionsRef.current = input.captions;
  speechPhaseRef.current = input.speechPhase;
  playCaptionRef.current = input.playCaption;
  onClockTickRef.current = input.onClockTick;
  onEnsureListenRef.current = input.onEnsureListen;
  pauseSpeechRef.current = input.pauseSpeech;
  resumeSpeechRef.current = input.resumeSpeech;
  stopSpeechRef.current = input.stopSpeech;
  phaseRef.current = phase;

  const endSeconds = normalTimeEndSeconds(input.captions);

  const applyClock = (totalSeconds: number) => {
    const clamped = Math.min(endSeconds, Math.max(0, totalSeconds));
    matchSecondsRef.current = clamped;
    const { minute, second } = clockFromMatchSeconds(clamped);
    setRunMinute(minute);
    setRunSecond(second);
    onClockTickRef.current(minute, second);
  };

  const tryDispatchBurst = () => {
    if (phaseRef.current !== "playing") return;
    const speechBusy = speechPhaseRef.current === "playing";
    const { play, skipKeys } = selectNormalTimeBurst({
      captions: captionsRef.current,
      clockSeconds: matchSecondsRef.current,
      handledKeys: handledRef.current,
      speechBusy,
    });
    for (const key of skipKeys) handledRef.current.add(key);
    if (!play) return;
    handledRef.current.add(captionSpeechKey(play));
    playCaptionRef.current(play);
  };

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tick = () => {
    if (phaseRef.current !== "playing") return;
    const elapsedMs = performance.now() - anchorWallRef.current;
    const nextSeconds = anchorMatchRef.current + Math.floor(elapsedMs / 1000);
    applyClock(nextSeconds);
    tryDispatchBurst();

    if (nextSeconds >= endSeconds) {
      setPhase("idle");
      phaseRef.current = "idle";
      stopRaf();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const startAt = (minute: number, second: number) => {
    onEnsureListenRef.current?.();
    stopSpeechRef.current();
    handledRef.current = new Set();
    const startSeconds = Math.max(0, minute) * 60 + Math.max(0, Math.min(59, second));
    // Mark captions strictly before start as handled so we don't dump backlog.
    for (const caption of captionsRef.current) {
      if (captionMatchSeconds(caption) < startSeconds) {
        handledRef.current.add(captionSpeechKey(caption));
      }
    }
    applyClock(startSeconds);
    anchorMatchRef.current = startSeconds;
    anchorWallRef.current = performance.now();
    setPhase("playing");
    phaseRef.current = "playing";
    stopRaf();
    // Fire anything due at the start second immediately.
    tryDispatchBurst();
    rafRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    if (phaseRef.current !== "playing") return;
    stopRaf();
    setPhase("paused");
    phaseRef.current = "paused";
    pauseSpeechRef.current();
  };

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    onEnsureListenRef.current?.();
    anchorMatchRef.current = matchSecondsRef.current;
    anchorWallRef.current = performance.now();
    setPhase("playing");
    phaseRef.current = "playing";
    resumeSpeechRef.current();
    tryDispatchBurst();
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    stopRaf();
    setPhase("idle");
    phaseRef.current = "idle";
    handledRef.current = new Set();
    stopSpeechRef.current();
  };

  const jumpToEnd = () => {
    stopRaf();
    applyClock(endSeconds);
    setPhase("idle");
    phaseRef.current = "idle";
    handledRef.current = new Set();
    stopSpeechRef.current();
  };

  // When a burst finishes during normal time, catch up to the next/latest due.
  useEffect(() => {
    if (phase !== "playing") return;
    if (input.speechPhase !== "idle") return;
    tryDispatchBurst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.speechPhase, phase]);

  useEffect(() => {
    return () => {
      stopRaf();
    };
  }, []);

  return {
    phase,
    minute: phase === "idle" ? input.clockMinute : runMinute,
    second: phase === "idle" ? input.clockSecond : runSecond,
    statusLabel: normalTimeStatusLabel({
      phase,
      minute: phase === "idle" ? input.clockMinute : runMinute,
      second: phase === "idle" ? input.clockSecond : runSecond,
    }),
    isActive: phase !== "idle",
    startFromKickOff: () => startAt(0, 0),
    startFromHalfTime: () => startAt(40, 0),
    startFromHere: () => startAt(input.clockMinute, input.clockSecond),
    pause,
    resume,
    stop,
    jumpToEnd,
  };
}
