"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TeamCrest } from "./TeamCrest";
import { MatchAnimationPitch } from "./MatchAnimationPitch";
import { MatchAnimationFullTime } from "./MatchAnimationFullTime";
import { MatchAnimationScoreboard } from "./MatchAnimationScoreboard";
import { MatchAnimationSignal } from "./MatchAnimationSignal";
import { MatchAnimationGoalView } from "./MatchAnimationGoalView";
import type { MatchAnimationPublicPayload } from "@/lib/match-animation-types";
import {
  countdownUrgency,
  estimateServerNowMs,
  formatCountdownDisplay,
  parseCountdownParts,
  remainingMs,
} from "@/lib/match-animation-countdown";
import {
  defaultAnimationViewAfterLoad,
  fullTimeHoldMs,
} from "@/lib/match-animation-fulltime";
import {
  fieldZoneFromBallX,
  resolveAnimationMatchClock,
  resolveAnimationSignal,
  signalHoldMs,
  type AnimationSignal,
} from "@/lib/match-animation-signals";
import {
  attackDirectionForSide,
  resolvePitchIntensity,
} from "@/lib/match-animation-insight";
import { formatTimelinePlayerLine } from "@/lib/match-animation-player-enrich";
import {
  resolveAnimationPlayerStatChips,
  resolveAttackDefenceOverlayChips,
  resolveOverlayPitchPhase,
} from "@/lib/match-animation-player-stats";
import {
  playMatchAnimationCue,
  soundCueForSignalKind,
  unlockMatchAnimationAudio,
} from "@/lib/match-animation-audio";
import {
  EMPTY_MATCH_ANIMATION_AUDIO,
  captionForAnimationClock,
} from "@/lib/match-animation-public-audio";
import { useMatchAudioListenState } from "@/hooks/useMatchAudioListenState";
import { useMatchCommentarySpeech } from "@/hooks/useMatchCommentarySpeech";
import { MediaImage } from "@/components/media/MediaImage";
import {
  MatchAnimationPlayerStatChips,
  MatchAnimationPlayerStatsLeaders,
} from "./MatchAnimationPlayerStats";
import { MatchAnimationInsightCarousel } from "./MatchAnimationInsightCarousel";
import { MatchAnimationAudioBar } from "./MatchAnimationAudioBar";

const SPEEDS = [1, 2, 5, 10] as const;
const INTRO_SEEN_KEY = "r365-ma-intro-seen";

