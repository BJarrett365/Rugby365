"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicPlayerProfile } from "@/lib/public-player-profile-service";
import type { PublicPlayerRankings } from "@/lib/public-player-rankings-service";
import type { CompareMetric } from "@/lib/player-compare-metrics";
import { PlayerBadge } from "@/components/players/PlayerBadge";

const TABS = [
  { id: "general", label: "General" },
  { id: "attack", label: "Attack" },
  { id: "defence", label: "Defence" },
  { id: "kicking", label: "Kicking" },
  { id: "discipline", label: "Discipline" },
  { id: "career", label: "Career" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatMetric(value: number | null, key: string): string {
  if (value == null) return "—";
  if (key === "market") {
    if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1000) return `£${Math.round(value / 1000)}k`;
    return `£${Math.round(value)}`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function CompareBar({
  metricKey,
  label,
  a,
  b,
  higherIsBetter = true,
}: {
  metricKey: string;
  label: string;
  a: number | null;
  b: number | null;
  higherIsBetter?: boolean;
}) {
  const max = Math.max(a ?? 0, b ?? 0, 1);
  const aWin =
    a != null && b != null
      ? higherIsBetter
        ? a >= b
        : a <= b
      : a != null;
  const bWin =
    a != null && b != null
      ? higherIsBetter
        ? b > a
        : b < a
      : b != null;

  return (
    <div className="pr-player-compare__row">
      <span className={`pr-player-compare__val${aWin ? " is-lead" : ""}`}>
        {formatMetric(a, metricKey)}
      </span>
      <div className="pr-player-compare__bars">
        <span className="pr-player-compare__label">{label}</span>
        <div className="pr-player-compare__track">
          <span
            className="pr-player-compare__fill pr-player-compare__fill--a"
            style={{ width: `${a != null ? Math.max(6, (a / max) * 100) : 0}%` }}
          />
        </div>
        <div className="pr-player-compare__track">
          <span
            className="pr-player-compare__fill pr-player-compare__fill--b"
            style={{ width: `${b != null ? Math.max(6, (b / max) * 100) : 0}%` }}
          />
        </div>
      </div>
      <span className={`pr-player-compare__val${bWin ? " is-lead" : ""}`}>
        {formatMetric(b, metricKey)}
      </span>
    </div>
  );
}

export function PlayerComparison({
  playerA,
  playerB,
  rankingsA,
  rankingsB,
  metrics,
}: {
  playerA: PublicPlayerProfile;
  playerB: PublicPlayerProfile;
  rankingsA?: PublicPlayerRankings | null;
  rankingsB?: PublicPlayerRankings | null;
  metrics: CompareMetric[];
}) {
  const [tab, setTab] = useState<TabId>("general");
  const filtered = useMemo(() => metrics.filter((m) => m.group === tab), [metrics, tab]);

  return (
    <section className="pr-player-compare">
      <div className="pr-player-compare__heads">
        <div className="pr-player-compare__head">
          <PlayerBadge
            name={playerA.name}
            imageUrl={playerA.badgeImageUrl ?? playerA.imageUrl}
            cutout={Boolean(playerA.badgeImageUrl)}
            rating={playerA.rating.current}
            positionName={playerA.positionName}
            nationName={playerA.nationName}
            nationImageUrl={playerA.internationalTeam?.imageUrl}
            clubName={playerA.club?.name}
            clubImageUrl={playerA.club?.imageUrl}
            age={playerA.age}
            marketValueLabel={playerA.playerValue?.marketValueLabel}
            worldRank={rankingsA?.overallRank ?? playerA.rankings?.overallRank ?? null}
            slug={playerA.slug}
            size="md"
          />
        </div>
        <div className="pr-player-compare__vs" aria-hidden>
          VS
        </div>
        <div className="pr-player-compare__head">
          <PlayerBadge
            name={playerB.name}
            imageUrl={playerB.badgeImageUrl ?? playerB.imageUrl}
            cutout={Boolean(playerB.badgeImageUrl)}
            rating={playerB.rating.current}
            positionName={playerB.positionName}
            nationName={playerB.nationName}
            nationImageUrl={playerB.internationalTeam?.imageUrl}
            clubName={playerB.club?.name}
            clubImageUrl={playerB.club?.imageUrl}
            age={playerB.age}
            marketValueLabel={playerB.playerValue?.marketValueLabel}
            worldRank={rankingsB?.overallRank ?? playerB.rankings?.overallRank ?? null}
            slug={playerB.slug}
            size="md"
          />
        </div>
      </div>

      <nav className="pr-player-compare__tabs" aria-label="Comparison categories">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pr-player-compare__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pr-player-compare__metrics">
        {filtered.map((m) => (
          <CompareBar
            key={m.key}
            metricKey={m.key}
            label={m.label}
            a={m.a}
            b={m.b}
            higherIsBetter={m.higherIsBetter !== false}
          />
        ))}
      </div>

      <footer className="pr-player-compare__summary">
        <div>
          <span>Overall Rating</span>
          <strong>
            {playerA.rating.current ?? "—"} · {playerB.rating.current ?? "—"}
          </strong>
        </div>
        <div>
          <span>Market Value</span>
          <strong>
            {playerA.playerValue?.marketValueLabel ?? "—"} ·{" "}
            {playerB.playerValue?.marketValueLabel ?? "—"}
          </strong>
        </div>
        <div>
          <span>World Rank</span>
          <strong>
            {rankingsA?.overallRank != null ? `#${rankingsA.overallRank}` : "—"} ·{" "}
            {rankingsB?.overallRank != null ? `#${rankingsB.overallRank}` : "—"}
          </strong>
        </div>
        <p className="pr-player-compare__links">
          <Link href={`/players/${playerA.slug}`}>View {playerA.name}</Link>
          <Link href={`/players/${playerB.slug}`}>View {playerB.name}</Link>
        </p>
      </footer>
    </section>
  );
}
