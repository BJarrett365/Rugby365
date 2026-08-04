"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { LineupPitchField } from "@/components/matches/LineupPitchField";
import { LineupPitchJersey } from "@/components/matches/LineupPitchJersey";
import { RugbyShirtSvg } from "@/components/shirts/RugbyShirtSvg";
import { teamAccentColor } from "@/lib/team-accent-color";
import type { ShirtSvgConfig } from "@/lib/shirt-library-types";
import type { TotwPublicPlayer } from "@/lib/team-of-week-public";

/** Same XV slots as Match Centre lineups (pack at top, full-back at bottom). */
const PITCH_SLOTS: Record<number, { top: string; left: string }> = {
  1: { top: "8%", left: "28%" },
  2: { top: "8%", left: "50%" },
  3: { top: "8%", left: "72%" },
  4: { top: "20%", left: "38%" },
  5: { top: "20%", left: "62%" },
  6: { top: "32%", left: "22%" },
  8: { top: "32%", left: "50%" },
  7: { top: "32%", left: "78%" },
  9: { top: "46%", left: "50%" },
  10: { top: "56%", left: "50%" },
  12: { top: "68%", left: "38%" },
  13: { top: "68%", left: "62%" },
  11: { top: "82%", left: "18%" },
  15: { top: "86%", left: "50%" },
  14: { top: "82%", left: "82%" },
};

function pitchSurname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  const particles = new Set(["van", "von", "de", "del", "da", "di", "le", "la", "du", "st", "der"]);
  if (parts.length >= 3 && particles.has(parts[parts.length - 2]!.toLowerCase())) {
    const short = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    return short.length > 12 ? parts[parts.length - 1]! : short;
  }
  const last = parts[parts.length - 1]!;
  return last.length > 11 ? `${last.slice(0, 10)}…` : last;
}

function jerseyVariant(teamName: string): "home" | "away" {
  let hash = 0;
  const key = teamName.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % 2 === 0 ? "home" : "away";
}

function asShirtConfig(raw: Record<string, unknown> | null): ShirtSvgConfig | null {
  if (!raw || typeof raw.bodyColour !== "string") return null;
  return {
    bodyColour: raw.bodyColour,
    secondaryColour: (raw.secondaryColour as string | null) ?? null,
    sleeveColour: (raw.sleeveColour as string | null) ?? null,
    collarColour: (raw.collarColour as string | null) ?? null,
    cuffColour: (raw.cuffColour as string | null) ?? null,
    sidePanelColour: (raw.sidePanelColour as string | null) ?? null,
    patternType: String(raw.patternType ?? "PLAIN"),
    patternColour: (raw.patternColour as string | null) ?? null,
    patternSettings: (raw.patternSettings as ShirtSvgConfig["patternSettings"]) ?? {},
    numberColour: String(raw.numberColour ?? "#FFFFFF"),
    numberBorderColour: (raw.numberBorderColour as string | null) ?? null,
    crestEnabled: raw.crestEnabled !== false,
  };
}

export function TeamOfWeekPitch({
  starting,
  potwId,
}: {
  starting: TotwPublicPlayer[];
  potwId: string | null;
}) {
  const byShirt = new Map(
    starting.filter((p) => p.shirtNumber != null).map((p) => [p.shirtNumber!, p]),
  );

  return (
    <section className="pr-lineup-pitch-wrap totw-pitch-wrap">
      <div className="totw-pitch-wrap__label">Team of the Week</div>
      <div
        className="pr-lineup-pitch pr-lineup-pitch--home totw-pitch-mixed"
        aria-label="Team of the Week starting XV on pitch"
      >
        <LineupPitchField />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((shirt) => {
          const player = byShirt.get(shirt);
          const slot = PITCH_SLOTS[shirt];
          if (!player || !slot) return null;

          const libraryShirt = asShirtConfig(player.shirtSvgConfig);
          const accent = teamAccentColor(player.teamName, jerseyVariant(player.teamName));
          const variant = jerseyVariant(player.teamName);
          const isPotw = potwId != null && player.playerId === potwId;

          return (
            <div
              key={`${player.playerId}-${shirt}`}
              className={`pr-lineup-pitch__player${isPotw ? " pr-lineup-pitch__player--potm" : ""}`}
              style={
                {
                  top: slot.top,
                  left: slot.left,
                  ["--pr-lineup-accent" as string]:
                    libraryShirt?.bodyColour ?? accent,
                } as CSSProperties
              }
            >
              {libraryShirt ? (
                <RugbyShirtSvg
                  {...libraryShirt}
                  number={shirt}
                  size={48}
                  className="pr-lineup-pitch__jersey-svg"
                  kitType={player.kitType ?? undefined}
                />
              ) : (
                <LineupPitchJersey number={shirt} accent={accent} variant={variant} />
              )}
              {player.playerSlug ? (
                <Link
                  href={`/players/${player.playerSlug}`}
                  className="pr-lineup-pitch__surname totw-link"
                >
                  {isPotw ? "★ " : ""}
                  {pitchSurname(player.playerName)}
                </Link>
              ) : (
                <span className="pr-lineup-pitch__surname">
                  {isPotw ? "★ " : ""}
                  {pitchSurname(player.playerName)}
                </span>
              )}
              {player.teamSlug ? (
                <Link href={`/teams/${player.teamSlug}`} className="totw-pitch__team totw-link">
                  {player.teamName}
                </Link>
              ) : (
                <span className="totw-pitch__team">{player.teamName}</span>
              )}
              {player.matchRating != null ? (
                <span className="pr-lineup-pitch__rating" title="Match rating">
                  {player.matchRating.toFixed(1)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
