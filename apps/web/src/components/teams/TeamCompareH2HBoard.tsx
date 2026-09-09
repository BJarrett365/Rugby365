"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TeamComparePayload, TeamH2HTopPerformer } from "@/lib/team-compare-types";
import type { TeamCompareSidePacket } from "@/lib/team-squad-intelligence-types";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { TeamCompareSquadsBoard } from "@/components/teams/TeamCompareSquadsBoard";

type CompareTab = "overview" | "h2h" | "stats" | "squads" | "fixtures" | "news";

const COMPARE_TABS: Array<{ id: CompareTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "h2h", label: "Head-to-Head" },
  { id: "stats", label: "Stats" },
  { id: "squads", label: "Squads" },
  { id: "fixtures", label: "Fixtures" },
  { id: "news", label: "News" },
];

/** Mockup-style nicknames for internationals. */
const NICKNAMES: Record<string, string> = {
  "south africa": "Springboks",
  england: "England",
  "new zealand": "All Blacks",
  australia: "Wallabies",
  ireland: "Ireland",
  france: "France",
  wales: "Wales",
  scotland: "Scotland",
  argentina: "Los Pumas",
  italy: "Italy",
  japan: "Japan",
  fiji: "Fiji",
};

function nickname(team: TeamCompareSidePacket): string {
  const key = team.name.trim().toLowerCase();
  return (NICKNAMES[key] || team.shortName || team.name).toUpperCase();
}

function countryLine(team: TeamCompareSidePacket): string {
  return (team.countryName || team.name).toUpperCase();
}

function PerformerAvatar({ src, name }: { src: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const showImg = Boolean(src?.trim()) && !failed;
  return (
    <span className="r365-h2h__performer-avatar" aria-hidden>
      {showImg ? (
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
        <span className="r365-h2h__performer-avatar-fallback">{initial}</span>
      )}
    </span>
  );
}

/** Genuine H2H stat rows only — never pad with ratings. */
function performerRows(rows: TeamH2HTopPerformer[]): TeamH2HTopPerformer[] {
  return rows.filter((row) => row.playerId || row.name);
}

function code(team: TeamCompareSidePacket): string {
  const map: Record<string, string> = {
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
  return map[team.name.trim().toLowerCase()] || (team.shortName || team.name.slice(0, 3)).toUpperCase();
}

function formatDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

function formatRating(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(1);
}

function shortCompetition(name: string | null): string {
  if (!name) return "—";
  let s = name
    .replace(/^Castle Double Malt\s+/i, "")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // Prefer short familiar labels used in the mockup.
  if (/nations?\s*championship/i.test(s)) return "Nations";
  if (/rugby\s*championship/i.test(s)) return "Rugby Champ";
  if (/rugby.?s?\s*greatest\s*rivalry/i.test(s)) return "Rivalry";
  if (/tri[\s-]?nations/i.test(s)) return "Tri-Nations";
  if (/world\s*cup/i.test(s)) return "World Cup";
  if (s.length > 14) s = `${s.slice(0, 12).trimEnd()}…`;
  return s;
}

function shortVenue(venue: string | null): string {
  if (!venue) return "—";
  let trimmed = venue.trim();
  if (trimmed.includes(",")) {
    trimmed = trimmed.split(",")[0]!.trim() || trimmed;
  }
  // Betting/title sponsors only — keep brand stadium names (FNB Stadium, Sky Stadium).
  trimmed = trimmed.replace(/^(10bet|Betway|Hollywoodbets)\s+/i, "");
  // Prefer city when stadium name is long (mockup shows cities for meetings).
  const cityHints: Array<[RegExp, string]> = [
    [/auckland|eden\s*park|north\s*harbour/i, "Auckland"],
    [/cape\s*town/i, "Cape Town"],
    [/durban|kings\s*park|hollywoodbets\s*kings/i, "Durban"],
    [/johannesburg|ellis\s*park|fnb/i, "Joburg"],
    [/wellington|sky\s*stadium/i, "Wellington"],
    [/sydney|allianz/i, "Sydney"],
    [/brisbane|suncorp/i, "Brisbane"],
    [/melbourne/i, "Melbourne"],
    [/perth/i, "Perth"],
    [/london|twickenham/i, "London"],
    [/paris|stade\s*de\s*france/i, "Paris"],
  ];
  for (const [re, city] of cityHints) {
    if (re.test(trimmed) || re.test(venue)) return city;
  }
  // "Cape Town Stadium Cape Town" -> "Cape Town Stadium"
  const parts = trimmed.split(/\s+/);
  for (let n = 2; n >= 1; n--) {
    if (parts.length <= n + 1) continue;
    const tail = parts.slice(-n).join(" ");
    const head = parts.slice(0, -n).join(" ");
    if (head.toLowerCase().startsWith(`${tail.toLowerCase()} `)) {
      trimmed = head;
      break;
    }
  }
  if (trimmed.length > 18) trimmed = `${trimmed.slice(0, 16).trimEnd()}…`;
  return trimmed || "—";
}

function shortMeetingDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2 || name.length <= 18) return name;
  const last = parts[parts.length - 1]!;
  const particle = parts[parts.length - 2];
  if (particle && /^(van|von|de|du|da|di|la|le|st\.?)$/i.test(particle)) {
    return `${parts[0]![0]}. ${particle} ${last}`;
  }
  return `${parts[0]![0]}. ${last}`;
}

