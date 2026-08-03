"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMatchAudioListenState } from "@/hooks/useMatchAudioListenState";
import { useMatchCommentarySpeech } from "@/hooks/useMatchCommentarySpeech";
import { useMatchNormalTimeAudio } from "@/hooks/useMatchNormalTimeAudio";
import { matchDetailTabHref } from "@/lib/match-detail-tabs";
import {
  EMPTY_MATCH_ANIMATION_AUDIO,
  captionForAnimationClock,
  type MatchAnimationAudioCaption,
  type MatchAnimationPublicAudio,
} from "@/lib/match-animation-public-audio";
import { captionAtOrAfterClock } from "@/lib/match-commentary-speech";
import { formatMatchClock } from "@/lib/match-normal-time-audio";
import { MatchAnimationAudioBar } from "./MatchAnimationAudioBar";

function isLiveStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s.includes("live") ||
    s === "first half" ||
    s === "second half" ||
    s === "half time" ||
    s === "half_time" ||
    s === "in_progress"
  );
}

function isFinishedStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s === "result" ||
    s === "finished" ||
    s === "complete" ||
    s === "ft" ||
    s === "full_time" ||
    s === "full-time"
  );
}

export function MatchAudioCommentaryPanel({
  matchId,
  initialAudio,
  matchStatus,
  matchMinute = 0,
  matchSecond = 0,
  homeName,
  awayName,
  commentaryHref,
}: {
  matchId: string;
  initialAudio: MatchAnimationPublicAudio;
  matchStatus: string;
  matchMinute?: number;
  matchSecond?: number;
  homeName: string;
  awayName: string;
  /** Optional link to the written live commentary page. */
  commentaryHref?: string | null;
}) {
  const pathname = usePathname();
  const { soundEnabled, volume, toggleSound, enableListen, handleVolumeChange } =
    useMatchAudioListenState();
  const [audio, setAudio] = useState(initialAudio ?? EMPTY_MATCH_ANIMATION_AUDIO);
  const [voiceLabels, setVoiceLabels] = useState<string | null>(null);
  const [clockMinute, setClockMinute] = useState(Math.max(0, matchMinute));
  const [clockSecond, setClockSecond] = useState(Math.max(0, Math.min(59, matchSecond)));
  const [followLive, setFollowLive] = useState(true);
  const live = isLiveStatus(matchStatus);
  const finished = isFinishedStatus(matchStatus);

  useEffect(() => {
    setAudio(initialAudio ?? EMPTY_MATCH_ANIMATION_AUDIO);
  }, [initialAudio]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(`/api/fixtures/${encodeURIComponent(matchId)}/audio`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          status?: MatchAnimationPublicAudio["status"];
          scriptCount?: number;
          readySegmentCount?: number;
          captions?: MatchAnimationAudioCaption[];
          enabled?: boolean;
          voices?: {
            defaultsLabel?: string | null;
            presenters?: Array<{ role: string; label: string; provider: string }>;
          } | null;
        };
        if (cancelled || !Array.isArray(data.captions)) return;
        setAudio({
          enabled: data.enabled !== false,
          status: data.status ?? "stings_only",
          scriptCount: data.scriptCount ?? data.captions.length,
          readySegmentCount: data.readySegmentCount ?? 0,
          captions: data.captions,
        });
        if (data.voices?.presenters?.length) {
          const bits = data.voices.presenters.map(
            (p) => `${p.role === "lead" ? "Lead" : p.role === "analyst" ? "Analyst" : p.role}: ${p.label}`,
          );
          setVoiceLabels(
            [
              data.voices.defaultsLabel ? `Using ${data.voices.defaultsLabel}` : null,
              bits.join(" · "),
            ]
              .filter(Boolean)
              .join(" — "),
          );
        }
      } catch {
        /* keep initial */
      }
    }
    void refresh();
    if (!live) return;
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [matchId, live]);

  useEffect(() => {
    if (!followLive) return;
    if (live) {
      setClockMinute(Math.max(0, matchMinute));
      setClockSecond(Math.max(0, Math.min(59, matchSecond)));
      return;
    }
    if (finished && audio.captions.length) {
      const last = audio.captions[audio.captions.length - 1];
      setClockMinute(last.minute);
      setClockSecond(last.second);
    }
  }, [followLive, live, finished, matchMinute, matchSecond, audio.captions]);

  const maxMinute = useMemo(() => {
    if (!audio.captions.length) return Math.max(80, matchMinute);
    return Math.max(
      80,
      matchMinute,
      ...audio.captions.map((c) => c.minute),
    );
  }, [audio.captions, matchMinute]);

  const scrubCaption = audio.captions.length
    ? captionForAnimationClock(audio.captions, clockMinute, clockSecond)
    : null;

  const speech = useMatchCommentarySpeech({
    matchId,
    enabled: soundEnabled,
    volume,
    status: audio.status,
    caption: scrubCaption,
    captions: audio.captions,
    onEnsureListen: enableListen,
    suppressAutoPlay: true, // Normal time + explicit Play own autoplay
    onActiveCaptionChange: (caption) => {
      if (!caption) return;
      setFollowLive(false);
      setClockMinute(caption.minute);
      setClockSecond(caption.second);
    },
  });

  const normalTime = useMatchNormalTimeAudio({
    captions: audio.captions,
    clockMinute,
    clockSecond,
    speechPhase: speech.phase,
    // Clock stays on the 1× ticker — do not jump MM:SS back to the burst stamp.
    // One-shot bursts only — Normal time owns sequencing via the match clock.
    playCaption: (caption) => {
      speech.play(caption, { chain: false });
    },
    pauseSpeech: speech.pause,
    resumeSpeech: speech.resume,
    stopSpeech: speech.stop,
    onEnsureListen: enableListen,
    onClockTick: (minute, second) => {
      setFollowLive(false);
      setClockMinute(minute);
      setClockSecond(second);
    },
  });

  const activeCaption = speech.activeCaption ?? scrubCaption;

  // During stream / normal time, show a window of captions around the clock (not only past).
  const timelineCaptions = useMemo(() => {
    if (!audio.captions.length) return [];
    const now = clockMinute * 60 + clockSecond;
    if (normalTime.isActive || speech.streaming) {
      const indexed = audio.captions.map((c, i) => ({ c, i, t: c.minute * 60 + c.second }));
      const nearestIdx = indexed.reduce((best, row) => {
        if (row.t <= now) return row.i;
        return best;
      }, 0);
      const start = Math.max(0, nearestIdx - 4);
      const end = Math.min(audio.captions.length, nearestIdx + 8);
      return audio.captions.slice(start, end);
    }
    const upTo = audio.captions.filter((c) => c.minute * 60 + c.second <= now);
    const source = upTo.length ? upTo : audio.captions.slice(0, 1);
    return [...source].reverse().slice(0, 12);
  }, [audio.captions, clockMinute, clockSecond, normalTime.isActive, speech.streaming]);

  function selectCaption(caption: MatchAnimationAudioCaption) {
    if (normalTime.isActive) normalTime.stop();
    if (speech.streaming) speech.stop();
    setFollowLive(false);
    setClockMinute(caption.minute);
    setClockSecond(caption.second);
  }

  /** Play once from this caption and auto-advance through the rest of the feed. */
  function playStreamFrom(caption: MatchAnimationAudioCaption) {
    if (normalTime.isActive) normalTime.stop();
    setFollowLive(false);
    setClockMinute(caption.minute);
    setClockSecond(caption.second);
    speech.play(caption, { chain: true });
  }

  function startStreamFromScrub() {
    const start =
      captionAtOrAfterClock(audio.captions, clockMinute, clockSecond) ?? scrubCaption;
    if (!start) return;
    playStreamFrom(start);
  }

  const burstPhase = speech.phase;
  const displayClock = formatMatchClock(clockMinute, clockSecond);
  const streamActive = speech.streaming || speech.phase !== "idle";

  return (
    <section className="pr-match-audio" aria-label="Live Audio Commentary">
      <header className="pr-match-audio__header">
        <div>
          <h2 className="pr-match-audio__title">Live Audio Commentary</h2>
          <p className="pr-match-audio__sub">
            {homeName} vs {awayName} · Press Play once — auto-advances through the feed
          </p>
        </div>
        <div className="pr-match-audio__header-links">
          {commentaryHref ? (
            <Link href={commentaryHref} className="pr-match-audio__anim-link">
              Written commentary
            </Link>
          ) : null}
          <Link
            href={matchDetailTabHref(pathname, "animation")}
            className="pr-match-audio__anim-link"
          >
            Open Animations
          </Link>
        </div>
      </header>

      {voiceLabels ? (
        <p className="pr-match-audio__voices" aria-label="Active commentary voices">
          {voiceLabels}
        </p>
      ) : null}

      <div
        className={`pr-match-audio__normal${normalTime.isActive ? " is-active" : ""}`}
        aria-label="Normal time playback"
      >
        <div className="pr-match-audio__normal-head">
          <div>
            <p className="pr-match-audio__normal-label">Normal time</p>
            <p className="pr-match-audio__normal-copy">
              Commentary follows the match clock at real pace (1×).
            </p>
          </div>
          <span className="pr-match-audio__normal-clock" aria-live="polite">
            {normalTime.isActive ? normalTime.statusLabel : displayClock}
          </span>
        </div>

        <div className="pr-match-audio__normal-controls" role="group" aria-label="Normal time controls">
          {normalTime.phase === "playing" ? (
            <button type="button" className="pr-match-audio__normal-play is-on" onClick={normalTime.pause}>
              Pause
            </button>
          ) : normalTime.phase === "paused" ? (
            <button type="button" className="pr-match-audio__normal-play is-on" onClick={normalTime.resume}>
              Resume
            </button>
          ) : (
            <button
              type="button"
              className="pr-match-audio__normal-play"
              onClick={() => normalTime.startFromHere()}
              disabled={!audio.captions.length}
            >
              Play in normal time
            </button>
          )}
          <button
            type="button"
            className="pr-match-audio__normal-secondary"
            onClick={() => normalTime.startFromKickOff()}
            disabled={!audio.captions.length || normalTime.phase === "playing"}
          >
            From kick-off
          </button>
          <button
            type="button"
            className="pr-match-audio__normal-secondary"
            onClick={() => normalTime.startFromHalfTime()}
            disabled={!audio.captions.length || normalTime.phase === "playing"}
          >
            From half-time
          </button>
          <button
            type="button"
            className="pr-match-audio__normal-secondary"
            onClick={normalTime.stop}
            disabled={normalTime.phase === "idle"}
          >
            Stop
          </button>
          <button
            type="button"
            className="pr-match-audio__normal-secondary"
            onClick={() => {
              normalTime.jumpToEnd();
              setFollowLive(true);
            }}
            disabled={!audio.captions.length}
          >
            {live ? "Return to live" : "Jump to final"}
          </button>
        </div>
      </div>

      <MatchAnimationAudioBar
        audio={audio}
        soundEnabled={soundEnabled}
        volume={volume}
        clockMinute={clockMinute}
        clockSecond={clockSecond}
        showCaptions
        onToggleSound={toggleSound}
        onVolumeChange={handleVolumeChange}
        label="Live Audio"
        playback={{
          phase: burstPhase,
          mode: speech.mode,
          speaker: speech.speaker,
          statusLabel: normalTime.isActive
            ? `${normalTime.statusLabel} · ${speech.statusLabel}`
            : speech.statusLabel,
          playLabel: speech.streaming || speech.phase !== "idle" ? undefined : "Play stream",
          onPlay: () => {
            startStreamFromScrub();
          },
          onPause: () => {
            if (normalTime.phase === "playing") normalTime.pause();
            else speech.pause();
          },
          onResume: () => {
            if (normalTime.phase === "paused") normalTime.resume();
            else speech.resume();
          },
          onStop: () => {
            if (normalTime.isActive) normalTime.stop();
            speech.stop();
          },
          onPlayNext: () => {
            if (normalTime.isActive) normalTime.stop();
            speech.playNext();
          },
          canPlay: Boolean(scrubCaption ?? audio.captions[0]),
        }}
      />

      {activeCaption ? (
        <div
          className={`pr-match-audio__now${normalTime.isActive ? " is-normal" : ""}${
            streamActive ? " is-speaking" : ""
          }${speech.streaming ? " is-stream" : ""}`}
          aria-live="polite"
          aria-label="Current commentary"
        >
          <div className="pr-match-audio__now-meta">
            <span>{speech.streaming ? "On air · stream" : "Now on air"}</span>
            <span>{formatMatchClock(activeCaption.minute, activeCaption.second)}</span>
            {normalTime.isActive ? <span>Normal time</span> : null}
            {speech.mode === "broadcast" && speech.phase !== "idle" ? (
              <span>Broadcast audio</span>
            ) : null}
            {speech.mode === "preview" && speech.phase !== "idle" ? (
              <span>Preview voice</span>
            ) : null}
          </div>
          {activeCaption.written ? (
            <p className="pr-match-audio__now-written">
              <em>Written</em> {activeCaption.written}
            </p>
          ) : null}
          <p
            className={`pr-match-audio__now-lead${
              speech.speaker === "lead" ? " is-speaking" : ""
            }`}
          >
            <em>Lead</em> {activeCaption.lead}
          </p>
          <p
            className={`pr-match-audio__now-analyst${
              speech.speaker === "analyst" ? " is-speaking" : ""
            }`}
          >
            <em>Analyst</em> {activeCaption.analyst}
          </p>
        </div>
      ) : null}

      {audio.captions.length > 0 ? (
        <div className="pr-match-audio__clock">
          <div className="pr-match-audio__clock-row">
            <span className="pr-match-audio__clock-label">Match minute</span>
            <span className="pr-match-audio__clock-value">{displayClock}</span>
            {(live || finished) && !normalTime.isActive && (
              <button
                type="button"
                className={`pr-match-audio__follow${followLive ? " is-on" : ""}`}
                onClick={() => setFollowLive(true)}
                aria-pressed={followLive}
              >
                {live ? "Follow live" : "Jump to final"}
              </button>
            )}
          </div>
          <label className="pr-match-audio__scrub">
            <span className="sr-only">Scrub broadcast script clock</span>
            <input
              type="range"
              min={0}
              max={maxMinute}
              step={1}
              value={clockMinute}
              disabled={normalTime.phase === "playing" || speech.phase === "playing"}
              onChange={(e) => {
                if (normalTime.isActive) normalTime.stop();
                if (speech.streaming) speech.stop();
                setFollowLive(false);
                setClockMinute(Number(e.target.value));
                setClockSecond(0);
              }}
              aria-label="Broadcast script minute"
            />
          </label>
        </div>
      ) : null}

      {audio.captions.length > 0 ? (
        <div className="pr-match-audio__timeline" aria-label="Broadcast script timeline">
          <h3 className="pr-match-audio__timeline-title">
            {speech.streaming
              ? "Playing through feed"
              : normalTime.isActive
                ? "Commentary as clock advances"
                : "Broadcast script"}
          </h3>
          <ol className="pr-match-audio__feed">
            {timelineCaptions.map((caption, index) => {
              const isActive =
                activeCaption?.minute === caption.minute &&
                activeCaption?.second === caption.second &&
                activeCaption?.lead === caption.lead;
              const isSpeakingHere =
                speech.phase !== "idle" &&
                isActive &&
                (speech.speaker === "lead" || speech.speaker === "analyst");
              return (
                <li key={`${caption.minute}-${caption.second}-${index}`}>
                  <div
                    className={`pr-match-audio__item${isActive ? " is-active" : ""}${
                      isSpeakingHere ? " is-playing" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="pr-match-audio__item-main"
                      onClick={() => selectCaption(caption)}
                    >
                      <span className="pr-match-audio__item-clock">
                        {formatMatchClock(caption.minute, caption.second)}
                      </span>
                      <span className="pr-match-audio__item-lines">
                        {caption.written ? (
                          <span className="pr-match-audio__item-written">
                            <em>Written</em> {caption.written}
                          </span>
                        ) : null}
                        <span
                          className={`pr-match-audio__item-lead${
                            isActive && speech.speaker === "lead" ? " is-speaking" : ""
                          }`}
                        >
                          <em>Lead</em> {caption.lead}
                        </span>
                        <span
                          className={`pr-match-audio__item-analyst${
                            isActive && speech.speaker === "analyst" ? " is-speaking" : ""
                          }`}
                        >
                          <em>Analyst</em> {caption.analyst}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="pr-match-audio__item-play"
                      onClick={() => playStreamFrom(caption)}
                      aria-label={`Play stream from ${formatMatchClock(caption.minute, caption.second)}`}
                      title="Play from here through the feed"
                    >
                      ▶
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="pr-match-audio__empty">
          No Lead/Analyst scripts for this match yet. Listen still enables Animation stings when
          you open the Animations tab.
        </p>
      )}
    </section>
  );
}
