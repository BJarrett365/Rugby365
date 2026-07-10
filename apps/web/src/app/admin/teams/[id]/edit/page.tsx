"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TeamMatchStatsSection } from "@/components/admin/MatchStatsPanel";
import { TeamSeasonStatsSection } from "@/components/admin/SeasonStatsPanel";
import { TeamCoachingStaffSection } from "@/components/admin/TeamCoachingStaffSection";
import { TeamAvailabilityPanel } from "@/components/admin/TeamAvailabilityPanel";
import { TeamLegendsSection } from "@/components/admin/TeamLegendsSection";
import { PageHeader } from "@/components/shell/PageHeader";
import { AiAssistPanel } from "@/components/admin/AiAssistPanel";
import { AdminSquadRankingsCell } from "@/components/admin/AdminRatingCells";
import { isFixtureRatingsPublished } from "@/lib/match-rating-math";
import type { SquadPlayerRankings } from "@/lib/match-rating-service";
import { HEMISPHERE_OPTIONS, TEAM_TYPE_OPTIONS } from "@/lib/team-hemisphere-utils";
import { movementTypeLabel } from "@/lib/transfer-types";

type TransferHistoryEntry = {
  id: string;
  playerId: string;
  playerName: string;
  movementType: string;
  fromClub: string | null;
  toClub: string | null;
  effectiveDate: string | null;
  seasonLabel: string | null;
  positionName: string | null;
};

type TransferHistoryBySeason = {
  season: string;
  items: TransferHistoryEntry[];
};

type TeamTransferHistory = {
  playersInBySeason: TransferHistoryBySeason[];
  playersOutBySeason: TransferHistoryBySeason[];
};

type TeamFixture = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  side: "home" | "away";
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  result: "won" | "lost" | "draw" | null;
  attendance: number | null;
  venueName: string | null;
};

type TeamPlayer = {
  playerId: string;
  name: string;
  slug: string;
  positionName: string | null;
  clubName: string | null;
  countryName: string | null;
  nationCode: string | null;
  jerseyNumber: number | null;
  fixtureCount: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
};

type CurrentSquadPlayer = TeamPlayer & {
  squadRole: string;
  rankings: SquadPlayerRankings;
};

type DepartedPlayer = TeamPlayer & {
  lastSeenAt: string | null;
  lastOpponentName: string | null;
  rankings: SquadPlayerRankings;
};

type RecentSquadFixture = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  opponentName: string;
  side: "home" | "away";
  status: string;
};

type Venue = { id: string; name: string };

type ResultsSummary = {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  scheduled: number;
};