function shortPerformerLabel(label: string): string {
  let s = label
    .replace(/\s*[·\-–|]\s*rating$/i, "")
    .replace(/\s+rating$/i, "")
    .trim();
  s = s
    .replace(/^first five(-|\s)?eighth$/i, "Fly-half")
    .replace(/^fly[- ]?half$/i, "Fly-half")
    .replace(/^blindside flanker$/i, "Blindside")
    .replace(/^openside flanker$/i, "Openside")
    .replace(/^outside centre$/i, "Outside C")
    .replace(/^inside centre$/i, "Inside C")
    .replace(/^loosehead prop$/i, "LH Prop")
    .replace(/^tighthead prop$/i, "TH Prop")
    .replace(/^replacement$/i, "Bench")
    .replace(/^hooker$/i, "Hooker")
    .replace(/^scrum[- ]?half$/i, "Scrum-half")
    .replace(/^lineouts? won$/i, "Lineouts")
    .replace(/^conversions?$/i, "Cons")
    .replace(/^penalties$/i, "Pens")
    .replace(/^drop goals?$/i, "Drops");
  if (s.length > 12) s = `${s.slice(0, 11).trimEnd()}…`;
  return s || "Stat";
}

function isTeamASide(teamName: string, teamA: TeamCompareSidePacket): boolean {
  const n = teamName.trim().toLowerCase();
  const a = teamA.name.trim().toLowerCase();
  return n === a || n.includes(a) || a.includes(n) || n === nickname(teamA).toLowerCase();
}

function kickoffParts(iso: string | null, fallback: string | null): { date: string; time: string | null } {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return {
        date: d.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }),
      };
    }
  }
  return { date: fallback || "TBC", time: null };
}

function formEyebrow(results: Array<"W" | "D" | "L">): string {
  const n = results.length;
  if (n <= 0) return "Current Form";
  if (n >= 10) return "Current Form (Last 10)";
  return `Current Form (Last ${n})`;
}

function benchAverageRating(team: TeamCompareSidePacket): number | null {
  const bench = team.squad.filter((p) => p.squadRole === "bench" && p.rating != null);
  if (!bench.length) {
    const fallback = team.squad.filter((p) => p.squadRole !== "starting" && p.rating != null);
    if (!fallback.length) return null;
    return fallback.reduce((s, p) => s + (p.rating ?? 0), 0) / fallback.length;
  }
  return bench.reduce((s, p) => s + (p.rating ?? 0), 0) / bench.length;
}

function FormBoxes({ results }: { results: Array<"W" | "D" | "L"> }) {
  const last = results.slice(0, 10);
  if (last.length === 0) {
    return <p className="r365-h2h__muted">No recent form yet.</p>;
  }
  return (
    <div
      className="r365-h2h__form-boxes"
      aria-label={last.length >= 10 ? "Last 10 results" : `Last ${last.length} results`}
    >
      {last.map((r, i) => (
        <span key={`${r}-${i}`} className={`r365-h2h__form-box is-${r.toLowerCase()}`}>
          {r}
        </span>
      ))}
    </div>
  );
}

function WinsChart({
  points,
  codeA,
  codeB,
}: {
  points: TeamComparePayload["headToHead"]["winsOverTime"];
  codeA: string;
  codeB: string;
}) {
  if (points.length < 2) {
    return <p className="r365-h2h__muted">Not enough meetings for a wins chart yet.</p>;
  }
  const w = 460;
  const h = 200;
  const padL = 34;
  const padR = 18;
  const padT = 16;
  const padB = 30;
  const maxWins = Math.max(
    1,
    ...points.map((p) => Math.max(p.cumulativeWinsA, p.cumulativeWinsB)),
  );
  const minYear = points[0]!.year;
  const maxYear = points[points.length - 1]!.year;
  const xSpan = Math.max(1, maxYear - minYear);
  const x = (year: number) => padL + ((year - minYear) / xSpan) * (w - padL - padR);
  const y = (wins: number) => padT + (1 - wins / maxWins) * (h - padT - padB);
  const path = (key: "cumulativeWinsA" | "cumulativeWinsB") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");
  const last = points[points.length - 1]!;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + (1 - t) * (h - padT - padB),
    v: Math.round(maxWins * t),
  }));

  return (
    <div className="r365-h2h__chart">
      <p className="r365-h2h__chart-meta">{points.length} Meetings</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="r365-h2h__chart-svg" role="img" aria-label="Wins over time">
        {grid.map((g) => (
          <g key={g.v}>
            <line x1={padL} x2={w - padR} y1={g.y} y2={g.y} className="r365-h2h__chart-grid" />
            <text x={padL - 6} y={g.y + 3} textAnchor="end" className="r365-h2h__chart-tick">
              {g.v}
            </text>
          </g>
        ))}
        <path d={path("cumulativeWinsA")} className="r365-h2h__chart-line is-a" fill="none" />
        <path d={path("cumulativeWinsB")} className="r365-h2h__chart-line is-b" fill="none" />
        <circle cx={x(last.year)} cy={y(last.cumulativeWinsA)} r="3.5" className="r365-h2h__chart-dot is-a" />
        <circle cx={x(last.year)} cy={y(last.cumulativeWinsB)} r="3.5" className="r365-h2h__chart-dot is-b" />
        <g className="r365-h2h__chart-callout is-a">
          <rect
            x={x(last.year) - 14}
            y={y(last.cumulativeWinsA) - 22}
            width="28"
            height="16"
            rx="3"
          />
          <text x={x(last.year)} y={y(last.cumulativeWinsA) - 10} textAnchor="middle">
            {last.cumulativeWinsA}
          </text>
        </g>
        <g className="r365-h2h__chart-callout is-b">
          <rect
            x={x(last.year) - 14}
            y={y(last.cumulativeWinsB) - 22}
            width="28"
            height="16"
            rx="3"
          />
          <text x={x(last.year)} y={y(last.cumulativeWinsB) - 10} textAnchor="middle">
            {last.cumulativeWinsB}
          </text>
        </g>
        <text x={padL} y={h - 8} className="r365-h2h__chart-tick">
          {minYear}
        </text>
        <text x={w - padR} y={h - 8} textAnchor="end" className="r365-h2h__chart-tick">
          {maxYear}
        </text>
      </svg>
      <div className="r365-h2h__chart-legend">
        <span className="is-a">
          <i />
          {codeA}
        </span>
        <span className="is-b">
          <i />
          {codeB}
        </span>
      </div>
    </div>
  );
}

