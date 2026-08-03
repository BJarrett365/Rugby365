"use client";

import { useEffect, useState } from "react";
import {
  MATCH_AUDIO_LISTEN_CHANGE_EVENT,
  readMatchAnimationSoundEnabled,
  readMatchAnimationVolume,
  unlockMatchAnimationAudio,
  writeMatchAnimationSoundEnabled,
  writeMatchAnimationVolume,
} from "@/lib/match-animation-audio";

/** Shared Listen on/off + volume — synced via localStorage across Match Audio + Animation. */
export function useMatchAudioListenState() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [volume, setVolume] = useState(0.85);

  useEffect(() => {
    function syncFromStorage() {
      setSoundEnabled(readMatchAnimationSoundEnabled());
      setVolume(readMatchAnimationVolume());
    }
    syncFromStorage();
    window.addEventListener(MATCH_AUDIO_LISTEN_CHANGE_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(MATCH_AUDIO_LISTEN_CHANGE_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    writeMatchAnimationSoundEnabled(next);
    if (next) void unlockMatchAnimationAudio();
  }

  /** Turn Listen on from a Play gesture (never toggles off). */
  function enableListen() {
    if (!soundEnabled) {
      setSoundEnabled(true);
      writeMatchAnimationSoundEnabled(true);
    }
    void unlockMatchAnimationAudio();
  }

  function handleVolumeChange(next: number) {
    setVolume(next);
    writeMatchAnimationVolume(next);
    if (next > 0 && !soundEnabled) {
      setSoundEnabled(true);
      writeMatchAnimationSoundEnabled(true);
      void unlockMatchAnimationAudio();
    }
  }

  return { soundEnabled, volume, toggleSound, enableListen, handleVolumeChange };
}
