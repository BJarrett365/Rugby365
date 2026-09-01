"use client";

import { FormDots } from "@/components/competitions/FormDots";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { rankingCountryFlagUrl } from "@/lib/player-ranking-engine";
import type {
  RugbyTableHemisphereGroup,
  RugbyTablePoolGroup,
  RugbyTableStandingRow,
} from "@/lib/table-lab/table-types";

function movementArrow(movement: RugbyTableStandingRow["movement"]): string {
  if (movement === "up") return "▲";
  if (movement === "down") return "▼";
  if (movement === "same") return "–";
  return "";
}

function isLiveRow(row: RugbyTableStandingRow): boolean {
  // Require an explicit in-play status — do not treat leftover score labels alone as live.
  if (!row.liveStatus) return false;
  const status = row.liveStatus.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    status === "live" ||
    status === "in_progress" ||
    status === "first_half" ||
    status === "second_half" ||
    status === "ht" ||
    status === "half_time" ||
    status === "halftime" ||
    Boolean(row.liveCurrentScore && row.liveMatchLabel)
  );
}

function LiveScoreBadge({ row }: { row: RugbyTableStandingRow }) {
  if (!row.liveCurrentScore) return null;
  const [forScore, againstScore] = row.liveCurrentScore.split(/[-–:]/).map((part) => part.trim());
  const forNum = Number(forScore);
  const againstNum = Number(againstScore);
  const winning =
    Number.isFinite(forNum) && Number.isFinite(againstNum) ? forNum > againstNum : null;
  const tone =
    winning === true ? "live-table__badge--win" : winning === false ? "live-table__badge--lose" : "";

  return (
    <span className={`live-table__badge ${tone}`} title={row.liveMatchLabel ?? "Live score"}>
      {row.liveCurrentScore.replace("-", ":").replace("–", ":")}
    </span>
  );
}

function StandingsTable({
  title,
  rows,
  showMovement,
  formSlots,
}: {
  title?: string;
  rows: RugbyTableStandingRow[];
  showMovement: boolean;
  formSlots?: number;
}) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500 m-0">No standings rows yet.</p>;
  }

  return (
    <div className="live-table__card">
      {title ? <h3 className="live-table__title">{title}</h3> : null}
      <div className="live-table__wrap">
        <table className="live-table__table">
          <thead>
            <tr>
              <th scope="col">#</th>
              {showMovement ? <th scope="col" aria-label="Movement" /> : null}
              <th scope="col">Team</th>
              <th scope="col">Form</th>
              <th scope="col">P</th>
              <th scope="col">W</th>
              <th scope="col">D</th>
              <th scope="col">L</th>
              <th scope="col">PD</th>
              <th scope="col">BP</th>
              <th scope="col">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const live = isLiveRow(row);
              return (
                <tr
                  key={row.teamId}
                  className={live ? "live-table__row--live" : undefined}
                  data-live={live ? "true" : undefined}
                >
                  <td className="live-table__rank">{row.rank}</td>
                  {showMovement ? (
                    <td
                      className={`live-table__move live-table__move--${row.movement ?? "same"}`}
                      title={row.movementLabel ?? row.movement ?? undefined}
                    >
                      {movementArrow(row.movement)}
                    </td>
                  ) : null}
                  <td className="live-table__team">
                    <TeamCrest
                      name={row.teamName}
                      imageUrl={row.teamImageUrl || rankingCountryFlagUrl(row.teamName)}
                      size="xs"
                    />
                    <span className="live-table__team-name">{row.teamName}</span>
                    <LiveScoreBadge row={row} />
                    {row.liveMatchClock ? (
                      <span className="live-table__clock">{row.liveMatchClock}</span>
                    ) : null}
                  </td>
                  <td>
                    <FormDots sequence={row.formSequence ?? []} slots={formSlots ?? 5} pad />
                  </td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.drawn}</td>
                  <td>{row.lost}</td>
                  <td>
                    {row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                  </td>
                  <td>{row.bonusPoints}</td>
                  <td className="live-table__pts">{row.leaguePoints}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompetitionLiveTable({
  rows,
  hemisphereGroups,
  poolGroups,
  showMovement = true,
  liveMatchCount,
  note,
  formSlots,
}: {
  rows: RugbyTableStandingRow[];
  hemisphereGroups?: RugbyTableHemisphereGroup[];
  poolGroups?: RugbyTablePoolGroup[];
  showMovement?: boolean;
  liveMatchCount?: number | null;
  note?: string | null;
  formSlots?: number;
}) {
  const liveRows = rows.filter(isLiveRow);
  const liveMatchCards = (() => {
    const seen = new Set<string>();
    const cards: Array<{ key: string; title: string; score: string; clock: string }> = [];
    for (const row of liveRows) {
      const key = row.liveMatchLabel ?? `${row.teamId}:${row.liveCurrentScore ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const opponent =
        row.liveMatchLabel?.replace(/^vs\s+/i, "").replace(/\s+\d+[-–:]\d+\s*$/, "").trim() ||
        "Opponent";
      cards.push({
        key,
        title: `${row.teamName} vs ${opponent}`,
        score: row.liveCurrentScore ?? "–",
        clock: row.liveMatchClock ?? row.liveStatus ?? "In play",
      });
    }
    return cards;
  })();

  return (
    <div className="live-table">
      {liveMatchCards.length > 0 ? (
        <div className="live-table__live-strip" aria-live="polite">
          <span className="live-table__live-pill">Live</span>
          <div className="live-table__live-matches">
            {liveMatchCards.map((match) => (
              <div key={match.key} className="live-table__live-match">
                <strong>{match.title}</strong>
                <span>{match.score.replace("-", " : ").replace("–", " : ")}</span>
                <span className="live-table__live-meta">{match.clock}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(liveMatchCount ?? 0) > 0 ? (
        <p className="live-table__note">
          {note ? `${note} · ` : ""}
          {liveMatchCount} live match{liveMatchCount === 1 ? "" : "es"}
        </p>
      ) : null}

      {poolGroups && poolGroups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {poolGroups.map((group) => (
            <StandingsTable
              key={group.id}
              title={group.label}
              rows={group.rows}
              showMovement={false}
              formSlots={group.formSlots}
            />
          ))}
        </div>
      ) : hemisphereGroups && hemisphereGroups.length > 0 ? (
        <div className="space-y-4">
          <StandingsTable
            title="Full table"
            rows={rows}
            showMovement={showMovement}
            formSlots={formSlots}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {hemisphereGroups.map((group) => (
              <StandingsTable
                key={group.hemisphere}
                title={group.label}
                rows={group.rows}
                showMovement={showMovement}
                formSlots={formSlots}
              />
            ))}
          </div>
        </div>
      ) : (
        <StandingsTable rows={rows} showMovement={showMovement} formSlots={formSlots} />
      )}
    </div>
  );
}