function ResultsDonut({
  winsA,
  winsB,
  draws,
  codeA,
  codeB,
}: {
  winsA: number;
  winsB: number;
  draws: number;
  codeA: string;
  codeB: string;
}) {
  const total = Math.max(1, winsA + winsB + draws);
  const pctA = Math.round((winsA / total) * 100);
  const pctB = Math.round((winsB / total) * 100);
  const pctD = Math.max(0, 100 - pctA - pctB);
  const r = 46;
  const c = 2 * Math.PI * r;
  const aLen = (pctA / 100) * c;
  const bLen = (pctB / 100) * c;
  const dLen = (pctD / 100) * c;

  return (
    <div className="r365-h2h__donut-wrap">
      <svg viewBox="0 0 130 130" className="r365-h2h__donut" aria-hidden>
        <circle cx="65" cy="65" r={r} className="r365-h2h__donut-track" />
        <circle
          cx="65"
          cy="65"
          r={r}
          className="r365-h2h__donut-seg is-a"
          strokeDasharray={`${aLen} ${c - aLen}`}
          strokeDashoffset={c * 0.25}
        />
        <circle
          cx="65"
          cy="65"
          r={r}
          className="r365-h2h__donut-seg is-b"
          strokeDasharray={`${bLen} ${c - bLen}`}
          strokeDashoffset={c * 0.25 - aLen}
        />
        <circle
          cx="65"
          cy="65"
          r={r}
          className="r365-h2h__donut-seg is-d"
          strokeDasharray={`${dLen} ${c - dLen}`}
          strokeDashoffset={c * 0.25 - aLen - bLen}
        />
      </svg>
      <ul className="r365-h2h__donut-legend">
        <li>
          <i className="is-a" />
          {codeA} Wins{" "}
          <b>
            {winsA} ({pctA}%)
          </b>
        </li>
        <li>
          <i className="is-b" />
          {codeB} Wins{" "}
          <b>
            {winsB} ({pctB}%)
          </b>
        </li>
        <li>
          <i className="is-d" />
          Draws{" "}
          <b>
            {draws} ({pctD}%)
          </b>
        </li>
      </ul>
    </div>
  );
}

type Row = {
  label: string;
  a: number | null;
  b: number | null;
  displayA: string;
  displayB: string;
  higherIsBetter?: boolean;
};