function formatKickoff(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function resultLabel(result: TeamFixture["result"], status: string) {
  if (result === "won") return "W";
  if (result === "lost") return "L";
  if (result === "draw") return "D";
  if (status === "live") return "Live";
  return "—";
}

function resultClass(result: TeamFixture["result"]) {
  if (result === "won") return "text-emerald-400";
  if (result === "lost") return "text-red-400";
  if (result === "draw") return "text-amber-400";
  return "text-zinc-500";
}

function stat(n: number) {
  return n > 0 ? String(n) : "—";
}

export default function EditTeamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState("");
  const [homeVenue, setHomeVenue] = useState<Venue | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [fixtures, setFixtures] = useState<TeamFixture[]>([]);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [currentSquad, setCurrentSquad] = useState<CurrentSquadPlayer[]>([]);
  const [departedPlayers, setDepartedPlayers] = useState<DepartedPlayer[]>([]);
  const [recentSquadFixture, setRecentSquadFixture] = useState<RecentSquadFixture | null>(null);
  const [repairingNames, setRepairingNames] = useState(false);
  const [resultsSummary, setResultsSummary] = useState<ResultsSummary | null>(null);
  const [transferHistory, setTransferHistory] = useState<TeamTransferHistory | null>(null);
  const [values, setValues] = useState({
    name: "",
    slug: "",
    shortName: "",
    externalProviderId: "",
    homeVenueId: "",
    countryName: "",
    region: "",
    hemisphere: "",
    teamType: "",
  });

  function load() {
    return Promise.all([
      fetch(`/api/admin/teams/${id}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load team");
        return data;
      }),
      fetch("/api/admin/venues").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load venues");
        return data;
      }),
    ])
      .then(([d, venuesData]) => {
        if (d.team) {
          setTeamName(d.team.name);
          setValues({
            name: d.team.name,
            slug: d.team.slug,
            shortName: d.team.shortName ?? "",
            externalProviderId: d.team.externalProviderId ?? "",
            homeVenueId: d.team.homeVenueId ?? d.homeVenue?.id ?? "",
            countryName: d.team.countryName ?? "",
            region: d.team.region ?? "",
            hemisphere: d.team.hemisphere ?? "",
            teamType: d.team.teamType ?? "",
          });
        }
        setHomeVenue(d.homeVenue ?? null);
        setFixtures(d.fixtures ?? []);
        setPlayers(d.players ?? []);
        setCurrentSquad(d.currentSquad ?? []);
        setDepartedPlayers(d.departedPlayers ?? []);
        setRecentSquadFixture(d.recentSquadFixture ?? null);
        setResultsSummary(d.resultsSummary ?? null);
        setTransferHistory(d.transferHistory ?? null);
        setVenues(venuesData.venues ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load team");
        setLoading(false);
      });
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on id change only
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        homeVenueId: values.homeVenueId || null,
        countryName: values.countryName || null,
        region: values.region || null,
        hemisphere: values.hemisphere || null,
        teamType: values.teamType || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Failed to save");
    else await load();
    setSaving(false);
  }

  async function repairPlayerNames() {
    setRepairingNames(true);
    const res = await fetch(`/api/admin/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repair-player-names" }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Updated ${data.count ?? 0} player name(s).`);
      await load();
    } else {
      alert(data.error ?? "Name repair failed");
    }
    setRepairingNames(false);
  }

  async function remove() {
    if (!confirm("Delete this team?")) return;
    const res = await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/teams");
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;
  if (error && !teamName) {
    return (
      <>
        <PageHeader eyebrow="CMS" title="Edit team" />
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/admin/teams" className="cms-btn cms-btn--secondary mt-4 inline-block">
          Back to teams
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="CMS" title={teamName || "Edit team"} />

      <AiAssistPanel entityType="team" entityId={id} onApplied={() => load().catch(() => undefined)} />

      {resultsSummary && (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0">Results record</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-3">
            From completed and live fixtures where this team is home or away.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-zinc-500">Played</span>{" "}
              <span className="font-mono text-zinc-100">{resultsSummary.played}</span>
            </span>
            <span>
              <span className="text-zinc-500">Won</span>{" "}
              <span className="font-mono text-emerald-400">{resultsSummary.won}</span>
            </span>
            <span>
              <span className="text-zinc-500">Lost</span>{" "}
              <span className="font-mono text-red-400">{resultsSummary.lost}</span>
            </span>
            <span>
              <span className="text-zinc-500">Drawn</span>{" "}
              <span className="font-mono text-amber-400">{resultsSummary.drawn}</span>
            </span>
            <span>
              <span className="text-zinc-500">Upcoming</span>{" "}
              <span className="font-mono text-zinc-300">{resultsSummary.scheduled}</span>
            </span>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="cms-card space-y-4 max-w-lg mb-4">
        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        <label className="block">
          <span className="text-sm text-zinc-400">Name</span>
          <input
            className="cms-input w-full mt-1"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Slug</span>
          <input
            className="cms-input w-full mt-1"
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Short name</span>
          <input
            className="cms-input w-full mt-1"
            value={values.shortName}
            onChange={(e) => setValues((v) => ({ ...v, shortName: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Home venue</span>
          <select
            className="cms-select w-full mt-1"
            value={values.homeVenueId}
            onChange={(e) => setValues((v) => ({ ...v, homeVenueId: e.target.value }))}
          >
            <option value="">None</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {homeVenue && !values.homeVenueId && (
            <span className="text-xs text-zinc-600 mt-1 block">Current: {homeVenue.name}</span>
          )}
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Country</span>
          <input
            className="cms-input w-full mt-1"
            value={values.countryName}
            onChange={(e) => setValues((v) => ({ ...v, countryName: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Region</span>
          <input
            className="cms-input w-full mt-1"
            value={values.region}
            onChange={(e) => setValues((v) => ({ ...v, region: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Hemisphere</span>
          <select
            className="cms-select w-full mt-1"
            value={values.hemisphere}
            onChange={(e) => setValues((v) => ({ ...v, hemisphere: e.target.value }))}
          >
            {HEMISPHERE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Team type</span>
          <select
            className="cms-select w-full mt-1"
            value={values.teamType}
            onChange={(e) => setValues((v) => ({ ...v, teamType: e.target.value }))}
          >
            <option value="">Not set</option>
            {TEAM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Sport365 team ID</span>
          <input
            className="cms-input w-full mt-1"
            value={values.externalProviderId}
            onChange={(e) => setValues((v) => ({ ...v, externalProviderId: e.target.value }))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="cms-btn cms-btn--primary">
            {saving ? "Saving…" : "Save"}
          </button>
          <Link href="/admin/teams" className="cms-btn cms-btn--secondary">
            Back
          </Link>
          <button type="button" onClick={remove} className="cms-btn cms-btn--secondary text-red-400">
            Delete
          </button>
        </div>
      </form>

      <div className="cms-card mb-4 overflow-x-auto">
        <h3 className="font-semibold m-0">Fixtures & results</h3>
        <p className="text-sm text-zinc-500 mt-1 mb-3">
          Matches associated with this team ({fixtures.length}).
        </p>
        {fixtures.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No fixtures yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Venue</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Att.</th>
                <th className="py-2 pr-3">Result</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => (
                <tr key={f.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                    {formatKickoff(f.kickoffAt)}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-zinc-300">
                      {f.side === "home" ? "vs" : "@"} {f.opponentName}
                    </span>
                    {f.competitionName && (
                      <span className="block text-xs text-zinc-600">{f.competitionName}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-zinc-500 text-xs">{f.venueName ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {f.teamScore}–{f.opponentScore}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-500 text-xs">
                    {f.attendance != null ? f.attendance.toLocaleString() : "—"}
                  </td>
                  <td className={`py-2 pr-3 font-semibold ${resultClass(f.result)}`}>
                    {resultLabel(f.result, f.status)}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link href={`/admin/matches/${f.id}/edit`} className="text-emerald-400 text-xs mr-2">
                      Edit
                    </Link>
                    <Link href={`/matches/${f.slug}/commentary`} className="text-zinc-400 text-xs">
                      Commentary
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cms-card mb-4 overflow-x-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
          <div>
            <h3 className="font-semibold m-0">Current squad</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-0">
              {recentSquadFixture ? (
                <>
                  From latest match: {formatKickoff(recentSquadFixture.kickoffAt)} —{" "}
                  {recentSquadFixture.side === "home" ? "vs" : "@"}{" "}
                  {recentSquadFixture.opponentName} ({currentSquad.length} players)
                </>
              ) : (
                "No completed or live fixtures with a squad yet."
              )}
            </p>
          </div>
          {recentSquadFixture ? (
            <Link
              href={`/admin/squads/${recentSquadFixture.id}`}
              className="cms-btn cms-btn--secondary text-xs shrink-0"
            >
              Edit match squad
            </Link>
          ) : null}
        </div>
        {currentSquad.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No current squad loaded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3" title="Career Rating (35–99) | Match (1–10) | Form">
                  Rankings
                </th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Position</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {currentSquad.map((p) => (
                <tr key={p.playerId} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-2 font-mono text-zinc-500">{p.jerseyNumber ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/players/${p.playerId}/edit`} className="text-emerald-400">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <AdminSquadRankingsCell
                      rankings={p.rankings}
                      showLatestMatch
                      ratingsPublished={
                        recentSquadFixture
                          ? isFixtureRatingsPublished(recentSquadFixture.status)
                          : false
                      }
                    />
                  </td>
                  <td className="py-2 pr-3 text-zinc-400 capitalize">{p.squadRole}</td>
                  <td className="py-2 pr-3 text-zinc-400">{p.positionName ?? "—"}</td>
                  <td className="py-2 text-right">
                    <Link href={`/admin/players/${p.playerId}/edit`} className="text-xs text-zinc-500">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {departedPlayers.length > 0 ? (
        <div className="cms-card mb-4 overflow-x-auto border border-amber-900/40">
          <h3 className="font-semibold m-0 text-amber-200">Not in current squad</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-3">
            Players from past match squads who were not selected in the latest lineup (
            {departedPlayers.length}). Review for transfers or archive.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3" title="Career Rating (35–99) | Form from recent matches">
                  Rankings
                </th>
                <th className="py-2 pr-3">Last seen</th>
                <th className="py-2 pr-3">Squads</th>
                <th className="py-2 pr-3">Position</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {departedPlayers.map((p) => (
                <tr key={p.playerId} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/players/${p.playerId}/edit`} className="text-amber-300">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <AdminSquadRankingsCell rankings={p.rankings} />
                  </td>
                  <td className="py-2 pr-3 text-zinc-400 text-xs">
                    {p.lastSeenAt ? formatKickoff(p.lastSeenAt) : "—"}
                    {p.lastOpponentName ? (
                      <span className="block text-zinc-600">vs {p.lastOpponentName}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-500">{p.fixtureCount}</td>
                  <td className="py-2 pr-3 text-zinc-400">{p.positionName ?? "—"}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link href="/admin/transfers" className="text-xs text-zinc-500 mr-2">
                      Transfer
                    </Link>
                    <Link href={`/admin/players/${p.playerId}/edit`} className="text-xs text-zinc-500">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {transferHistory &&
      (transferHistory.playersInBySeason.length > 0 || transferHistory.playersOutBySeason.length > 0) ? (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0">Transfer activity</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Players in and out by season — sourced from transfer records and Wikipedia imports.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-emerald-400 m-0 mb-2">Players in</h4>
              {transferHistory.playersInBySeason.length === 0 ? (
                <p className="text-sm text-zinc-600 m-0">No incoming transfers recorded.</p>
              ) : (
                transferHistory.playersInBySeason.map(({ season, items }) => (
                  <div key={`in-${season}`} className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{season}</p>
                    <ul className="space-y-1 text-sm">
                      {items.map((t) => (
                        <li key={t.id} className="text-zinc-400">
                          <Link href={`/admin/players/${t.playerId}/edit`} className="text-emerald-400">
                            {t.playerName}
                          </Link>
                          <span className="text-zinc-600">
                            {" "}
                            · {movementTypeLabel(t.movementType)}
                            {t.fromClub ? ` from ${t.fromClub}` : ""}
                            {t.effectiveDate
                              ? ` (${new Date(t.effectiveDate).toLocaleDateString()})`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-amber-400 m-0 mb-2">Players out</h4>
              {transferHistory.playersOutBySeason.length === 0 ? (
                <p className="text-sm text-zinc-600 m-0">No outgoing transfers recorded.</p>
              ) : (
                transferHistory.playersOutBySeason.map(({ season, items }) => (
                  <div key={`out-${season}`} className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{season}</p>
                    <ul className="space-y-1 text-sm">
                      {items.map((t) => (
                        <li key={t.id} className="text-zinc-400">
                          <Link href={`/admin/players/${t.playerId}/edit`} className="text-amber-300">
                            {t.playerName}
                          </Link>
                          <span className="text-zinc-600">
                            {" "}
                            · {movementTypeLabel(t.movementType)}
                            {t.toClub ? ` to ${t.toClub}` : ""}
                            {t.effectiveDate
                              ? ` (${new Date(t.effectiveDate).toLocaleDateString()})`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <TeamAvailabilityPanel teamId={id} />

      <TeamCoachingStaffSection teamId={id} />
      <TeamLegendsSection teamId={id} />

      <TeamMatchStatsSection teamId={id} />
      <TeamSeasonStatsSection teamId={id} />

      <div className="cms-card overflow-x-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
          <div>
            <h3 className="font-semibold m-0">Squad history</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-0">
              All players from match squads with aggregated scoring ({players.length}).
            </p>
          </div>
          <button
            type="button"
            disabled={repairingNames}
            onClick={repairPlayerNames}
            className="cms-btn cms-btn--secondary text-xs shrink-0"
          >
            {repairingNames ? "Fixing names…" : "Fix reversed names"}
          </button>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">
            No players mapped yet. Sync Sport365 on a match or map squads in CMS.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3">Position</th>
                <th className="py-2 pr-2 text-center">T</th>
                <th className="py-2 pr-2 text-center">C</th>
                <th className="py-2 pr-2 text-center">P</th>
                <th className="py-2 pr-2 text-center">DG</th>
                <th className="py-2 pr-2 text-center">Pts</th>
                <th className="py-2 pr-3">Nation</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.playerId}
                  className={`border-b border-zinc-800/60 ${p.points > 0 ? "bg-amber-950/20" : ""}`}
                >
                  <td className="py-2 pr-2 font-mono text-zinc-500">{p.jerseyNumber ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/players/${p.playerId}/edit`} className="text-emerald-400">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-zinc-600">{p.fixtureCount} fixtures</span>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{p.positionName ?? "—"}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.tries)}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.conversions)}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.penalties)}</td>
                  <td className="py-2 pr-2 text-center font-mono">{stat(p.dropGoals)}</td>
                  <td className="py-2 pr-2 text-center font-mono text-zinc-200">
                    {p.points > 0 ? p.points : "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400 uppercase text-xs">
                    {p.nationCode ?? p.countryName ?? "—"}
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/admin/transfers`} className="text-xs text-zinc-500">
                      Transfer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