function formatKickoffLocal(iso: string | null, timeZone: string): string {
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "TBC";
  return d.toLocaleString("en-GB", {
    hour12: false,
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

type ViewMode = "full_time" | "replay" | "countdown" | "live" | "empty";

export function MatchAnimationPanel({
  payload,
  detailsHref,
}: {
  payload: MatchAnimationPublicPayload;
  detailsHref: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();
  const [livePayload, setLivePayload] = useState(payload);
  const { availability, home, away, events } = livePayload;

  const [serverAnchor, setServerAnchor] = useState({
    serverNowIso: payload.serverNow,
    clientReceivedAtMs: Date.now(),
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLivePayload(payload);
    setServerAnchor({ serverNowIso: payload.serverNow, clientReceivedAtMs: Date.now() });
  }, [payload]);
  const [introPhase, setIntroPhase] = useState<"playing" | "done">("playing");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [eventIndex, setEventIndex] = useState(0);
  const [mode, setMode] = useState<"full" | "highlights">("full");
  const [localPaused, setLocalPaused] = useState(false);
  const { soundEnabled, volume, toggleSound, handleVolumeChange } = useMatchAudioListenState();
  const [view, setView] = useState<ViewMode>("empty");
  const [ftAnimating, setFtAnimating] = useState(true);
  const [activeSignal, setActiveSignal] = useState<AnimationSignal | null>(null);
  const [signalVisible, setSignalVisible] = useState(false);
  const [conversionFlight, setConversionFlight] = useState<
    "idle" | "kicking" | "success" | "miss" | null
  >(null);
  /** Brief red try-zone on the pitch before switching to the TRY goal camera. */
  const [tryPreamble, setTryPreamble] = useState(false);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ftHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef(false);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const showCountdown =
    availability.showIntroCountdown &&
    (availability.phase === "countdown" ||
      availability.phase === "scheduled" ||
      availability.phase === "introduction" ||
      availability.phase === "kick_off_delayed");

  const showReplay = availability.showReplayControls && events.length > 0;
  const showLive = availability.showLiveControls;

  // Default view: full-time result after confirmed FT (no auto-replay).
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const hasDeepLink = Boolean(searchParams.get("event") || searchParams.get("minute"));
    const def = defaultAnimationViewAfterLoad({
      fullTimeConfirmed: availability.fullTimeConfirmed,
      hasDeepLinkEvent: hasDeepLink,
      showReplayControls: showReplay,
    });
    if (def === "full_time") {
      setView("full_time");
      setFtAnimating(!reducedMotion);
      setEventIndex(Math.max(0, events.length - 1));
      return;
    }
    if (showCountdown) setView("countdown");
    else if (showLive) setView("live");
    else if (showReplay) setView("replay");
    else setView("empty");
  }, [
    availability.fullTimeConfirmed,
    showCountdown,
    showLive,
    showReplay,
    searchParams,
    events.length,
    reducedMotion,
  ]);

  useEffect(() => {
    const key = `${INTRO_SEEN_KEY}:${payload.matchId}`;
    if (sessionStorage.getItem(key) === "1" || reducedMotion || view === "full_time") {
      setIntroPhase("done");
      return;
    }
    const t = window.setTimeout(
      () => {
        setIntroPhase("done");
        sessionStorage.setItem(key, "1");
      },
      reducedMotion ? 0 : 2200,
    );
    return () => window.clearTimeout(t);
  }, [payload.matchId, reducedMotion, view]);

  useEffect(() => {
    const eventId = searchParams.get("event");
    const minute = searchParams.get("minute");
    const modeParam = searchParams.get("mode");
    if (modeParam === "highlights") setMode("highlights");
    if (eventId) {
      const idx = events.findIndex((e) => e.id === eventId);
      if (idx >= 0) {
        setEventIndex(idx);
        setIntroPhase("done");
        setView("replay");
      }
    } else if (minute != null) {
      const m = Number(minute);
      if (Number.isFinite(m)) {
        let best = 0;
        for (let i = 0; i < events.length; i++) {
          if (events[i]!.minute <= m) best = i;
        }
        setEventIndex(best);
        setIntroPhase("done");
        setView("replay");
      }
    }
  }, [searchParams, events]);

  useEffect(() => {
    if (view !== "countdown") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [view]);

  // Advance live clock estimate between 30s payload refreshes.
  useEffect(() => {
    if (view !== "live") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [view]);

  // Live view always tracks the latest published event (unless locally paused).
  useEffect(() => {
    if (view !== "live" || localPaused || events.length === 0) return;
    setEventIndex(events.length - 1);
  }, [view, localPaused, events.length]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch(`/api/fixtures/${encodeURIComponent(livePayload.matchId)}/animation`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as MatchAnimationPublicPayload;
        setLivePayload(body);
        if (body.serverNow) {
          setServerAnchor({ serverNowIso: body.serverNow, clientReceivedAtMs: Date.now() });
        }
        if (view === "live" && !localPaused && body.events?.length) {
          setEventIndex(body.events.length - 1);
        }
        // Corrected official score / FT confirmation from CMS.
        if (body.availability?.fullTimeConfirmed && view === "live") {
          setView("full_time");
          setFtAnimating(!reducedMotion);
          setPlaying(false);
        }
      } catch {
        /* keep last anchor */
      }
    };
    void refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [livePayload.matchId, view, reducedMotion, localPaused]);

  // Replay autoplay — on end, hold then show full-time (especially at 5×/10×).
  useEffect(() => {
    if (view !== "replay" || !playing || localPaused) {
      if (playTimer.current) clearInterval(playTimer.current);
      playTimer.current = null;
      return;
    }
    playTimer.current = setInterval(() => {
      setEventIndex((i) => {
        if (i >= events.length - 1) {
          setPlaying(false);
          if (ftHoldTimer.current) clearTimeout(ftHoldTimer.current);
          const hold = fullTimeHoldMs(speed, reducedMotion);
          ftHoldTimer.current = setTimeout(() => {
            setView("full_time");
            setFtAnimating(!reducedMotion);
          }, hold);
          return i;
        }
        return i + 1;
      });
    }, Math.max(200, 1400 / speed));
    return () => {
      if (playTimer.current) clearInterval(playTimer.current);
    };
  }, [view, playing, localPaused, speed, events.length, reducedMotion]);

  // Event signals + conversion flight when the current event changes.
  useEffect(() => {
    if (view !== "replay" && view !== "live") {
      setSignalVisible(false);
      setActiveSignal(null);
      setConversionFlight(null);
      setTryPreamble(false);
      return;
    }
    const ev = events[eventIndex];
    if (!ev) return;

    const signal = resolveAnimationSignal({
      eventType: ev.eventType,
      label: ev.label,
      teamSide: ev.teamSide,
      playerName: ev.playerName,
      jerseyNumber: ev.jerseyNumber,
      playerImageUrl: ev.imageUrl,
    });
    if (ev.playerOff || ev.playerOn) {
      signal.playerOff = ev.playerOff
        ? ev.playerOffJersey != null
          ? `#${ev.playerOffJersey} ${ev.playerOff}`
          : ev.playerOff
        : signal.playerOff;
      signal.playerOn = ev.playerOn
        ? ev.playerOnJersey != null
          ? `#${ev.playerOnJersey} ${ev.playerOn}`
          : ev.playerOn
        : signal.playerOn;
    }
    setActiveSignal(signal);

    if (signalTimer.current) clearTimeout(signalTimer.current);
    if (conversionTimer.current) clearTimeout(conversionTimer.current);

    if (signal.frontGoalView === "try") {
      // Red try-zone on the pitch first, then cut to TRY + player on the posts camera.
      setConversionFlight("idle");
      setSignalVisible(false);
      const preambleMs = reducedMotion ? 0 : Math.max(450, 900 / speed);
      if (preambleMs <= 0) {
        setTryPreamble(false);
        setSignalVisible(true);
        playMatchAnimationCue("try", soundEnabledRef.current);
        signalTimer.current = setTimeout(
          () => setSignalVisible(false),
          signalHoldMs(speed, reducedMotion),
        );
      } else {
        setTryPreamble(true);
        conversionTimer.current = setTimeout(() => {
          setTryPreamble(false);
          setSignalVisible(true);
          playMatchAnimationCue("try", soundEnabledRef.current);
          signalTimer.current = setTimeout(
            () => setSignalVisible(false),
            signalHoldMs(speed, reducedMotion),
          );
        }, preambleMs);
      }
    } else if (signal.simulateConversion || signal.frontGoalView === "conversion" || signal.frontGoalView === "miss") {
      const isMiss = signal.kind === "conversion_missed" || signal.frontGoalView === "miss";
      setTryPreamble(false);
      setConversionFlight(reducedMotion ? (isMiss ? "miss" : "success") : "kicking");
      setSignalVisible(false);
      const kickMsLocal = reducedMotion ? 0 : Math.max(500, 1300 / speed);
      conversionTimer.current = setTimeout(() => {
        setConversionFlight(isMiss ? "miss" : "success");
        setSignalVisible(true);
        playMatchAnimationCue(isMiss ? "conversion_miss" : "conversion", soundEnabledRef.current);
        signalTimer.current = setTimeout(
          () => setSignalVisible(false),
          signalHoldMs(speed, reducedMotion),
        );
      }, kickMsLocal);
    } else if (signal.kind !== "generic") {
      setTryPreamble(false);
      setConversionFlight(null);
      setSignalVisible(true);
      const cue = soundCueForSignalKind(signal.kind);
      if (cue) playMatchAnimationCue(cue, soundEnabledRef.current);
      signalTimer.current = setTimeout(
        () => setSignalVisible(false),
        signalHoldMs(speed, reducedMotion),
      );
    } else {
      setTryPreamble(false);
      setConversionFlight(null);
      setSignalVisible(false);
    }

    return () => {
      if (signalTimer.current) clearTimeout(signalTimer.current);
      if (conversionTimer.current) clearTimeout(conversionTimer.current);
    };
  }, [eventIndex, events, view, speed, reducedMotion]);

  void tick;
  const serverNowMs = estimateServerNowMs(serverAnchor);
  const kickMs = availability.effectiveKickoffAt
    ? Date.parse(availability.effectiveKickoffAt)
    : NaN;
  const leftMs = Number.isFinite(kickMs) ? remainingMs(kickMs, serverNowMs) : 0;
  const parts = parseCountdownParts(leftMs);
  const urgency = countdownUrgency(leftMs);
  const current = events[eventIndex] ?? null;
  const lastEvent = events[events.length - 1] ?? null;
  const ballX =
    view === "full_time" ? (lastEvent?.x ?? 50) : (current?.x ?? 50);
  const ballY =
    view === "full_time" ? (lastEvent?.y ?? 50) : (current?.y ?? 50);
  const possession =
    view === "full_time"
      ? (lastEvent?.teamSide ?? "neutral")
      : (current?.teamSide ?? "neutral");
  const teamPossessionLabel =
    possession === "home" ? home.name : possession === "away" ? away.name : null;
  const teamPossessionShort =
    possession === "home"
      ? home.shortName || home.name
      : possession === "away"
        ? away.shortName || away.name
        : null;
  const playerPossessionLabel = current?.playerName
    ? current.jerseyNumber != null
      ? `#${current.jerseyNumber} ${current.playerName}`
      : current.playerName
    : null;
  const possessionLabel = playerPossessionLabel ?? teamPossessionLabel;
  const possessionTeamLabel = playerPossessionLabel ? teamPossessionShort : null;
  const possessionStatusLine = [possessionTeamLabel, possessionLabel]
    .filter(Boolean)
    .join(" · ");
  const playerStatChips = resolveAnimationPlayerStatChips({
    bundle: livePayload.playerStats,
    playerId: current?.playerId,
    playerName: current?.playerName ?? activeSignal?.playerName,
    eventType: current?.eventType ?? activeSignal?.kind,
    limit: 4,
  });
  const goalOverlayChips = resolveAttackDefenceOverlayChips({
    bundle: livePayload.playerStats,
    playerId: current?.playerId,
    playerName: current?.playerName ?? activeSignal?.playerName,
  });
  const goalPitchPhase = resolveOverlayPitchPhase(
    current?.eventType ?? activeSignal?.kind,
    goalOverlayChips,
  );
  const playerStatsLeaders = livePayload.playerStats?.leaders ?? [];
  const fieldZone =
    view === "full_time" || view === "countdown" || view === "empty"
      ? null
      : tryPreamble
        ? "ingoal"
        : fieldZoneFromBallX(ballX, possession);
  const showLineoutArrow = Boolean(activeSignal?.showLineoutArrow && signalVisible);
  const showKickPath = Boolean(activeSignal?.showKickPath && signalVisible);
  const pitchIntensity =
    view === "live" || view === "replay"
      ? tryPreamble
        ? "dangerous"
        : resolvePitchIntensity({ fieldZone })
      : null;
  const pitchPhaseLabel =
    tryPreamble
      ? "Try threat"
      : pitchIntensity === "dangerous"
        ? "Attack"
        : pitchIntensity === "attack"
          ? "Attack"
          : pitchIntensity === "possession"
            ? fieldZone === "own_22"
              ? "Defence"
              : "In Possession"
            : null;
  const homeAttackDirection =
    view === "countdown" || view === "empty"
      ? null
      : attackDirectionForSide("home", livePayload.period);
  const awayAttackDirection =
    view === "countdown" || view === "empty"
      ? null
      : attackDirectionForSide("away", livePayload.period);
  const showHalfTimeInsight =
    view === "live" && availability.phase === "half_time";
  const showFrontGoal =
    (view === "replay" || view === "live") &&
    !showHalfTimeInsight &&
    !tryPreamble &&
    Boolean(activeSignal?.frontGoalView) &&
    (signalVisible ||
      conversionFlight === "kicking" ||
      conversionFlight === "success" ||
      conversionFlight === "miss");
  const goalTeam =
    activeSignal?.teamSide === "away" ? away : activeSignal?.teamSide === "home" ? home : home;
  const goalMode =
    activeSignal?.frontGoalView === "miss" || activeSignal?.kind === "conversion_missed"
      ? "miss"
      : activeSignal?.frontGoalView === "try"
        ? "try"
        : activeSignal?.frontGoalView === "drop_goal"
          ? "conversion"
          : activeSignal?.frontGoalView === "penalty_goal"
            ? "conversion"
            : "conversion";
  const currentEvent = events[eventIndex];
  const assistLabel = currentEvent?.assistPlayerName
    ? `Assist · ${currentEvent.assistPlayerName}`
    : null;

  // During replay show running score from events when present; live/FT uses CMS.
  const displayHomeScore =
    view === "replay" && current?.scoreHome != null ? current.scoreHome : livePayload.homeScore;
  const displayAwayScore =
    view === "replay" && current?.scoreAway != null ? current.scoreAway : livePayload.awayScore;

  const resolvedClock = resolveAnimationMatchClock({
    matchMinute: livePayload.matchMinute,
    matchSecond: livePayload.matchSecond,
    period: livePayload.period,
    events,
    scheduledKickoffAt: livePayload.scheduledKickoffAt,
    serverNowIso: new Date(serverNowMs).toISOString(),
    currentEvent: current,
    mode: view === "replay" ? "replay" : "live",
  });

  const clockLabel =
    view === "full_time"
      ? "FT"
      : view === "countdown"
        ? formatCountdownDisplay(parts)
        : resolvedClock.label;
  const progressPercent =
    view === "full_time"
      ? 100
      : Math.min(100, (resolvedClock.minute / 80) * 100);

  // Live / FT: newest first so the latest update is visible at the top.
  // Replay: chronological so "Watch from Start" reads naturally.
  const timelineSource =
    mode === "highlights"
      ? events.filter((e) =>
          /try|conversion|penalty|drop|card|red|yellow|scrum|line.?out|sub|replacement|tmo|overturn|decision/i.test(
            e.eventType,
          ),
        )
      : events;
  const timelineEvents =
    view === "replay" ? timelineSource : [...timelineSource].reverse();

  const statusText =
    view === "full_time" || availability.phase === "full_time"
      ? "FULL-TIME"
      : availability.phase === "abandoned"
        ? "ABANDONED"
        : availability.phase === "awarded"
          ? "AWARDED"
          : availability.phase === "live" || availability.phase === "second_half"
            ? "LIVE"
            : availability.phase === "half_time"
              ? "HALF-TIME"
              : availability.phase === "waiting_confirmation"
                ? "WAITING"
                : availability.phase === "kick_off_delayed"
                  ? "DELAYED"
                  : availability.tabBadge ?? "SCHEDULED";

  const autoPlaying = view === "replay" && playing && !localPaused;

  function pauseAutoReplay() {
    setPlaying(false);
    setLocalPaused(true);
    if (ftHoldTimer.current) {
      clearTimeout(ftHoldTimer.current);
      ftHoldTimer.current = null;
    }
  }

  function resumeAutoReplay() {
    void unlockMatchAnimationAudio();
    setPlaying(true);
    setLocalPaused(false);
  }

  function toggleAutoReplay() {
    if (autoPlaying) pauseAutoReplay();
    else resumeAutoReplay();
  }

  const audioState = livePayload.audio ?? EMPTY_MATCH_ANIMATION_AUDIO;
  const showAudioCaptions =
    view === "live" || view === "replay" || view === "full_time";
  const activeAudioCaption =
    showAudioCaptions && audioState.captions.length
      ? captionForAnimationClock(
          audioState.captions,
          resolvedClock.minute,
          resolvedClock.second,
        )
      : null;
  useMatchCommentarySpeech({
    matchId: payload.matchId,
    enabled: soundEnabled && showAudioCaptions,
    volume,
    status: audioState.status,
    caption: activeAudioCaption,
  });

  function startReplay(opts?: { highlights?: boolean; fromKickOff?: boolean }) {
    if (opts?.highlights) setMode("highlights");
    else setMode("full");
    setEventIndex(0);
    setView("replay");
    setPlaying(true);
    setLocalPaused(false);
    setFtAnimating(false);
    void unlockMatchAnimationAudio();
    if (opts?.fromKickOff !== false) {
      /* start from first event / kick-off */
    }
  }

  return (
    <section
      className={`pr-ma${introPhase === "playing" && view === "countdown" ? " pr-ma--intro" : ""}`}
      aria-label="Match Animation"
    >
      <header className="pr-ma__header">
        <div className="pr-ma__header-top">
          <h2 className="pr-ma__title">Animation</h2>
          <span className="pr-ma__status" aria-label={`Status: ${statusText}`}>
            {statusText}
          </span>
        </div>
        <p className="pr-ma__comp">
          {payload.competitionName}
          {payload.venueName ? ` · ${payload.venueName}` : ""}
        </p>
      </header>

      {view !== "empty" ? (
        <MatchAnimationAudioBar
          audio={audioState}
          soundEnabled={soundEnabled}
          volume={volume}
          clockMinute={resolvedClock.minute}
          clockSecond={resolvedClock.second}
          showCaptions={showAudioCaptions}
          onToggleSound={toggleSound}
          onVolumeChange={handleVolumeChange}
        />
      ) : null}

      {view !== "countdown" && view !== "empty" ? (
        <MatchAnimationScoreboard
          homeName={home.name}
          awayName={away.name}
          homeScore={displayHomeScore}
          awayScore={displayAwayScore}
          clockLabel={clockLabel}
          statusHint={
            view === "live"
              ? showHalfTimeInsight
                ? "HALF-TIME"
                : "LIVE"
              : view === "full_time"
                ? "FULL-TIME"
                : null
          }
          progressPercent={progressPercent}
          homeAttackDirection={homeAttackDirection}
          awayAttackDirection={awayAttackDirection}
        />
      ) : null}

      {view === "full_time" ? (
        <div className="pr-ma-stage pr-ma-stage--ft">
          <div className="pr-ma-stage__pitch-wrap">
            <MatchAnimationPitch
              homeColour={home.colour}
              awayColour={away.colour}
              ballX={ballX}
              ballY={ballY}
              possession={possession}
              darkened
              reducedMotion={reducedMotion}
            />
          </div>
          <MatchAnimationFullTime
            payload={livePayload}
            detailsHref={detailsHref}
            reducedMotion={reducedMotion}
            animating={ftAnimating}
            speed={speed}
            onSpeed={(s) => setSpeed(s)}
            onReplayMatch={() => startReplay({ fromKickOff: true })}
            onKeyMoments={() => startReplay({ highlights: true })}
          />
          <MatchAnimationInsightCarousel
            payload={livePayload}
            mode="full_time"
            reducedMotion={reducedMotion}
          />
        </div>
      ) : null}

      {view === "empty" && availability.message ? (
        <div className="pr-ma__empty cms-card" role="status">
          <p>{availability.message}</p>
          <Link href={detailsHref} className="pr-ma__back-link">
            Back to Match Details
          </Link>
        </div>
      ) : null}

      {view === "countdown" ? (
        <div
          className={`pr-ma-intro${introPhase === "playing" ? " pr-ma-intro--animating" : " pr-ma-intro--ready"}${
            urgency === "under_1m" ? " pr-ma-intro--imminent" : ""
          }${urgency === "under_10m" ? " pr-ma-intro--active" : ""}`}
        >
          <div className="pr-ma-intro__stadium" aria-hidden />
          <p className="pr-ma-intro__comp pr-ma-intro__step">{payload.competitionName}</p>
          <div className="pr-ma-intro__teams">
            <div className="pr-ma-intro__side pr-ma-intro__side--home pr-ma-intro__step">
              <span className="pr-ma-intro__crest" style={{ ["--ma-colour" as string]: home.colour }}>
                <TeamCrest name={home.name} imageUrl={home.imageUrl} size="lg" labelled />
              </span>
              <span className="pr-ma-intro__name">{home.shortName}</span>
            </div>
            <span className="pr-ma-intro__vs pr-ma-intro__step" aria-hidden>
              VS
            </span>
            <div className="pr-ma-intro__side pr-ma-intro__side--away pr-ma-intro__step">
              <span className="pr-ma-intro__crest" style={{ ["--ma-colour" as string]: away.colour }}>
                <TeamCrest name={away.name} imageUrl={away.imageUrl} size="lg" labelled />
              </span>
              <span className="pr-ma-intro__name">{away.shortName}</span>
            </div>
          </div>
          <p className="pr-ma-intro__venue pr-ma-intro__step">{payload.venueName ?? "Venue TBC"}</p>
          <p className="pr-ma-intro__ko pr-ma-intro__step">
            Kick-off: {formatKickoffLocal(availability.effectiveKickoffAt, payload.timeZone)}
          </p>
          {payload.refereeName ? (
            <p className="pr-ma-intro__officials pr-ma-intro__step">Referee: {payload.refereeName}</p>
          ) : null}
          {availability.phase === "kick_off_delayed" ? (
            <p className="pr-ma-intro__delay" role="status">
              Kick-off delayed.
            </p>
          ) : null}
          {availability.phase === "waiting_confirmation" || urgency === "zero" ? (
            <p className="pr-ma-intro__wait" role="status">
              Waiting for kick-off confirmation.
            </p>
          ) : (
            <>
              <p className="pr-ma-intro__starts">STARTS IN</p>
              <p
                className={`pr-ma-intro__clock pr-ma-intro__clock--${urgency}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {formatCountdownDisplay(parts)}
              </p>
              {urgency === "under_1m" ? (
                <p className="pr-ma-intro__approaching">Kick-off approaching</p>
              ) : null}
              <p className="pr-ma-intro__footnote">Match Animation starts at kick-off</p>
            </>
          )}
        </div>
      ) : null}

      {(view === "replay" || view === "live") && (
        <div className="pr-ma-stage">
          <div className="pr-ma-stage__pitch-wrap">
            {showFrontGoal && activeSignal?.frontGoalView ? (
              <MatchAnimationGoalView
                teamColour={goalTeam.colour}
                teamName={goalTeam.name}
                mode={goalMode}
                flight={
                  goalMode === "try"
                    ? "idle"
                    : (conversionFlight ?? (goalMode === "miss" ? "miss" : "success"))
                }
                reducedMotion={reducedMotion}
                teamLabel={goalTeam.name}
                playerLabel={
                  activeSignal?.playerName
                    ? activeSignal.jerseyNumber != null
                      ? `#${activeSignal.jerseyNumber} ${activeSignal.playerName}`
                      : activeSignal.playerName
                    : null
                }
                headline={activeSignal?.title ?? null}
                assistLabel={goalMode === "try" ? assistLabel : null}
                pitchPhase={goalPitchPhase}
              />
            ) : (
              <MatchAnimationPitch
                homeColour={home.colour}
                awayColour={away.colour}
                ballX={tryPreamble ? (possession === "away" ? 4 : 96) : ballX}
                ballY={ballY}
                possession={possession}
                possessionLabel={showHalfTimeInsight ? null : possessionLabel}
                possessionTeamLabel={showHalfTimeInsight ? null : possessionTeamLabel}
                fieldZone={showHalfTimeInsight ? null : fieldZone}
                showLineoutArrow={showHalfTimeInsight || tryPreamble ? false : showLineoutArrow}
                showKickPath={showHalfTimeInsight || tryPreamble ? false : showKickPath}
                intensity={showHalfTimeInsight ? null : pitchIntensity}
                phaseLabel={showHalfTimeInsight ? null : pitchPhaseLabel}
                conversionFlight={null}
                lit={view === "live" && !showHalfTimeInsight}
                darkened={showHalfTimeInsight}
                reducedMotion={reducedMotion}
              />
            )}
            {activeSignal && !showHalfTimeInsight && !showFrontGoal ? (
              <MatchAnimationSignal
                signal={activeSignal}
                home={home}
                away={away}
                visible={signalVisible}
                playerStatChips={playerStatChips}
              />
            ) : null}
          </div>

          {showHalfTimeInsight ? (
            <MatchAnimationInsightCarousel
              payload={livePayload}
              mode="half_time"
              reducedMotion={reducedMotion}
            />
          ) : null}

          <div className="pr-ma-now" aria-live="polite">
            {view === "live" ? (
              <>
                <p className="pr-ma-now__label">Current action</p>
                <p className="pr-ma-now__text">
                  {localPaused
                    ? "Display paused (match continues)"
                    : activeSignal && signalVisible
                      ? activeSignal.title
                      : (current?.label ?? "In play")}
                </p>
                <p className="pr-ma-now__meta">
                  Connection: {localPaused ? "Live feed active · local pause" : "Live"}
                  {possessionStatusLine ? ` · ${possessionStatusLine}` : ""}
                </p>
                {playerStatChips.length > 0 && !showFrontGoal ? (
                  <MatchAnimationPlayerStatChips
                    chips={playerStatChips}
                    title="Active player stats"
                  />
                ) : null}
              </>
            ) : (
              <>
                <p className="pr-ma-now__label">
                  {autoPlaying ? "Auto replay" : localPaused || !playing ? "Paused" : "Replay"}
                  {current ? ` · ${current.minute}'` : ""}
                </p>
                <p className="pr-ma-now__text">
                  {activeSignal && signalVisible
                    ? [
                        activeSignal.title,
                        activeSignal.jerseyNumber != null && activeSignal.playerName
                          ? `#${activeSignal.jerseyNumber} ${activeSignal.playerName}`
                          : activeSignal.playerName,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : (current?.label ?? "Select an event to replay")}
                </p>
                {playerStatChips.length > 0 && !showFrontGoal ? (
                  <MatchAnimationPlayerStatChips
                    chips={playerStatChips}
                    title="Active player stats"
                  />
                ) : null}
              </>
            )}
          </div>

          {playerStatsLeaders.length > 0 ? (
            <MatchAnimationPlayerStatsLeaders
              leaders={playerStatsLeaders}
              home={home}
              away={away}
            />
          ) : null}

          <div className="pr-ma-controls" role="group" aria-label="Playback controls">
            {view === "live" ? (
              <>
                <button type="button" className="pr-ma-btn" onClick={() => setLocalPaused((p) => !p)}>
                  {localPaused ? "Play display" : "Pause display"}
                </button>
                <button
                  type="button"
                  className="pr-ma-btn"
                  onClick={() => {
                    setEventIndex(0);
                    setLocalPaused(false);
                  }}
                >
                  Watch from Start
                </button>
                <button
                  type="button"
                  className="pr-ma-btn pr-ma-btn--primary"
                  onClick={() => {
                    setEventIndex(Math.max(0, events.length - 1));
                    setLocalPaused(false);
                  }}
                >
                  Return to Live
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`pr-ma-btn${autoPlaying ? " pr-ma-btn--primary" : ""}`}
                  onClick={toggleAutoReplay}
                  aria-pressed={autoPlaying}
                >
                  {autoPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  className="pr-ma-btn"
                  onClick={() => startReplay()}
                >
                  Restart auto replay
                </button>
                <button
                  type="button"
                  className="pr-ma-btn"
                  onClick={() => {
                    pauseAutoReplay();
                    setEventIndex(0);
                  }}
                >
                  Go to start
                </button>
                <button
                  type="button"
                  className="pr-ma-btn"
                  onClick={() => {
                    pauseAutoReplay();
                    setEventIndex((i) => Math.max(0, i - 1));
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="pr-ma-btn"
                  onClick={() => {
                    pauseAutoReplay();
                    setEventIndex((i) => Math.min(events.length - 1, i + 1));
                  }}
                >
                  Next
                </button>
                {availability.fullTimeConfirmed ? (
                  <button
                    type="button"
                    className="pr-ma-btn"
                    onClick={() => {
                      pauseAutoReplay();
                      setView("full_time");
                      setFtAnimating(false);
                    }}
                  >
                    Full-time result
                  </button>
                ) : null}
              </>
            )}
            <div className="pr-ma-speeds" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pr-ma-btn pr-ma-btn--speed${speed === s ? " is-active" : ""}`}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                >
                  {s}×
                </button>
              ))}
            </div>
            {view === "replay" ? (
              <div className="pr-ma-modes" role="group" aria-label="Replay mode">
                <button
                  type="button"
                  className={`pr-ma-btn${mode === "full" ? " is-active" : ""}`}
                  onClick={() => setMode("full")}
                  aria-pressed={mode === "full"}
                >
                  Full Match
                </button>
                <button
                  type="button"
                  className={`pr-ma-btn${mode === "highlights" ? " is-active" : ""}`}
                  onClick={() => setMode("highlights")}
                  aria-pressed={mode === "highlights"}
                >
                  Key Moments
                </button>
              </div>
            ) : null}
          </div>

          {timelineEvents.length > 0 ? (
            <div
              className="pr-ma-timeline"
              role="list"
              aria-label={view === "replay" ? "Match timeline" : "Live timeline"}
            >
              {timelineEvents.map((ev) => {
                const idx = events.findIndex((e) => e.id === ev.id);
                const active = idx === eventIndex;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    role="listitem"
                    className={`pr-ma-timeline__item${active ? " is-active" : ""}`}
                    onClick={() => {
                      setEventIndex(idx);
                      setPlaying(false);
                      const url = new URL(pathname, window.location.origin);
                      url.searchParams.set("tab", "animation");
                      url.searchParams.set("event", ev.id);
                      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
                    }}
                  >
                    <span className="pr-ma-timeline__min">{ev.minute}&apos;</span>
                    {ev.imageUrl ? (
                      <span className="pr-ma-timeline__photo" aria-hidden>
                        <MediaImage src={ev.imageUrl} alt="" width={28} height={28} />
                      </span>
                    ) : ev.jerseyNumber != null ? (
                      <span className="pr-ma-timeline__shirt" aria-hidden>
                        {ev.jerseyNumber}
                      </span>
                    ) : null}
                    <span className="pr-ma-timeline__body">
                      <span className="pr-ma-timeline__type">
                        {ev.eventType.replace(/_/g, " ")}
                      </span>
                      <span className="pr-ma-timeline__label">
                        {formatTimelinePlayerLine({
                          playerName: ev.playerName,
                          jerseyNumber: ev.jerseyNumber,
                          playerOff: ev.playerOff,
                          playerOn: ev.playerOn,
                          playerOffJersey: ev.playerOffJersey,
                          playerOnJersey: ev.playerOnJersey,
                          fallbackLabel: ev.label,
                        })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {view !== "full_time" ? (
        <p className="pr-ma__footer">
          <Link href={detailsHref} className="pr-ma__back-link">
            Back to Match Details
          </Link>
        </p>
      ) : null}
    </section>
  );
}
