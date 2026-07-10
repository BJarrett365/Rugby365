"use client";

import Link from "next/link";
import type { RefereeCardEvent, RefereeFixtureRow } from "@/lib/referee-admin-service";

function formatKickoff(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  fixtures: RefereeFixtureRow[];
  yellowCards: RefereeCardEvent[];
  redCards: RefereeCardEvent[];
  stats: {
    matchCount: number;
    yellowCardCount: number;
    redCardCount: number;
    nameOnlyMatchCount: number;
  };
  onLinkNameOnly?: () => void;
  linking?: boolean;
};

function CardTable({ cards, tone }: { cards: RefereeCardEvent[]; tone: "yellow" | "red" }) {
  const headerClass = tone === "yellow" ? "text-amber-300" : "text-red-400";
  const badgeClass =
    tone === "yellow"
      ? "bg-amber-500/15 text-amber-300 border-amber-700/50"
      : "bg-red-500/15 text-red-300 border-red-700/50";

  return (
    <div className="cms-card overflow-x-auto">
      <div className="flex items-center gap-2 mb-3">
        <h3 className={`font-semibold m-0 ${headerClass}`}>
          {tone === "yellow" ? "Yellow cards" : "Red cards"}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded border ${badgeClass}`}>{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">No {tone} cards recorded in linked fixtures.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Fixture</th>
              <th className="py-2 pr-3">Min</th>
              <th className="py-2 pr-3">Player</th>
              <th className="py-2 pr-3">Team</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id} className="border-b border-zinc-800/60">
                <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                  {formatKickoff(card.kickoffAt)}
                </td>
                <td className="py-2 pr-3">
                  <Link href={`/admin/matches/${card.fixtureId}/edit`} className="text-emerald-400">
                    {card.fixtureLabel ?? "Fixture"}
                  </Link>
                </td>
                <td className="py-2 pr-3 font-mono text-zinc-300">{card.minute}&apos;</td>
                <td className="py-2 pr-3 text-zinc-300">{card.playerName ?? "—"}</td>
                <td className="py-2 pr-3 text-zinc-500">{card.teamName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function RefereeFixturesPanel({
  fixtures,
  yellowCards,
  redCards,
  stats,
  onLinkNameOnly,
  linking,
}: Props) {
  return (
    <div className="space-y-4 mb-4">
      <div className="cms-card overflow-x-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
          <div>
            <h3 className="font-semibold m-0">Fixtures officiated</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-0">
              {stats.matchCount} match{stats.matchCount === 1 ? "" : "es"} · {stats.yellowCardCount}{" "}
              yellow · {stats.redCardCount} red
              {stats.nameOnlyMatchCount > 0
                ? ` · ${stats.nameOnlyMatchCount} linked by name only`
                : null}
            </p>
          </div>
          {stats.nameOnlyMatchCount > 0 && onLinkNameOnly ? (
            <button
              type="button"
              disabled={linking}
              onClick={onLinkNameOnly}
              className="cms-btn cms-btn--secondary text-xs shrink-0"
            >
              {linking ? "Linking…" : `Link ${stats.nameOnlyMatchCount} name-only fixture(s)`}
            </button>
          ) : null}
        </div>
        {fixtures.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">
            No fixtures linked yet. Use &quot;Map from matches&quot; on the referees list or assign
            this referee on a match.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3 text-amber-300">Y</th>
                <th className="py-2 pr-3 text-red-400">R</th>
                <th className="py-2 pr-3">Link</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {fixtures.map((fixture) => (
                <tr key={fixture.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                    {formatKickoff(fixture.kickoffAt)}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-zinc-300">
                      {fixture.homeTeamName ?? "TBC"} vs {fixture.awayTeamName ?? "TBC"}
                    </span>
                    {fixture.competitionName ? (
                      <span className="block text-xs text-zinc-600">{fixture.competitionName}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {fixture.homeScore}–{fixture.awayScore}
                  </td>
                  <td className="py-2 pr-3 font-mono text-amber-300">{fixture.yellowCount}</td>
                  <td className="py-2 pr-3 font-mono text-red-400">{fixture.redCount}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">
                    {fixture.linkedBy === "referee_name" ? "Name" : "ID"}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/matches/${fixture.id}/edit`}
                      className="text-emerald-400 text-xs"
                    >
                      Edit match
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CardTable cards={yellowCards} tone="yellow" />
      <CardTable cards={redCards} tone="red" />
    </div>
  );
}
