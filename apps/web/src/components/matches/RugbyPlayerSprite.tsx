"use client";

import { useEffect, useState } from "react";
import { recolorKitSprite } from "@/lib/animation-kit-sprite-filter";
import type { RugbySpriteState } from "@/lib/match-animation-sprite-state";

const ASSET_BASE = "/animation/player";

const RUN_FRAMES = ["runf-5", "runf-2", "runf-3", "runf-1", "runf-4", "runf-6"];
const KICK_FRAMES = ["kickf-1", "kickf-2", "kickf-3", "kickf-4"];
const CHEER_FRAMES = ["cheerf-1", "cheerf-2", "cheerf-3", "cheerf-4"];
const WALK_FRAMES = ["walkf-1", "walkf-2", "walkf-3", "walkf-4"];
const CLAP_FRAMES = ["clapf-1", "clapf-2", "clapf-3", "clapf-4"];
const JOIN_FRAMES = ["joinf-1", "joinf-2", "joinf-3", "joinf-4"];
const SHAKE_FRAMES = ["shakef-1", "shakef-2"];

const MISS_REACTIONS = [
  { key: "miss-knees", frames: ["missf-knees-1", "missf-knees-2"], anim: "m3d-miss-knees" },
  { key: "miss-hands", frames: ["missf-hands-1", "missf-hands-2"], anim: "m3d-miss-hands" },
  { key: "miss-fist", frames: ["missf-fist-1", "missf-fist-2"], anim: "m3d-miss-fist" },
] as const;

const GROUPS: { key: string; src?: string; frames?: string[] }[] = [
  { key: "idle", src: "mascot-idle" },
  { key: "run", frames: RUN_FRAMES },
  { key: "kick", frames: KICK_FRAMES },
  { key: "cheer", frames: CHEER_FRAMES },
  { key: "walk", frames: WALK_FRAMES },
  { key: "clap", frames: CLAP_FRAMES },
  { key: "join", frames: JOIN_FRAMES },
  { key: "booked", frames: SHAKE_FRAMES },
  ...MISS_REACTIONS.map((r) => ({ key: r.key, frames: [...r.frames] })),
];

const GROUP_OF: Record<RugbySpriteState, string> = {
  idle: "idle",
  run: "run",
  kick: "kick",
  goal: "cheer",
  celebrate: "cheer",
  miss: "idle",
  walk: "walk",
  "sent-off": "walk",
  "clap-off": "clap",
  "jog-on": "join",
  booked: "booked",
};

const POSE: Record<RugbySpriteState, { anim: string }> = {
  idle: { anim: "m3d-idle" },
  run: { anim: "m3d-run" },
  kick: { anim: "m3d-kick" },
  goal: { anim: "m3d-goal" },
  celebrate: { anim: "m3d-celebrate" },
  miss: { anim: "m3d-miss" },
  walk: { anim: "m3d-walk" },
  "sent-off": { anim: "m3d-walk-grump" },
  "clap-off": { anim: "m3d-clap-walk" },
  "jog-on": { anim: "m3d-jog-on" },
  booked: { anim: "m3d-booked" },
};

const NEEDED_NAMES = GROUPS.flatMap((g) => (g.frames ? g.frames : g.src ? [g.src] : []));

export function RugbyPlayerSprite({
  state = "run",
  shirtColor,
  shirtAccent,
  shirtName,
  shirtNumber,
  className,
  showBall = true,
  facing = "right",
  label,
}: {
  state?: RugbySpriteState;
  shirtColor?: string | null;
  shirtAccent?: string | null;
  shirtName?: string | null;
  shirtNumber?: string | number | null;
  className?: string;
  showBall?: boolean;
  facing?: "left" | "right";
  label?: string;
}) {
  const [ready, setReady] = useState(false);
  const [tinted, setTinted] = useState<Record<string, string> | null>(null);
  const [missIdx, setMissIdx] = useState(0);
  const pose = POSE[state] ?? POSE.idle;
  const kitHex = shirtColor?.trim() || "";

  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setReady(true);
    };
    probe.onerror = () => {};
    probe.src = `${ASSET_BASE}/mascot-idle.png`;
    return () => {
      cancelled = true;
    };
  }, [kitHex]);

  useEffect(() => {
    if (state === "miss") setMissIdx(Math.floor(Math.random() * MISS_REACTIONS.length));
  }, [state]);

  useEffect(() => {
    if (!kitHex) {
      setTinted(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        NEEDED_NAMES.map(async (name) => {
          const src = `${ASSET_BASE}/${name}.png`;
          try {
            const out = await recolorKitSprite(src, kitHex, shirtAccent ?? kitHex, "a");
            next[name] = out;
          } catch {
            next[name] = src;
          }
        }),
      );
      if (!cancelled) setTinted(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [kitHex, shirtAccent]);

  const assetUrl = (name: string) => tinted?.[name] ?? `${ASSET_BASE}/${name}.png`;
  const miss = state === "miss" ? MISS_REACTIONS[missIdx]! : null;
  const groupKey = miss ? miss.key : GROUP_OF[state];
  const animClass = miss ? miss.anim : pose.anim;
  const ballVisible = showBall && state !== "walk" && state !== "sent-off" && state !== "clap-off";
  const numberLabel = shirtNumber != null && String(shirtNumber).trim() ? String(shirtNumber) : null;

  if (!ready) return <div className={className} aria-hidden />;

  return (
    <div
      className={`m3d${className ? ` ${className}` : ""}`}
      data-state={state}
      data-facing={facing}
      role="img"
      aria-label={label ?? `Rugby player, ${state}`}
    >
      <div className={`m3d-figure ${animClass}`}>
        {GROUPS.map((g) => {
          const frames = g.frames;
          return (
            <div key={g.key} className="m3d-group" data-on={g.key === groupKey ? "true" : "false"} aria-hidden>
              {frames ? (
                frames.map((name) => (
                  <div key={name} className="m3d-frame">
                    <img src={assetUrl(name)} alt="" width={896} height={1200} className="m3d-img" draggable={false} />
                  </div>
                ))
              ) : (
                <img
                  src={assetUrl(g.src!)}
                  alt=""
                  width={768}
                  height={1024}
                  className="m3d-img"
                  draggable={false}
                />
              )}
            </div>
          );
        })}
      </div>

      {(shirtName || numberLabel) && (
        <div className="m3d-shirt-print" aria-hidden>
          {numberLabel ? <span className="m3d-shirt-number">{numberLabel}</span> : null}
          {shirtName ? <span className="m3d-shirt-name">{shirtName}</span> : null}
        </div>
      )}

      <div className="m3d-shadow" aria-hidden />

      {ballVisible ? (
        <svg viewBox="0 0 64 40" className="m3d-ball m3d-ball--rugby" aria-hidden>
          <defs>
            <radialGradient id="r365-rugby-ball" cx="0.38" cy="0.32" r="0.78">
              <stop offset="0%" stopColor="#f7ecd8" />
              <stop offset="45%" stopColor="#d4b48a" />
              <stop offset="100%" stopColor="#5c3a1e" />
            </radialGradient>
          </defs>
          <ellipse cx="32" cy="20" rx="30" ry="17" fill="url(#r365-rugby-ball)" stroke="#2b1810" strokeWidth="1.6" />
          <ellipse cx="32" cy="20" rx="11" ry="5.6" fill="none" stroke="#fff8ee" strokeWidth="1.6" />
          <path d="M20 20h24" stroke="#fff8ee" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M25 15.6v8.8M32 14.6v10.8M39 15.6v8.8" stroke="#fff8ee" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  );
}