export function TeamCompareH2HBoard({ data }: { data: TeamComparePayload }) {
  const { teamA, teamB, headToHead: h2h, xvSummaryA, xvSummaryB, depthA, depthB } = data;
  const codeA = code(teamA);
  const codeB = code(teamB);
  const nickA = nickname(teamA);
  const nickB = nickname(teamB);
  const performersA = useMemo(
    () => performerRows(h2h.topPerformersA),
    [h2h.topPerformersA],
  );
  const performersB = useMemo(
    () => performerRows(h2h.topPerformersB),
    [h2h.topPerformersB],
  );

  const rows: Row[] = [
    {
      label: "Rugby365 Rating",
      a: teamA.rating.overall,
      b: teamB.rating.overall,
      displayA: formatRating(teamA.rating.overall),
      displayB: formatRating(teamB.rating.overall),
    },
    {
      label: "Squad Strength",
      a: teamA.rating.components.squadStrength,
      b: teamB.rating.components.squadStrength,
      displayA: formatRating(teamA.rating.components.squadStrength),
      displayB: formatRating(teamB.rating.components.squadStrength),
    },
    {
      label: "Team Form Score",
      a: teamA.rating.components.form,
      b: teamB.rating.components.form,
      displayA: formatRating(teamA.rating.components.form),
      displayB: formatRating(teamB.rating.components.form),
    },
    {
      label: "Modelled Squad-Size Score",
      a: teamA.rating.components.depth,
      b: teamB.rating.components.depth,
      displayA: formatRating(teamA.rating.components.depth),
      displayB: formatRating(teamB.rating.components.depth),
    },
    {
      label: "Estimated Value Score",
      a: teamA.rating.components.value,
      b: teamB.rating.components.value,
      displayA: formatRating(teamA.rating.components.value),
      displayB: formatRating(teamB.rating.components.value),
    },
    {
      label: "CMS Titles Score",
      a: teamA.rating.components.trophies,
      b: teamB.rating.components.trophies,
      displayA: formatRating(teamA.rating.components.trophies),
      displayB: formatRating(teamB.rating.components.trophies),
    },
    {
      label: "Average Player Rating",
      a: teamA.squadValue.averageRating,
      b: teamB.squadValue.averageRating,
      displayA: formatRating(teamA.squadValue.averageRating),
      displayB: formatRating(teamB.squadValue.averageRating),
    },
    {
      label: xvSummaryA.source === "last_match" || xvSummaryB.source === "last_match" ? "Last XV Rating" : "Modelled XV Rating",
      a: xvSummaryA.averageRating,
      b: xvSummaryB.averageRating,
      displayA: formatRating(xvSummaryA.averageRating),
      displayB: formatRating(xvSummaryB.averageRating),
    },
    ...((): Row[] => {
      const benchA = benchAverageRating(teamA);
      const benchB = benchAverageRating(teamB);
      if (benchA == null && benchB == null) return [];
      return [
        {
          label: "Bench Rating",
          a: benchA,
          b: benchB,
          displayA: formatRating(benchA),
          displayB: formatRating(benchB),
        },
      ];
    })(),
    {
      label: "Modelled Squad Depth",
      a: depthA.depthScore,
      b: depthB.depthScore,
      displayA: depthA.depthScore != null ? String(Math.round(depthA.depthScore)) : "—",
      displayB: depthB.depthScore != null ? String(Math.round(depthB.depthScore)) : "—",
    },
    {
      label: "Modelled Experience Score",
      a: depthA.experienceScore,
      b: depthB.experienceScore,
      displayA: depthA.experienceScore != null ? String(Math.round(depthA.experienceScore)) : "—",
      displayB: depthB.experienceScore != null ? String(Math.round(depthB.experienceScore)) : "—",
    },
    {
      label: "U23 Share",
      a: depthA.youthPct,
      b: depthB.youthPct,
      displayA: depthA.youthPct != null ? `${depthA.youthPct}%` : "—",
      displayB: depthB.youthPct != null ? `${depthB.youthPct}%` : "—",
    },
    {
      label: "CMS Titles",
      a: teamA.trophyCount,
      b: teamB.trophyCount,
      displayA: String(teamA.trophyCount),
      displayB: String(teamB.trophyCount),
    },
    {
      label: "Rugby365 Estimated Value",
      a: teamA.squadValue.totalSquadValueGbp,
      b: teamB.squadValue.totalSquadValueGbp,
      displayA: teamA.squadValue.totalSquadValueLabel ?? "—",
      displayB: teamB.squadValue.totalSquadValueLabel ?? "—",
    },
  ];

  const [tab, setTab] = useState<CompareTab>("h2h");
  const changeTeamsHref = "/teams/compare";

  return (
    <section className="r365-h2h" aria-label="Head-to-head comparison">
      <nav className="r365-h2h__nav" aria-label="Compare sections">
        <div className="r365-h2h__nav-tabs" role="tablist">
          {COMPARE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="r365-h2h__nav-actions">
          <button type="button" className="r365-h2h__nav-action" disabled>
            Share
          </button>
          <Link href={changeTeamsHref} className="r365-h2h__nav-action is-compare">
            Compare
          </Link>
        </div>
      </nav>

      {tab === "overview" ? (
        <div className="r365-h2h__panel">
          <div className="r365-h2h__overview">
            {[teamA, teamB].map((side) => (
              <article key={side.id} className="r365-h2h__card r365-h2h__overview-card">
                <div className="r365-h2h__overview-head">
                  <TeamCrest name={side.name} imageUrl={side.imageUrl} size="lg" labelled />
                  <div>
                    <h2 className="r365-h2h__overview-name">{nickname(side)}</h2>
                    <p className="r365-h2h__overview-meta">{countryLine(side)}</p>
                  </div>
                </div>
                <dl className="r365-h2h__overview-grid">
                  <div>
                    <dt>Rating</dt>
                    <dd>{formatRating(side.rating.overall)}</dd>
                  </div>
                  <div>
                    <dt>World rank</dt>
                    <dd>{side.worldRank != null ? `#${side.worldRank}` : "—"}</dd>
                  </div>
                  <div>
                    <dt>Rugby365 est. value</dt>
                    <dd>{side.squadValue.totalSquadValueLabel ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Last 10 results</dt>
                    <dd>
                      {side.form.won}W {side.form.drawn}D {side.form.lost}L
                    </dd>
                  </div>
                  <div>
                    <dt>Coach</dt>
                    <dd>{side.coachName || "—"}</dd>
                  </div>
                  <div>
                    <dt>Listed home venue</dt>
                    <dd>{side.homeVenueName || "Not available"}</dd>
                  </div>
                </dl>
                <FormBoxes results={side.form.lastResults} />
                <Link href={`/teams/${side.slug}`} className="r365-h2h__panel-link">
                  Open {side.name} profile
                </Link>
              </article>
            ))}
          </div>
          <p className="r365-h2h__panel-note">
            Overview summarises both selected sides. Switch to Head-to-Head for the full rivalry board,
            or Squads / Fixtures for match-day detail.
          </p>
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="r365-h2h__panel">
          <div className="r365-h2h__stats-grid">
            <article className="r365-h2h__card">
              <h2 className="r365-h2h__card-title">Team comparison</h2>
              <table className="r365-h2h__table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>{codeA}</th>
                    <th>{codeB}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const higher = row.higherIsBetter !== false;
                    const aLead =
                      row.a != null && row.b != null
                        ? higher
                          ? row.a >= row.b
                          : row.a <= row.b
                        : row.a != null;
                    const bLead =
                      row.a != null && row.b != null
                        ? higher
                          ? row.b > row.a
                          : row.b < row.a
                        : row.b != null;
                    return (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className={aLead ? "is-lead" : undefined}>{row.displayA}</td>
                        <td className={bLead ? "is-lead" : undefined}>{row.displayB}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
            <article className="r365-h2h__card">
              <h2 className="r365-h2h__card-title">Head-to-head scoring</h2>
              <div className="r365-h2h__points r365-h2h__points--stack">
                <div>
                  <span>Meetings</span>
                  <b>{h2h.totalMeetings}</b>
                </div>
                <div>
                  <span>{codeA} wins</span>
                  <b className="is-lead">{h2h.teamAWins}</b>
                </div>
                <div>
                  <span>{codeB} wins</span>
                  <b>{h2h.teamBWins}</b>
                </div>
                <div>
                  <span>Draws</span>
                  <b>{h2h.draws}</b>
                </div>
                <div>
                  <span>{codeA} points for</span>
                  <b className={h2h.pointsForA >= h2h.pointsForB ? "is-lead" : undefined}>
                    {h2h.pointsForA}
                  </b>
                </div>
                <div>
                  <span>{codeB} points for</span>
                  <b className={h2h.pointsForB > h2h.pointsForA ? "is-lead" : undefined}>
                    {h2h.pointsForB}
                  </b>
                </div>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {tab === "squads" ? <TeamCompareSquadsBoard data={data} /> : null}

      {tab === "fixtures" ? (
        <div className="r365-h2h__panel">
          <div className="r365-h2h__fixtures-grid">
            <article className="r365-h2h__card">
              <h2 className="r365-h2h__card-title">Recent meetings</h2>
              {h2h.recentMeetings.length === 0 ? (
                <p className="r365-h2h__muted">No meetings found.</p>
              ) : (
                <table className="r365-h2h__meetings r365-h2h__meetings--panel">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Competition</th>
                      <th>Venue</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.recentMeetings.slice(0, 8).map((m) => {
                      const homeIsA = isTeamASide(m.homeTeam, teamA);
                      const homeCrest = homeIsA ? teamA.imageUrl : teamB.imageUrl;
                      const awayCrest = homeIsA ? teamB.imageUrl : teamA.imageUrl;
                      const homeCode = homeIsA ? codeA : codeB;
                      const awayCode = homeIsA ? codeB : codeA;
                      const homeLead = m.homeScore > m.awayScore;
                      const awayLead = m.awayScore > m.homeScore;
                      return (
                        <tr key={m.id}>
                          <td className="r365-h2h__meetings-date">{shortMeetingDate(m.date)}</td>
                          <td className="r365-h2h__meetings-comp">{shortCompetition(m.competitionName)}</td>
                          <td className="r365-h2h__meetings-venue">{shortVenue(m.venueName)}</td>
                          <td className="r365-h2h__meetings-result">
                            <span className="r365-h2h__result">
                              <TeamCrest name={m.homeTeam} imageUrl={homeCrest} size="xs" />
                              <span className={homeLead ? "is-win" : undefined}>
                                {homeCode} {m.homeScore}
                              </span>
                              <span className="r365-h2h__result-dash">–</span>
                              <span className={awayLead ? "is-win" : undefined}>
                                {m.awayScore} {awayCode}
                              </span>
                              <TeamCrest name={m.awayTeam} imageUrl={awayCrest} size="xs" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </article>
            <article className="r365-h2h__card">
              <h2 className="r365-h2h__card-title">Next meeting</h2>
              {h2h.nextMeeting ? (
                <div className="r365-h2h__fixtures-next">
                  <p>{h2h.nextMeeting.competitionName || "Upcoming fixture"}</p>
                  <p className="r365-h2h__fixtures-next-scoreline">
                    {h2h.nextMeeting.homeTeam} vs {h2h.nextMeeting.awayTeam}
                  </p>
                  <p className="r365-h2h__muted">
                    {shortMeetingDate(h2h.nextMeeting.date)}
                    {h2h.nextMeeting.kickoffLabel ? ` · ${h2h.nextMeeting.kickoffLabel}` : ""}
                    {h2h.nextMeeting.venueName ? ` · ${h2h.nextMeeting.venueName}` : ""}
                  </p>
                  {h2h.nextMeeting.fixtureSlug ? (
                    <Link href={h2h.nextMeeting.fixtureSlug} className="r365-h2h__panel-link">
                      Match Centre
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="r365-h2h__muted">No upcoming meeting scheduled between these sides.</p>
              )}
              <div className="r365-h2h__fixtures-links">
                <Link href={`/teams/${teamA.slug}`}>All {teamA.name} fixtures</Link>
                <Link href={`/teams/${teamB.slug}`}>All {teamB.name} fixtures</Link>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {tab === "news" ? (
        <div className="r365-h2h__panel">
          <div className="r365-h2h__news">
            <article className="r365-h2h__card">
              <h2 className="r365-h2h__card-title">Team hubs</h2>
              <p className="r365-h2h__muted">
                Jump into each side&apos;s public profile for squad notes, recent results and related coverage.
              </p>
              <div className="r365-h2h__news-links">
                <Link href={`/teams/${teamA.slug}`} className="r365-h2h__news-card">
                  <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="md" labelled />
                  <span>{teamA.name} overview</span>
                </Link>
                <Link href={`/teams/${teamB.slug}`} className="r365-h2h__news-card">
                  <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="md" labelled />
                  <span>{teamB.name} overview</span>
                </Link>
              </div>
            </article>
            <article className="r365-h2h__card">
              <h2 className="r365-h2h__card-title">Rivalry focus</h2>
              <p className="r365-h2h__muted">
                {teamA.name} and {teamB.name} have met {h2h.totalMeetings} times in our completed fixture set
                ({h2h.teamAWins}–{h2h.draws}–{h2h.teamBWins}). Use Head-to-Head for the full board, or Fixtures
                for the latest scorelines.
              </p>
              <button type="button" className="r365-h2h__panel-link" onClick={() => setTab("h2h")}>
                Back to Head-to-Head
              </button>
            </article>
          </div>
        </div>
      ) : null}

      {tab === "h2h" ? (
        <>
      {/* TOP HERO — matches mockup */}
      <header className="r365-h2h__hero">
        <div className="r365-h2h__side is-a">
          <div className="r365-h2h__identity">
            <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="lg" labelled />
            <div>
              <h1 className="r365-h2h__nick">{nickA}</h1>
              <p className="r365-h2h__country is-a">{countryLine(teamA)}</p>
            </div>
          </div>
          <dl className="r365-h2h__kpis">
            <div>
              <dt>Rugby365 Rating</dt>
              <dd>{formatRating(teamA.rating.overall)}</dd>
            </div>
            <div>
              <dt>World Rank</dt>
              <dd>{teamA.worldRank != null ? `#${teamA.worldRank}` : "—"}</dd>
            </div>
            <div>
              <dt>Squad Value</dt>
              <dd>{teamA.squadValue.totalSquadValueLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="r365-h2h__centre">
          <p className="r365-h2h__centre-label">Head-to-Head</p>
          <p className="r365-h2h__centre-sub">All Competitions</p>
          <div className="r365-h2h__totals">
            <div>
              <strong className="is-lead">{h2h.teamAWins}</strong>
              <span>Wins</span>
            </div>
            <div>
              <strong>{h2h.totalMeetings}</strong>
              <span>Played</span>
            </div>
            <div>
              <strong>{h2h.teamBWins}</strong>
              <span>Wins</span>
            </div>
          </div>
          <p className="r365-h2h__draws">
            {h2h.draws} Draw{h2h.draws === 1 ? "" : "s"}
          </p>
        </div>

        <div className="r365-h2h__side is-b">
          <div className="r365-h2h__identity">
            <div>
              <h1 className="r365-h2h__nick">{nickB}</h1>
              <p className="r365-h2h__country">{countryLine(teamB)}</p>
            </div>
            <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="lg" labelled />
          </div>
          <dl className="r365-h2h__kpis">
            <div>
              <dt>Rugby365 Rating</dt>
              <dd>{formatRating(teamB.rating.overall)}</dd>
            </div>
            <div>
              <dt>World Rank</dt>
              <dd>{teamB.worldRank != null ? `#${teamB.worldRank}` : "—"}</dd>
            </div>
            <div>
              <dt>Squad Value</dt>
              <dd>{teamB.squadValue.totalSquadValueLabel}</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* FORM + LAST MEETING */}
      <div className="r365-h2h__strip">
        <div className="r365-h2h__form">
          <p className="r365-h2h__eyebrow">{formEyebrow(teamA.form.lastResults)}</p>
          <FormBoxes results={teamA.form.lastResults} />
        </div>
        <div className="r365-h2h__last">
          <p className="r365-h2h__eyebrow">Last Meeting</p>
          {h2h.lastMeeting ? (
            <>
              <p className="r365-h2h__last-meta">
                {formatDate(h2h.lastMeeting.date)}
                {h2h.lastMeeting.competitionName ? ` · ${h2h.lastMeeting.competitionName}` : ""}
                {h2h.lastMeeting.venueName ? `, ${shortVenue(h2h.lastMeeting.venueName)}` : ""}
              </p>
              <div className="r365-h2h__last-score">
                {(() => {
                  const last = h2h.lastMeeting;
                  const homeIsA = isTeamASide(last.homeTeam, teamA);
                  const homeCrest = homeIsA ? teamA.imageUrl : teamB.imageUrl;
                  const awayCrest = homeIsA ? teamB.imageUrl : teamA.imageUrl;
                  const homeNick = homeIsA ? nickA : nickB;
                  const awayNick = homeIsA ? nickB : nickA;
                  const homeLead = last.homeScore > last.awayScore;
                  const awayLead = last.awayScore > last.homeScore;
                  return (
                    <>
                      <TeamCrest name={last.homeTeam} imageUrl={homeCrest} size="sm" labelled />
                      <span className={homeLead ? "is-win" : undefined}>
                        {homeNick} {last.homeScore}
                      </span>
                      <span className="r365-h2h__last-dash">–</span>
                      <span className={awayLead ? "is-win" : undefined}>
                        {last.awayScore} {awayNick}
                      </span>
                      <TeamCrest name={last.awayTeam} imageUrl={awayCrest} size="sm" labelled />
                    </>
                  );
                })()}
              </div>
            </>
          ) : (
            <p className="r365-h2h__muted">No completed meetings yet.</p>
          )}
        </div>
        <div className="r365-h2h__form is-b">
          <p className="r365-h2h__eyebrow">{formEyebrow(teamB.form.lastResults)}</p>
          <FormBoxes results={teamB.form.lastResults} />
        </div>
      </div>

      {/* MID — 3 columns like mockup */}
      <div className="r365-h2h__mid">
        <article className="r365-h2h__card r365-h2h__card--fill">
          <h2 className="r365-h2h__card-title">Rugby365 Team Comparison</h2>
          <div className="r365-h2h__table-scroll">
            <table className="r365-h2h__table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>{codeA}</th>
                  <th>{codeB}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const higher = row.higherIsBetter !== false;
                  const aLead =
                    row.a != null && row.b != null
                      ? higher
                        ? row.a >= row.b
                        : row.a <= row.b
                      : row.a != null;
                  const bLead =
                    row.a != null && row.b != null
                      ? higher
                        ? row.b > row.a
                        : row.b < row.a
                      : row.b != null;
                  return (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className={aLead ? "is-lead" : undefined}>{row.displayA}</td>
                      <td className={bLead ? "is-lead" : undefined}>{row.displayB}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="r365-h2h__card r365-h2h__card--fill">
          <h2 className="r365-h2h__card-title">Wins Over Time</h2>
          <WinsChart points={h2h.winsOverTime} codeA={codeA} codeB={codeB} />
        </article>

        <div className="r365-h2h__mid-stack">
          <article className="r365-h2h__card r365-h2h__card--fill">
            <h2 className="r365-h2h__card-title">Results Breakdown</h2>
            <ResultsDonut
              winsA={h2h.teamAWins}
              winsB={h2h.teamBWins}
              draws={h2h.draws}
              codeA={codeA}
              codeB={codeB}
            />
          </article>
          <article className="r365-h2h__card r365-h2h__card--fill">
            <h2 className="r365-h2h__card-title">Points Record</h2>
            <div className="r365-h2h__points">
              <div className="r365-h2h__points-col">
                <span>Total Points For</span>
                <div className="r365-h2h__points-pair">
                  <b className={h2h.pointsForA >= h2h.pointsForB ? "is-lead" : undefined}>
                    <em>{codeA}</em>
                    <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="xs" labelled />
                    {h2h.pointsForA}
                  </b>
                  <b className={h2h.pointsForB > h2h.pointsForA ? "is-lead" : undefined}>
                    <em>{codeB}</em>
                    <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="xs" labelled />
                    {h2h.pointsForB}
                  </b>
                </div>
              </div>
              <div className="r365-h2h__points-col">
                <span>Average Points Per Game</span>
                <div className="r365-h2h__points-pair">
                  <b
                    className={
                      (h2h.avgPointsForA ?? 0) >= (h2h.avgPointsForB ?? 0) ? "is-lead" : undefined
                    }
                  >
                    <em>{codeA}</em>
                    <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="xs" labelled />
                    {h2h.avgPointsForA ?? "—"}
                  </b>
                  <b
                    className={
                      (h2h.avgPointsForB ?? 0) > (h2h.avgPointsForA ?? 0) ? "is-lead" : undefined
                    }
                  >
                    <em>{codeB}</em>
                    <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="xs" labelled />
                    {h2h.avgPointsForB ?? "—"}
                  </b>
                </div>
              </div>
            </div>
          </article>
        </div>

        <article className="r365-h2h__card r365-h2h__card--fill r365-h2h__records">
          <h2 className="r365-h2h__card-title">Biggest Wins</h2>
          <ul className="r365-h2h__highlights">
            {h2h.biggestWinForA ? (
              <li>
                <p className="r365-h2h__highlight-team is-a">{h2h.biggestWinForA.winnerName}</p>
                <div className="r365-h2h__highlight-scoreline">
                  <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="sm" labelled />
                  <p className="r365-h2h__highlight-score">{h2h.biggestWinForA.score}</p>
                  <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="sm" labelled />
                </div>
                <p className="r365-h2h__highlight-meta">
                  {shortVenue(h2h.biggestWinForA.venueName)}, {formatDate(h2h.biggestWinForA.date)}
                </p>
              </li>
            ) : null}
            {h2h.biggestWinForB ? (
              <li>
                <p className="r365-h2h__highlight-team">{h2h.biggestWinForB.winnerName}</p>
                <div className="r365-h2h__highlight-scoreline">
                  <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="sm" labelled />
                  <p className="r365-h2h__highlight-score">{h2h.biggestWinForB.score}</p>
                  <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="sm" labelled />
                </div>
                <p className="r365-h2h__highlight-meta">
                  {shortVenue(h2h.biggestWinForB.venueName)}, {formatDate(h2h.biggestWinForB.date)}
                </p>
              </li>
            ) : null}
          </ul>
          {h2h.highestScoring ? (
            <div className="r365-h2h__highest">
              <h2 className="r365-h2h__card-title">Highest Scoring</h2>
              <div className="r365-h2h__highlight-scoreline">
                <TeamCrest name={teamA.name} imageUrl={teamA.imageUrl} size="sm" labelled />
                <p className="r365-h2h__highlight-score">{h2h.highestScoring.score}</p>
                <TeamCrest name={teamB.name} imageUrl={teamB.imageUrl} size="sm" labelled />
              </div>
              <p className="r365-h2h__highlight-meta">
                {shortVenue(h2h.highestScoring.venueName)}, {formatDate(h2h.highestScoring.date)}
              </p>
            </div>
          ) : null}
        </article>
      </div>

      {/* BOTTOM — 3 equal-height columns matching mockup */}
      <div className="r365-h2h__lower">
        <article className="r365-h2h__card r365-h2h__card--fill r365-h2h__card--meetings">
          <h2 className="r365-h2h__card-title">Last 5 Meetings</h2>
          {h2h.recentMeetings.length === 0 ? (
            <p className="r365-h2h__muted">No meetings found.</p>
          ) : (
            <table className="r365-h2h__meetings">
              <colgroup>
                <col className="r365-h2h__meetings-col--date" />
                <col className="r365-h2h__meetings-col--comp" />
                <col className="r365-h2h__meetings-col--venue" />
                <col className="r365-h2h__meetings-col--result" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Competition</th>
                  <th scope="col">Venue</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {h2h.recentMeetings.slice(0, 5).map((m) => {
                  const homeIsA = isTeamASide(m.homeTeam, teamA);
                  const homeCrest = homeIsA ? teamA.imageUrl : teamB.imageUrl;
                  const awayCrest = homeIsA ? teamB.imageUrl : teamA.imageUrl;
                  const homeCode = homeIsA ? codeA : codeB;
                  const awayCode = homeIsA ? codeB : codeA;
                  const homeLead = m.homeScore > m.awayScore;
                  const awayLead = m.awayScore > m.homeScore;
                  const aWon =
                    (homeIsA && homeLead) || (!homeIsA && awayLead);
                  const result = (
                    <span className={`r365-h2h__result${aWon ? " is-a-win" : ""}`}>
                      <TeamCrest name={m.homeTeam} imageUrl={homeCrest} size="xs" />
                      <span className={homeLead ? "is-win" : awayLead ? "is-loss" : undefined}>
                        {homeCode}&nbsp;{m.homeScore}
                      </span>
                      <span className="r365-h2h__result-dash">–</span>
                      <span className={awayLead ? "is-win" : homeLead ? "is-loss" : undefined}>
                        {m.awayScore}&nbsp;{awayCode}
                      </span>
                      <TeamCrest name={m.awayTeam} imageUrl={awayCrest} size="xs" />
                    </span>
                  );
                  return (
                    <tr key={m.id}>
                      <td className="r365-h2h__meetings-date">{shortMeetingDate(m.date)}</td>
                      <td className="r365-h2h__meetings-comp" title={m.competitionName || undefined}>
                        {shortCompetition(m.competitionName)}
                      </td>
                      <td className="r365-h2h__meetings-venue" title={m.venueName || undefined}>
                        {shortVenue(m.venueName)}
                      </td>
                      <td className="r365-h2h__meetings-result">
                        {m.matchHref ? (
                          <Link href={m.matchHref} className="r365-h2h__result-link">
                            {result}
                          </Link>
                        ) : (
                          result
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </article>

        <article className="r365-h2h__card r365-h2h__card--fill r365-h2h__card--performers">
          <h2 className="r365-h2h__card-title r365-h2h__card-title--center">Top Performers (H2H stats)</h2>
          <div className="r365-h2h__performers">
            {([
              [teamA, performersA, "a"] as const,
              [teamB, performersB, "b"] as const,
            ]).map(([side, rows, key]) => (
              <div key={key} className="r365-h2h__performers-col">
                <div className="r365-h2h__performers-crest">
                  <TeamCrest name={side.name} imageUrl={side.imageUrl} size="sm" labelled />
                </div>
                {rows.length === 0 ? (
                  <p className="r365-h2h__empty">No recorded H2H performance stats.</p>
                ) : (
                  <ol>
                    {rows.map((p, i) => (
                      <li key={`${key}-${p.label}-${p.playerId ?? p.playerSlug ?? i}`}>
                        <em>{i + 1}</em>
                        <PerformerAvatar src={p.imageUrl} name={p.name} />
                        <div className="r365-h2h__performers-main">
                          {p.playerSlug ? (
                            <Link href={`/players/${p.playerSlug}`} title={p.name}>
                              {shortPlayerName(p.name)}
                            </Link>
                          ) : (
                            <span title={p.name}>{shortPlayerName(p.name)}</span>
                          )}
                          <small title={p.label}>{shortPerformerLabel(p.label)}</small>
                        </div>
                        <b>{p.value}</b>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="r365-h2h__card r365-h2h__card--fill r365-h2h__upcoming">
          <h2 className="r365-h2h__card-title">Next Meeting</h2>
          {(() => {
            const next = h2h.nextMeeting;
            const homeName = next?.homeTeam || teamA.name;
            const awayName = next?.awayTeam || teamB.name;
            const homeIsA = homeName.trim().toLowerCase() === teamA.name.trim().toLowerCase();
            const parts = kickoffParts(next?.date ?? null, next?.kickoffLabel ?? null);
            return (
              <>
                <p className="r365-h2h__upcoming-comp">
                  {(next?.competitionName || "Upcoming fixture").toUpperCase()}
                </p>
                <div className="r365-h2h__upcoming-logos">
                  <div className="r365-h2h__upcoming-team">
                    <TeamCrest
                      name={homeName}
                      imageUrl={homeIsA ? teamA.imageUrl : teamB.imageUrl}
                      size="md"
                      labelled
                    />
                    <span className={homeIsA ? "is-home" : undefined}>{homeName}</span>
                  </div>
                  <strong>VS</strong>
                  <div className="r365-h2h__upcoming-team">
                    <TeamCrest
                      name={awayName}
                      imageUrl={homeIsA ? teamB.imageUrl : teamA.imageUrl}
                      size="md"
                      labelled
                    />
                    <span className={!homeIsA ? "is-home" : undefined}>{awayName}</span>
                  </div>
                </div>
                <ul className="r365-h2h__upcoming-meta">
                  <li>
                    <i className="r365-h2h__ico r365-h2h__ico--cal" aria-hidden />
                    <span>{parts.date}</span>
                  </li>
                  {parts.time ? (
                    <li>
                      <i className="r365-h2h__ico r365-h2h__ico--clock" aria-hidden />
                      <span>{parts.time}</span>
                    </li>
                  ) : null}
                  <li>
                    <i className="r365-h2h__ico r365-h2h__ico--pin" aria-hidden />
                    <span>{next?.venueName || "Venue TBC"}</span>
                  </li>
                </ul>
                {next?.fixtureSlug ? (
                  <Link href={next.fixtureSlug} className="r365-h2h__upcoming-btn">
                    Match Centre
                  </Link>
                ) : (
                  <span className="r365-h2h__upcoming-btn is-disabled">Match Centre</span>
                )}
              </>
            );
          })()}
        </article>
      </div>

      <footer className="r365-h2h__footer">
        <span>
          Head-to-head statistics include all completed fixtures between {teamA.name} and {teamB.name}.
        </span>
        <span>
          Data updated:{" "}
          {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </footer>
        </>
      ) : null}
    </section>
  );
}
