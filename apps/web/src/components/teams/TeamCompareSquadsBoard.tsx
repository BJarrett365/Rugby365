"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { normalizePositionFamily } from "@/lib/player-radar-positions";
import type { TeamPositionBattle, TeamXvSlot } from "@/lib/team-compare-intelligence";
import type { TeamComparePayload } from "@/lib/team-compare-types";
import type { TeamCompareSidePacket, TeamSquadPlayerRow, TeamXvSource } from "@/lib/team-squad-intelligence-types";

type SquadView = "xv" | "bench" | "full";
type SideKey = "a" | "b";

const FORWARD_FAMILIES = new Set([
  "loosehead_prop",
  "hooker",
  "tighthead_prop",
  "lock",
  "blindside_flanker",
  "openside_flanker",
  "number_eight",
  "flanker",
  "prop",
]);

const BATTLE_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: "Prop", keys: ["lh", "th"] },
  { label: "Hooker", keys: ["hk"] },
  { label: "Lock", keys: ["lock"] },
  { label: "Flanker", keys: ["blindside", "openside"] },
  { label: "No.8", keys: ["eight"] },
  { label: "Scrum-half", keys: ["nine"] },
  { label: "Fly-half", keys: ["ten"] },
  { label: "Centre", keys: ["centre"] },
  { label: "Wing", keys: ["wing"] },
  { label: "Full-back", keys: ["fifteen"] },
];

const RATING_BUCKETS = [
  { key: "90+", min: 90, max: 200 },
  { key: "80–89", min: 80, max: 89.999 },
  { key: "70–79", min: 70, max: 79.999 },
  { key: "60–69", min: 60, max: 69.999 },
  { key: "<60", min: 0, max: 59.999 },
] as const;

const TEAM_CODES: Record<string, string> = {
  "south africa": "SA",
  "new zealand": "NZ",
  england: "ENG",
  australia: "AUS",
  ireland: "IRE",
  france: "FRA",
  wales: "WAL",
  scotland: "SCO",
  argentina: "ARG",
};

function teamCode(team: TeamCompareSidePacket): string {
  return TEAM_CODES[team.name.trim().toLowerCase()] || (team.shortName || team.name).slice(0, 3).toUpperCase();
}

function formatRating(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(1);
}

function signedDelta(v: number): string {
  const abs = Math.abs(v).toFixed(1);
  return v > 0 ? `+${abs}` : v < 0 ? `-${abs}` : abs;
}

function xvToggleLabel(source: TeamXvSource): string {
  if (source === "last_match") return "Last XV";
  if (source === "modelled") return "Modelled XV";
  return "XV";
}

function benchToggleLabel(source: TeamXvSource, count: number): string {
  if (source === "last_match") return `Last bench (${count})`;
  if (source === "modelled") return `Modelled bench (${count})`;
  return `Bench (${count})`;
}

function fullToggleLabel(side: TeamCompareSidePacket): string {
  if (side.squadScope === "recent_match_squads") {
    return `Recently selected (${side.squad.length})`;
  }
  return "No recent squad";
}

function roleLabel(player: TeamSquadPlayerRow, source: TeamXvSource): string {
  if (source === "last_match" && player.squadRole === "starting") return "Last match XV";
  if (source === "last_match" && player.squadRole === "bench") return "Last match bench";
  if (source === "modelled" && player.squadRole === "starting") return "Modelled XV";
  if (source === "modelled" && player.squadRole === "bench") return "Modelled bench";
  return "Recently selected";
}

