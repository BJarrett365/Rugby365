"use client";

import type { MatchAnimationPublicAudio } from "@/lib/match-animation-public-audio";
import {
  captionForAnimationClock,
  publicAudioProductNote,
  publicAudioStatusLabel,
} from "@/lib/match-animation-public-audio";
import type { CommentarySpeechMode, CommentarySpeechPhase, CommentarySpeechSpeaker } from "@/lib/match-commentary-speech";

export function MatchAnimationAudioBar({
  audio,
  soundEnabled,
  volume,
  clockMinute,
  clockSecond,
  showCaptions,
  onToggleSound,
  onVolumeChange,
  label = "Audio",
  playback,
}: {
  audio: MatchAnimationPublicAudio;
  soundEnabled: boolean;
  volume: number;
  clockMinute: number;
  clockSecond: number;
  showCaptions: boolean;
  onToggleSound: () => void;
  onVolumeChange: (volume: number) => void;
  /** Override identity label (e.g. Live Audio on match centre). */
  label?: string;
  /** Optional Play / Pause / Stop surface (Audio tab). */
  playback?: {
    phase: CommentarySpeechPhase;
    mode: CommentarySpeechMode | null;
    speaker: CommentarySpeechSpeaker | null;
    statusLabel: string;
    /** Override idle Play button label (e.g. "Play stream"). */
    playLabel?: string;
    onPlay: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onPlayNext?: () => void;
    canPlay: boolean;
  };
}) {
  const statusLabel = publicAudioStatusLabel(audio.status, soundEnabled);
  const caption =
    showCaptions && audio.captions.length > 0
      ? captionForAnimationClock(audio.captions, clockMinute, clockSecond)
      : null;
  const note = publicAudioProductNote(audio.status);
  const toggleSub =
    audio.status === "streaming"
      ? soundEnabled
        ? "Commentary on"
        : "Tap for commentary"
      : audio.status === "scripts_ready"
        ? soundEnabled
          ? "Captions on"
          : "Tap for captions"
        : soundEnabled
          ? "Stings playing"
          : "Tap to enable";

  const playing = playback?.phase === "playing";
  const paused = playback?.phase === "paused";

  return (
    <div className="pr-ma-audio" aria-label="Match audio">
      <div className="pr-ma-audio__bar">
        <div className="pr-ma-audio__identity">
          <span className="pr-ma-audio__label">{label}</span>
          <span
            className={`pr-ma-audio__live${soundEnabled || playing ? " is-on" : ""}`}
            aria-hidden
          />
          <span className="pr-ma-audio__status">
            {playback && playback.phase !== "idle" ? playback.statusLabel : statusLabel}
          </span>
        </div>

        <div className="pr-ma-audio__controls">
          {playback ? (
            <div className="pr-ma-audio__transport" role="group" aria-label="Commentary playback">
              {playing ? (
                <button
                  type="button"
                  className="pr-ma-audio__play is-on"
                  onClick={playback.onPause}
                  aria-label="Pause commentary"
                >
                  Pause
                </button>
              ) : paused ? (
                <button
                  type="button"
                  className="pr-ma-audio__play is-on"
                  onClick={playback.onResume}
                  aria-label="Resume commentary"
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  className="pr-ma-audio__play"
                  onClick={playback.onPlay}
                  disabled={!playback.canPlay}
                  aria-label={playback.playLabel ?? "Play commentary"}
                >
                  {playback.playLabel ?? "Play"}
                </button>
              )}
              <button
                type="button"
                className="pr-ma-audio__stop"
                onClick={playback.onStop}
                disabled={playback.phase === "idle"}
                aria-label="Stop commentary"
              >
                Stop
              </button>
              {playback.onPlayNext ? (
                <button
                  type="button"
                  className="pr-ma-audio__next"
                  onClick={playback.onPlayNext}
                  disabled={!playback.canPlay}
                  aria-label="Play next caption"
                >
                  Next
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className={`pr-ma-audio__toggle${soundEnabled ? " is-on" : ""}`}
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            title={
              soundEnabled
                ? "Turn Listen off"
                : audio.status === "streaming"
                  ? "Enable Live Audio Commentary"
                  : audio.status === "scripts_ready"
                    ? "Enable Live Audio Commentary captions"
                    : "Enable try and conversion sounds"
            }
          >
            <span className="pr-ma-audio__toggle-main">
              {soundEnabled ? "Listen on" : "Listen"}
            </span>
            <span className="pr-ma-audio__toggle-sub">{toggleSub}</span>
          </button>

          <label className={`pr-ma-audio__volume${soundEnabled || playing ? "" : " is-disabled"}`}>
            <span className="pr-ma-audio__volume-label">Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(volume * 100)}
              disabled={!soundEnabled && !playing}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              aria-label="Audio volume"
            />
          </label>
        </div>
      </div>

      <p className="pr-ma-audio__note">{note}</p>

      {caption ? (
        <div className="pr-ma-audio__captions" aria-live="polite">
          <div className="pr-ma-audio__captions-meta">
            <span>Live Audio Commentary</span>
            <span>
              {String(caption.minute).padStart(2, "0")}:
              {String(caption.second).padStart(2, "0")}
            </span>
            {audio.scriptCount > 0 ? (
              <span>{audio.scriptCount} scripts</span>
            ) : null}
            {playback?.mode === "preview" && playback.phase !== "idle" ? (
              <span>Preview voice</span>
            ) : null}
            {playback?.mode === "broadcast" && playback.phase !== "idle" ? (
              <span>Broadcast audio</span>
            ) : null}
          </div>
          {caption.written ? (
            <p className="pr-ma-audio__line pr-ma-audio__line--written">
              <span>Written</span>
              {caption.written}
            </p>
          ) : null}
          <p
            className={`pr-ma-audio__line pr-ma-audio__line--lead${
              playback?.speaker === "lead" ? " is-speaking" : ""
            }`}
          >
            <span>Lead</span>
            {caption.lead}
          </p>
          <p
            className={`pr-ma-audio__line pr-ma-audio__line--analyst${
              playback?.speaker === "analyst" ? " is-speaking" : ""
            }`}
          >
            <span>Analyst</span>
            {caption.analyst}
          </p>
        </div>
      ) : null}
    </div>
  );
}
