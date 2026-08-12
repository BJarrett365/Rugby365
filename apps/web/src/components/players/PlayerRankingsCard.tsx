"use client";

import Link from "next/link";
import { useState } from "react";
import {
  IconClub,
  IconCompetition,
  IconGlobe,
  IconPositions,
} from "@/components/players/PlayerFactIcons";
import type { PublicPlayerRankings } from "@/lib/public-player-rankings-service";
import type { RankingIconKey, RankingRowPresentation, RankingTabId } from "@/lib/player-ranking-engine";

const TABS: Array<{ id: RankingTabId; label: string }> = [
  { id: "global", label: "Global" },
  { id: "national", label: "National" },
  { id: "position", label: "Position" },
  { id: "competition", label: "Competition" },
];

function RankingIcon({ icon }: { icon: RankingIconKey }) {
  switch (icon) {
    case "nation":
      return <IconGlobe className="pr-player-v2__rank-ico" />;
    case "position":
      return <IconPositions className="pr-player-v2__rank-ico" />;
    case "competition":
      return <IconCompetition className="pr-player-v2__rank-ico" />;
    case "age":
      return <IconClub className="pr-player-v2__rank-ico" />;
    case "attack":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 20L14 4l6 2-4 6 4 8H4z" />
        </svg>
      );
    case "playmaking":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M16.5 5.5l2-2M5.5 18.5l2-2" />
        </svg>
      );
    case "kicking":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 16c3-1 6-6 8-10l3 2c-1 4-3 8-6 11H4z" />
          <path d="M14 6l6 3" />
        </svg>
      );
    case "defence":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
        </svg>
      );
    case "form":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 16l5-5 4 3 7-9" />
        </svg>
      );
    case "potential":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l2.2 6.5H21l-5.4 4 2.1 6.5L12 16.5 6.3 20l2.1-6.5L3 9.5h6.8L12 3z" />
        </svg>
      );
    case "value":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9.5c0-1 1.2-2 3-2s3 1 3 2-1.2 2-3 2-3 1-3 2 1.2 2 3 2 3-1 3-2" />
        </svg>
      );
    case "management":
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case "player":
    default:
      return (
        <svg className="pr-player-v2__rank-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-4 4-6 7-6s5.5 2 7 6" />
        </svg>
      );
  }
}

function RankingRows({ rows }: { rows: RankingRowPresentation[] }) {
  return (
    <ul className="pr-player-v2__rank-list">
      {rows.map((row) => (
        <li key={`${row.metricKey}-${row.label}`}>
          <Link className="pr-player-v2__rank-row" href={row.href} title={row.title}>
            <span className="pr-player-v2__rank-icon" aria-hidden>
              <RankingIcon icon={row.icon} />
            </span>
            <span className="pr-player-v2__rank-row-label">{row.label}</span>
            <span
              className={`pr-player-v2__rank-num${row.status === "pending" ? " is-pending" : ""}${row.provisional && row.status !== "pending" ? " is-provisional" : ""}`}
            >
              {row.rankDisplay}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PlayerRankingsCard({ rankings }: { rankings: PublicPlayerRankings | null }) {
  const [tab, setTab] = useState<RankingTabId>("global");

  if (!rankings) {
    return (
      <div className="pr-player-v2__card">
        <div className="pr-player-v2__card-head">
          <h2>Player Rankings</h2>
          <Link className="pr-player-v2__card-link" href="/rankings/players">
            View all &gt;
          </Link>
        </div>
        <p className="pr-player-v2__empty">Not enough rated data yet to calculate rankings.</p>
      </div>
    );
  }

  const rows = rankings.tabs?.[tab] ?? [];
  const building = rankings.competitionBuilding;
  const showBuilding = tab === "competition" && rows.length === 0;

  return (
    <div className="pr-player-v2__card">
      <div className="pr-player-v2__card-head">
        <h2>Player Rankings</h2>
        <Link className="pr-player-v2__card-link" href="/rankings/players">
          View all &gt;
        </Link>
      </div>
      <div className="pr-player-v2__tabs" role="tablist" aria-label="Ranking scope">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`pr-player-v2__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showBuilding ? (
        <div className="pr-player-v2__rank-building">
          <p className="pr-player-v2__rank-building-kicker">
            {building?.headline ?? "RANKINGS BUILDING"}
          </p>
          <p className="pr-player-v2__rank-building-reason">
            {building?.reason ?? "Not enough eligible players in this competition cohort yet."}
          </p>
          {building ? (
            <p className="pr-player-v2__rank-building-meta">
              Eligible linked: {building.eligiblePlayers} · With ≥{building.minMatches} matches:{" "}
              {building.eligibleWithMinMatches} · Preferred pool: {building.preferredPool}+
            </p>
          ) : null}
          <Link className="pr-player-v2__card-link" href="/rankings/players?scope=global&metric=overall">
            View Global Rankings &gt;
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="pr-player-v2__rank-building">
          <p className="pr-player-v2__rank-building-kicker">RANKINGS BUILDING</p>
          <p className="pr-player-v2__rank-building-reason">
            Not enough eligible players for this scope yet.
          </p>
          <Link className="pr-player-v2__card-link" href="/rankings/players?scope=global&metric=overall">
            View Global Rankings &gt;
          </Link>
        </div>
      ) : (
        <RankingRows rows={rows} />
      )}
    </div>
  );
}