function MatchRatingTrend({
  points,
  side,
}: {
  points: TeamSquadPlayerRow["matchRatingHistory"];
  side: SideKey;
}) {
  if (!points.length) {
    return <p className="r365-sq__empty">No performance history available</p>;
  }
  const max = Math.max(10, ...points.map((p) => p.rating));
  return (
    <div className="r365-sq__trend">
      <p className="r365-sq__trend-label">Match rating history</p>
      <ol>
        {points.map((point) => {
          const pct = Math.max(8, Math.min(100, (point.rating / max) * 100));
          const when = point.kickoffAt
            ? new Date(point.kickoffAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : "—";
          return (
            <li key={`${point.fixtureId}-${point.kickoffAt ?? point.rating}`}>
              <span className="r365-sq__trend-bar">
                <i className={`is-${side}`} style={{ height: `${pct}%` }} />
              </span>
              <b>{point.rating.toFixed(1)}</b>
              <small>{when}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function isForward(positionName: string | null | undefined): boolean {
  return FORWARD_FAMILIES.has(normalizePositionFamily(positionName));
}

function packSplit(players: TeamSquadPlayerRow[]) {
  const forwards = players.filter((p) => isForward(p.positionName)).length;
  const backs = players.length - forwards;
  return { total: players.length, forwards, backs };
}

function xvPlayers(slots: TeamXvSlot[]): TeamSquadPlayerRow[] {
  return slots.map((s) => s.player).filter((p): p is TeamSquadPlayerRow => Boolean(p));
}

function benchPlayers(side: TeamCompareSidePacket, xvIds: Set<string>): TeamSquadPlayerRow[] {
  return [...side.squad]
    .filter((p) => p.squadRole === "bench" && !xvIds.has(p.id))
    .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99) || (b.rating ?? 0) - (a.rating ?? 0));
}

function SquadAvatar({ src, name }: { src: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const show = Boolean(src?.trim()) && !failed;
  return (
    <span className="r365-sq__avatar" aria-hidden>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="r365-sq__avatar-fallback">{initial}</span>
      )}
    </span>
  );
}

function listForView(
  view: SquadView,
  slots: TeamXvSlot[],
  side: TeamCompareSidePacket,
): Array<{ jersey: number | null; player: TeamSquadPlayerRow | null; label: string }> {
  if (view === "xv") {
    return slots.map((s) => ({
      jersey: s.jersey,
      player: s.player,
      label: s.label,
    }));
  }
  const xvIds = new Set(xvPlayers(slots).map((p) => p.id));
  if (view === "bench") {
    return benchPlayers(side, xvIds).map((p, i) => ({
      jersey: p.jerseyNumber ?? 16 + i,
      player: p,
      label: p.positionName || "Replacement",
    }));
  }
  return [...side.squad]
    .sort((a, b) => {
      const aj = a.jerseyNumber ?? 99;
      const bj = b.jerseyNumber ?? 99;
      if (aj !== bj) return aj - bj;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })
    .map((p, i) => ({
      jersey: p.jerseyNumber ?? i + 1,
      player: p,
      label: p.positionName || "Squad",
    }));
}

function bucketCounts(players: TeamSquadPlayerRow[]) {
  return RATING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    count: players.filter((p) => {
      const r = p.rating;
      return r != null && r >= bucket.min && r <= bucket.max;
    }).length,
  }));
}

function groupBattles(battles: TeamPositionBattle[]) {
  const byKey = new Map(battles.map((b) => [b.key, b]));
  return BATTLE_GROUPS.map((group) => {
    const rows = group.keys.map((k) => byKey.get(k)).filter((b): b is TeamPositionBattle => Boolean(b));
    const avg = (pick: "ratingA" | "ratingB") => {
      const vals = rows.map((r) => r[pick]).filter((n): n is number => n != null);
      if (!vals.length) return null;
      return Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10;
    };
    return { label: group.label, a: avg("ratingA"), b: avg("ratingB") };
  });
}

function matchMeta(data: TeamComparePayload): { competition: string; when: string } {
  const next = data.headToHead.nextMeeting;
  const last = data.headToHead.lastMeeting;
  const competition = (next?.competitionName || last?.competitionName || "Not available").toUpperCase();
  const iso = next?.date || last?.date;
  if (!iso) return { competition, when: next?.kickoffLabel || "TBC" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { competition, when: next?.kickoffLabel || "TBC" };
  const when = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return { competition, when };
}

export function TeamCompareSquadsBoard({ data }: { data: TeamComparePayload }) {
  const { teamA, teamB, startingXvA, startingXvB, xvSummaryA, xvSummaryB, positionBattles } = data;
  const [viewA, setViewA] = useState<SquadView>("xv");
  const [viewB, setViewB] = useState<SquadView>("xv");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const playersA = xvPlayers(startingXvA);
  const playersB = xvPlayers(startingXvB);
  const splitA = packSplit(playersA.length ? playersA : teamA.squad.slice(0, 15));
  const splitB = packSplit(playersB.length ? playersB : teamB.squad.slice(0, 15));
  const strengthA = teamA.rating.components.squadStrength ?? teamA.rating.overall;
  const strengthB = teamB.rating.components.squadStrength ?? teamB.rating.overall;
  const strengthDelta =
    strengthA != null && strengthB != null ? Math.round((strengthB - strengthA) * 10) / 10 : null;
  const avgA = xvSummaryA.averageRating ?? teamA.squadValue.averageRating;
  const avgB = xvSummaryB.averageRating ?? teamB.squadValue.averageRating;

  const listA = useMemo(() => listForView(viewA, startingXvA, teamA), [viewA, startingXvA, teamA]);
  const listB = useMemo(() => listForView(viewB, startingXvB, teamB), [viewB, startingXvB, teamB]);
  const battles = useMemo(() => groupBattles(positionBattles), [positionBattles]);
  const distA = useMemo(() => bucketCounts(teamA.squad), [teamA.squad]);
  const distB = useMemo(() => bucketCounts(teamB.squad), [teamB.squad]);
  const distMax = Math.max(1, ...distA.map((d) => d.count), ...distB.map((d) => d.count));
  const meta = matchMeta(data);

  const ranked = [...teamA.squad, ...teamB.squad]
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const highest = ranked[0] ?? null;
  const threatPlayer = (() => {
    if (!highest) return ranked[1] ?? null;
    const highestOnA = teamA.squad.some((p) => p.id === highest.id);
    const other = (highestOnA ? teamB.squad : teamA.squad)
      .filter((p) => p.rating != null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    return other ?? null;
  })();

  const selected =
    [...teamA.squad, ...teamB.squad].find((p) => p.id === selectedId) ??
    highest ??
    teamA.squad[0] ??
    null;
  const selectedSide: SideKey = selected && teamB.squad.some((p) => p.id === selected.id) ? "b" : "a";
  const oppositeBattle = positionBattles.find((b) =>
    selectedSide === "a" ? b.playerA?.id === selected?.id : b.playerB?.id === selected?.id,
  );
  const opposite = selectedSide === "a" ? oppositeBattle?.playerB : oppositeBattle?.playerA;

  const highA = distA.filter((d) => d.key === "90+" || d.key === "80–89").reduce((s, d) => s + d.count, 0);
  const highB = distB.filter((d) => d.key === "90+" || d.key === "80–89").reduce((s, d) => s + d.count, 0);
  const depthLine =
    highB > highA
      ? `${teamB.name} have a deeper squad with more high-rated players.`
      : highA > highB
        ? `${teamA.name} have a deeper squad with more high-rated players.`
        : "Both squads have a similar spread of high-rated players.";

  const battleMax = Math.max(
    1,
    ...battles.flatMap((row) => [row.a ?? 0, row.b ?? 0]),
  );

  function renderList(
    side: SideKey,
    team: TeamCompareSidePacket,
    slots: TeamXvSlot[],
    view: SquadView,
    setView: (v: SquadView) => void,
    rows: Array<{ jersey: number | null; player: TeamSquadPlayerRow | null; label: string }>,
    avg: number | null,
    source: TeamXvSource,
  ) {
    const xvIds = new Set(xvPlayers(slots).map((p) => p.id));
    const benchCount = benchPlayers(team, xvIds).length;
    const xvCaption =
      source === "last_match"
        ? `Last match XV · avg ${formatRating(avg)}`
        : source === "modelled"
          ? `Modelled XV · avg ${formatRating(avg)}`
          : "No recent match squad";
    return (
      <article className={`r365-sq__card r365-sq__xv is-${side}`}>
        <header className="r365-sq__xv-head">
          <div className="r365-sq__xv-title">
            <TeamCrest name={team.name} imageUrl={team.imageUrl} size="sm" labelled />
            <div>
              <h3>{team.name}</h3>
              <p>{xvCaption}</p>
            </div>
          </div>
          <div className="r365-sq__toggles" role="tablist" aria-label={`${team.name} squad view`}>
            {(
              [
                ["xv", xvToggleLabel(source)],
                ["bench", benchToggleLabel(source, benchCount)],
                ["full", fullToggleLabel(team)],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                className={view === id ? "is-active" : undefined}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="r365-sq__list-head">
          <span>Player</span>
          <span>vs XV Avg</span>
          <span>Rating</span>
        </div>
        {team.squadScope !== "recent_match_squads" && view !== "xv" ? (
          <p className="r365-sq__empty">No recent match squads available.</p>
        ) : rows.length === 0 ? (
          <p className="r365-sq__empty">No players to display.</p>
        ) : (
        <ol className="r365-sq__list">
          {rows.map((row, i) => {
            const p = row.player;
            const gap =
              p?.rating != null && avg != null ? Math.round((p.rating - avg) * 10) / 10 : null;
            const active = p?.id === selected?.id;
            return (
              <li key={p?.id ?? `${side}-${row.jersey ?? i}`}>
                <button
                  type="button"
                  className={`r365-sq__row${active ? " is-active" : ""}`}
                  disabled={!p}
                  onClick={() => p && setSelectedId(p.id)}
                >
                  <em>{row.jersey ?? i + 1}</em>
                  <SquadAvatar src={p?.imageUrl} name={p?.name ?? row.label} />
                  <span className="r365-sq__who">
                    {p ? (
                      <Link href={`/players/${p.slug}`} onClick={(e) => e.stopPropagation()}>
                        {p.name}
                      </Link>
                    ) : (
                      <span>Vacant</span>
                    )}
                    <small>{(p?.positionName || row.label).toUpperCase()}</small>
                  </span>
                  <span
                    className={`r365-sq__gap${
                      gap == null ? "" : gap > 0 ? " is-up" : gap < 0 ? " is-down" : ""
                    }`}
                  >
                    {gap == null ? "—" : (
                      <>
                        <i aria-hidden>{gap > 0 ? "▲" : gap < 0 ? "▼" : "●"}</i>
                        {signedDelta(gap)}
                      </>
                    )}
                  </span>
                  <b className={`r365-sq__rating is-${side}`}>
                    {p?.rating != null ? formatRating(p.rating) : "—"}
                  </b>
                </button>
              </li>
            );
          })}
        </ol>
        )}
      </article>
    );
  }

  return (
    <div className="r365-sq">
      <header className="r365-sq__pagehead">
        <div>
          <h2>
            {teamA.name} vs {teamB.name}
          </h2>
          <p>Squad Comparison &amp; Player Analysis</p>
        </div>
        <div className="r365-sq__matchmeta">
          <span>{meta.competition}</span>
          <strong>{meta.when}</strong>
        </div>
      </header>

      <div className="r365-sq__summary">
        <TeamStrengthCard
          team={teamA}
          side="a"
          strength={strengthA}
          split={splitA}
          xvValue={xvSummaryA.valueLabel || teamA.squadValue.startingXvValueLabel}
          avg={avgA}
          source={xvSummaryA.source}
        />
        <article className="r365-sq__card r365-sq__h2h">
          <h3>Head to Head</h3>
          <p className="r365-sq__h2h-delta">
            {strengthDelta == null
              ? "—"
              : strengthDelta === 0
                ? "Level"
                : strengthDelta > 0
                  ? `${teamCode(teamB)} +${strengthDelta.toFixed(1)}`
                  : `${teamCode(teamA)} +${Math.abs(strengthDelta).toFixed(1)}`}
          </p>
          <p className="r365-sq__h2h-note">Squad strength gap</p>
          <p className="r365-sq__h2h-score">
            Positions {data.positionScore.a}–{data.positionScore.b}
            {data.positionScore.draws ? ` · ${data.positionScore.draws} drawn` : ""}
          </p>
        </article>
        <TeamStrengthCard
          team={teamB}
          side="b"
          strength={strengthB}
          split={splitB}
          xvValue={xvSummaryB.valueLabel || teamB.squadValue.startingXvValueLabel}
          avg={avgB}
          source={xvSummaryB.source}
        />
        <article className="r365-sq__card r365-sq__keys">
          <h3>Key players</h3>
          <KeyPlayer label="Highest Rated" player={highest} />
          <KeyPlayer label="Highest Rated (opposition)" player={threatPlayer} />
        </article>
      </div>

      <div className="r365-sq__xvs">
        {renderList("a", teamA, startingXvA, viewA, setViewA, listA, avgA, xvSummaryA.source)}
        {renderList("b", teamB, startingXvB, viewB, setViewB, listB, avgB, xvSummaryB.source)}
      </div>

      <div className="r365-sq__lower">
        <article className="r365-sq__card r365-sq__battles">
          <h3>Position Battle</h3>
          <p className="r365-sq__h2h-note">Highest player rating in the recently selected pool</p>
          <ul>
            {battles.map((row) => {
              const aW = row.a != null ? Math.max(8, (row.a / battleMax) * 100) : 0;
              const bW = row.b != null ? Math.max(8, (row.b / battleMax) * 100) : 0;
              const aLead = row.a != null && (row.b == null || row.a >= row.b);
              const bLead = row.b != null && (row.a == null || row.b > row.a);
              return (
                <li key={row.label}>
                  <span className={`r365-sq__battle-val is-a${aLead ? " is-lead" : ""}`}>
                    {formatRating(row.a)}
                  </span>
                  <span className="r365-sq__battle-track is-a">
                    <i style={{ width: `${aW}%` }} />
                  </span>
                  <span className="r365-sq__battle-label">{row.label}</span>
                  <span className="r365-sq__battle-track is-b">
                    <i style={{ width: `${bW}%` }} />
                  </span>
                  <span className={`r365-sq__battle-val is-b${bLead ? " is-lead" : ""}`}>
                    {formatRating(row.b)}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="r365-sq__card r365-sq__dist">
          <h3>Rating Distribution</h3>
          <div className="r365-sq__hist">
            {[
              [teamA.name, distA, "a"] as const,
              [teamB.name, distB, "b"] as const,
            ].map(([name, dist, side]) => (
              <div key={side}>
                <p className="r365-sq__hist-label">{name}</p>
                <div className="r365-sq__hist-bars">
                  {dist.map((d) => (
                    <div key={`${side}-${d.key}`} className="r365-sq__hist-row">
                      <small>{d.key}</small>
                      <b
                        className={`is-${side}`}
                        style={{ height: `${Math.max(8, (d.count / distMax) * 72)}px` }}
                        title={`${d.count}`}
                      />
                      <em>{d.count}</em>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="r365-sq__insight">{depthLine}</p>
        </article>

        <article className="r365-sq__card r365-sq__player">
          <h3>Player Performance</h3>
          {selected ? (
            <>
              <div className="r365-sq__player-head">
                <SquadAvatar src={selected.imageUrl} name={selected.name} />
                <div>
                  <Link href={`/players/${selected.slug}`}>{selected.name}</Link>
                  <small>
                    {(selected.positionName || "Squad").toUpperCase()} · {selectedSide === "a" ? teamA.name : teamB.name}
                  </small>
                </div>
                <strong className={`is-${selectedSide}`}>{formatRating(selected.rating)}</strong>
              </div>
              <dl className="r365-sq__facts">
                <div>
                  <dt>Age</dt>
                  <dd>{selected.age ?? "—"}</dd>
                </div>
                <div>
                  <dt>Rugby365 est. value</dt>
                  <dd>{selected.marketValueLabel ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{roleLabel(selected, selectedSide === "a" ? xvSummaryA.source : xvSummaryB.source)}</dd>
                </div>
              </dl>
              <ul className="r365-sq__bars">
                {[
                  ["Player rating", selected.rating, 100],
                ].map(([label, value, max]) => {
                  const n = typeof value === "number" ? value : null;
                  const pct = n != null ? Math.max(6, Math.min(100, (n / Number(max)) * 100)) : 0;
                  return (
                    <li key={String(label)}>
                      <span>{label}</span>
                      <span className="r365-sq__bar">
                        <i className={`is-${selectedSide}`} style={{ width: `${pct}%` }} />
                      </span>
                      <b>{formatRating(selected.rating)}</b>
                    </li>
                  );
                })}
              </ul>
              <MatchRatingTrend points={selected.matchRatingHistory} side={selectedSide} />
              {opposite ? (
                <p className="r365-sq__matchup">
                  vs {opposite.name}{" "}
                  <b>{formatRating(opposite.rating)}</b>
                  {opposite.slug && selected.slug ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/players/${selected.slug}/compare/${opposite.slug}`}>
                        Compare
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <p className="r365-sq__empty">Select a player from either XV.</p>
          )}
        </article>
      </div>
    </div>
  );
}

function TeamStrengthCard({
  team,
  side,
  strength,
  split,
  xvValue,
  avg,
  source,
}: {
  team: TeamCompareSidePacket;
  side: SideKey;
  strength: number | null;
  split: { total: number; forwards: number; backs: number };
  xvValue: string | null | undefined;
  avg: number | null;
  source: TeamXvSource;
}) {
  const fwdPct = split.total ? (split.forwards / split.total) * 100 : 50;
  const valueCaption = xvValue ? `${xvValue} est.` : "—";
  return (
    <article className={`r365-sq__card r365-sq__strength is-${side}`}>
      <div className="r365-sq__strength-head">
        <TeamCrest name={team.name} imageUrl={team.imageUrl} size="md" labelled />
        <div>
          <h3>{team.name}</h3>
          <p>
            Avg {formatRating(avg)} · {valueCaption}
          </p>
        </div>
      </div>
      <p className="r365-sq__strength-label">Squad Strength</p>
      <p className={`r365-sq__strength-score is-${side}`}>{formatRating(strength)}</p>
      <div className="r365-sq__split" aria-label={`${split.forwards} forwards, ${split.backs} backs`}>
        <span style={{ width: `${fwdPct}%` }} />
      </div>
      <p className="r365-sq__split-meta">
        {source === "last_match" ? "Last match XV" : source === "modelled" ? "Modelled XV" : "No XV"} ·{" "}
        {split.forwards} Forwards · {split.backs} Backs
      </p>
    </article>
  );
}

function KeyPlayer({
  label,
  player,
}: {
  label: string;
  player: TeamSquadPlayerRow | null;
}) {
  if (!player) {
    return (
      <div className="r365-sq__key">
        <span>{label}</span>
        <p className="r365-sq__empty">—</p>
      </div>
    );
  }
  return (
    <div className="r365-sq__key">
      <span>{label}</span>
      <div>
        <SquadAvatar src={player.imageUrl} name={player.name} />
        <div>
          <Link href={`/players/${player.slug}`}>{player.name}</Link>
          <small>{(player.positionName || "Squad").toUpperCase()}</small>
        </div>
        <b>{formatRating(player.rating)}</b>
      </div>
    </div>
  );
}
