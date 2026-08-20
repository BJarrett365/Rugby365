"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type { WorldRankingFeedView } from "@/lib/world-rugby-rankings-service";

type Category = "mru" | "wru";
type Tab = "current" | "history" | "leaders" | "milestones";

type SnapshotMeta = {
  id: string;
  category: string;
  effectiveDate: string;
  sourceProvider: string | null;
  sourceUrl: string | null;
  notes: string | null;
  createdAt: string | null;
  rowCount: number;
};

type LeaderSpan = {
  id: string;
  teamName: string;
  teamCode: string | null;
  teamId: string | null;
  startDate: string;
  endDate: string | null;
  weeks: number | null;
  totalWeeks: number | null;
  reignIndex: number | null;
};

type Milestone = {
  id: string;
  teamName: string;
  teamCode: string | null;
  teamId: string | null;
  milestoneType: string;
  rank: number | null;
  points: number | null;
  yearLabel: string | null;
  achievedOn: string | null;
};

type SnapshotDetail = {
  id: string;
  effectiveDate: string;
  sourceProvider: string | null;
  rows: Array<{
    position: number;
    teamName: string;
    points: number;
    movement: number | null;
    pointsChange: number | null;
    teamId: string | null;
  }>;
};

function formatPoints(value: number): string {
  return value.toFixed(2);
}

function formatMovement(movement: number | null): string {
  if (movement === null) return "—";
  if (movement > 0) return `▲ ${movement}`;
  if (movement < 0) return `▼ ${Math.abs(movement)}`;
  return "—";
}

function formatPointsChange(change: number | null): string {
  if (change === null) return "—";
  const rounded = change.toFixed(2);
  if (change > 0) return `+${rounded}`;
  if (change < 0) return rounded;
  return "0.00";
}

function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "world_rugby":
      return "World Rugby";
    case "wikipedia":
      return "Wikipedia";
    case "rugby365_calc":
      return "Rugby365 calc";
    case "manual":
      return "Manual";
    default:
      return source ?? "—";
  }
}

export default function WorldRankingsAdminPage() {
  const [feeds, setFeeds] = useState<WorldRankingFeedView[]>([]);
  const [category, setCategory] = useState<Category>("mru");
  const [tab, setTab] = useState<Tab>("current");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importingWiki, setImportingWiki] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [leaders, setLeaders] = useState<LeaderSpan[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetail | null>(null);
  const [calcFixtureId, setCalcFixtureId] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);

  const loadFeeds = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/world-rankings");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load rankings");
      setFeeds([]);
    } else {
      setFeeds(data.feeds ?? []);
    }
    setLoading(false);
  }, []);

  const loadHistoryViews = useCallback(async () => {
    const [histRes, leadRes, mileRes] = await Promise.all([
      fetch(`/api/admin/world-rankings/history?category=${category}&view=history`),
      fetch(`/api/admin/world-rankings/history?category=${category}&view=leaders`),
      fetch(`/api/admin/world-rankings/history?category=${category}&view=milestones`),
    ]);
    const hist = await histRes.json();
    const lead = await leadRes.json();
    const mile = await mileRes.json();
    if (histRes.ok) setSnapshots(hist.snapshots ?? []);
    if (leadRes.ok) setLeaders(lead.leaders ?? []);
    if (mileRes.ok) setMilestones(mile.milestones ?? []);
  }, [category]);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  useEffect(() => {
    if (tab === "current") return;
    void loadHistoryViews();
  }, [tab, loadHistoryViews]);

  useEffect(() => {
    if (!selectedSnapshotId) {
      setSnapshotDetail(null);
      return;
    }
    void (async () => {
      const res = await fetch(
        `/api/admin/world-rankings/history?snapshotId=${selectedSnapshotId}`,
      );
      const data = await res.json();
      if (res.ok) setSnapshotDetail(data.snapshot ?? null);
    })();
  }, [selectedSnapshotId]);

  const activeFeed = useMemo(
    () => feeds.find((feed) => feed.category === category) ?? null,
    [feeds, category],
  );

  const sync = async (target: Category | "all") => {
    setSyncing(true);
    setError("");
    setStatus("");
    const res = await fetch("/api/admin/world-rankings/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: target }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sync failed");
    } else {
      setStatus("World Rugby sync complete.");
      await loadFeeds();
      await loadHistoryViews();
    }
    setSyncing(false);
  };

  const importWikipedia = async () => {
    setImportingWiki(true);
    setError("");
    setStatus("");
    const res = await fetch("/api/admin/world-rankings/wikipedia-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Wikipedia import failed");
    } else {
      setStatus(
        `Wikipedia import: ${data.leaderSpansUpserted ?? 0} leader spans, ${data.milestonesUpserted ?? 0} milestones, ${data.currentRowsUpserted ?? 0} current rows (as of ${data.asOfDate ?? "—"}).`,
      );
      await loadHistoryViews();
      setTab("leaders");
    }
    setImportingWiki(false);
  };

  const applyCalc = async () => {
    if (!calcFixtureId.trim()) return;
    setCalcBusy(true);
    setError("");
    setStatus("");
    const res = await fetch("/api/admin/world-rankings/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "apply",
        fixtureId: calcFixtureId.trim(),
        category,
        force: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Calculation failed");
    } else if (!data.applied) {
      setStatus(`Not applied: ${data.reason}`);
    } else {
      setStatus(
        `Calculated snapshot ${data.effectiveDate}: home ${data.homeDelta >= 0 ? "+" : ""}${data.homeDelta}, away ${data.awayDelta >= 0 ? "+" : ""}${data.awayDelta}${data.noExchange ? " (no exchange)" : ""}.`,
      );
      await loadFeeds();
      await loadHistoryViews();
      setTab("history");
    }
    setCalcBusy(false);
  };

  const milestonesByTeam = useMemo(() => {
    const map = new Map<
      string,
      {
        teamName: string;
        teamId: string | null;
        bestRank?: Milestone;
        worstRank?: Milestone;
        peakPoints?: Milestone;
        troughPoints?: Milestone;
      }
    >();
    for (const m of milestones) {
      const cur = map.get(m.teamName) ?? {
        teamName: m.teamName,
        teamId: m.teamId,
      };
      if (m.milestoneType === "best_rank") cur.bestRank = m;
      if (m.milestoneType === "worst_rank") cur.worstRank = m;
      if (m.milestoneType === "peak_points") cur.peakPoints = m;
      if (m.milestoneType === "trough_points") cur.troughPoints = m;
      map.set(m.teamName, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [milestones]);

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="World Rugby rankings"
        description="Official Pulselive sync, Wikipedia historical movements, and Rugby365 post-match calculation."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cms-btn cms-btn--secondary touch-target"
              disabled={importingWiki || syncing}
              onClick={() => void importWikipedia()}
            >
              {importingWiki ? "Importing…" : "Import Wikipedia"}
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary touch-target"
              disabled={syncing}
              onClick={() => void sync(category)}
            >
              {syncing ? "Syncing…" : `Sync ${category === "mru" ? "men's" : "women's"}`}
            </button>
            <button
              type="button"
              className="cms-btn touch-target"
              disabled={syncing}
              onClick={() => void sync("all")}
            >
              Sync all (WR)
            </button>
          </div>
        }
      />

      <div className="cms-card space-y-5 mb-4">
        <p className="text-sm text-zinc-400 m-0">
          Live tables sync from{" "}
          <a
            href="https://www.world.rugby/rankings"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            world.rugby/rankings
          </a>
          . Historical #1 reigns, best/worst ranks, and peak ratings come from{" "}
          <a
            href="https://en.wikipedia.org/wiki/World_Rugby_Rankings"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Wikipedia
          </a>
          . After international full-time, Rugby365 can calculate the next points exchange and store
          a dated snapshot for coaches and other consumers.
        </p>

        {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}
        {status ? <p className="text-emerald-400 text-sm m-0">{status}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`cms-btn touch-target ${category === "mru" ? "" : "cms-btn--secondary"}`}
            onClick={() => setCategory("mru")}
          >
            Men&apos;s
          </button>
          <button
            type="button"
            className={`cms-btn touch-target ${category === "wru" ? "" : "cms-btn--secondary"}`}
            onClick={() => setCategory("wru")}
          >
            Women&apos;s
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
          {(
            [
              ["current", "Current"],
              ["history", "History"],
              ["leaders", "#1 Leaders"],
              ["milestones", "Milestones"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`cms-btn touch-target ${tab === id ? "" : "cms-btn--secondary"}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "current" ? (
          loading ? (
            <p className="m-0">Loading…</p>
          ) : activeFeed ? (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm m-0">
                <div>
                  <dt className="text-zinc-500">Label</dt>
                  <dd className="m-0 font-medium">{activeFeed.label}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Effective date</dt>
                  <dd className="m-0 font-medium">{activeFeed.effectiveDate ?? "Not synced"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Last synced</dt>
                  <dd className="m-0 font-medium">
                    {activeFeed.syncedAt
                      ? new Date(activeFeed.syncedAt).toLocaleString()
                      : "Not synced"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Rows</dt>
                  <dd className="m-0 font-medium">{activeFeed.rowCount}</dd>
                </div>
              </dl>

              <div className="rounded-md border border-zinc-800 p-3 space-y-2">
                <p className="text-sm text-zinc-400 m-0">
                  Calculate from a completed international fixture (points exchange → dated
                  snapshot).
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    className="cms-input min-w-[280px]"
                    placeholder="Fixture UUID"
                    value={calcFixtureId}
                    onChange={(e) => setCalcFixtureId(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cms-btn cms-btn--secondary touch-target"
                    disabled={calcBusy || !calcFixtureId.trim()}
                    onClick={() => void applyCalc()}
                  >
                    {calcBusy ? "Calculating…" : "Apply calculation"}
                  </button>
                </div>
              </div>

              {activeFeed.rowCount === 0 ? (
                <p className="text-sm text-zinc-400 m-0">
                  No rankings stored yet. Sync World Rugby or import Wikipedia.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="cms-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Team</th>
                        <th>Pts</th>
                        <th>Change</th>
                        <th>Move</th>
                        <th>CMS team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFeed.rows.map((row) => (
                        <tr key={row.worldRugbyTeamId}>
                          <td>{row.position}</td>
                          <td>
                            <strong>{row.teamName}</strong>
                            {row.teamAbbreviation ? (
                              <span className="text-zinc-500"> ({row.teamAbbreviation})</span>
                            ) : null}
                          </td>
                          <td>{formatPoints(row.points)}</td>
                          <td>{formatPointsChange(row.pointsChange)}</td>
                          <td>{formatMovement(row.movement)}</td>
                          <td>
                            {row.teamId && row.teamSlug ? (
                              <Link
                                href={`/admin/teams/${row.teamId}/edit`}
                                className="text-emerald-400 hover:underline"
                              >
                                {row.teamSlug}
                              </Link>
                            ) : (
                              <span className="text-zinc-500">Unlinked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null
        ) : null}

        {tab === "history" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="cms-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-zinc-500">
                        No snapshots yet. Sync World Rugby or import Wikipedia.
                      </td>
                    </tr>
                  ) : (
                    snapshots.map((snap) => (
                      <tr
                        key={snap.id}
                        className={selectedSnapshotId === snap.id ? "bg-zinc-900/60" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className="text-emerald-400 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                            onClick={() => setSelectedSnapshotId(snap.id)}
                          >
                            {snap.effectiveDate}
                          </button>
                        </td>
                        <td>{sourceLabel(snap.sourceProvider)}</td>
                        <td>{snap.rowCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div>
              {snapshotDetail ? (
                <>
                  <p className="text-sm m-0 mb-2">
                    <strong>{snapshotDetail.effectiveDate}</strong> ·{" "}
                    {sourceLabel(snapshotDetail.sourceProvider)} · {snapshotDetail.rows.length}{" "}
                    teams
                  </p>
                  <div className="overflow-x-auto max-h-[480px]">
                    <table className="cms-table w-full text-sm">
                      <thead>
                        <tr>
                          <th>Pos</th>
                          <th>Team</th>
                          <th>Pts</th>
                          <th>Move</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshotDetail.rows.map((row) => (
                          <tr key={`${row.position}-${row.teamName}`}>
                            <td>{row.position}</td>
                            <td>{row.teamName}</td>
                            <td>{formatPoints(row.points)}</td>
                            <td>{formatMovement(row.movement)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500 m-0">Select a snapshot date to inspect rows.</p>
              )}
            </div>
          </div>
        ) : null}

        {tab === "leaders" ? (
          <div className="overflow-x-auto">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Weeks</th>
                  <th>Total weeks</th>
                </tr>
              </thead>
              <tbody>
                {leaders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-zinc-500">
                      No leader spans yet. Run Import Wikipedia.
                    </td>
                  </tr>
                ) : (
                  leaders.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.teamName}</strong>
                        {row.reignIndex ? (
                          <span className="text-zinc-500"> ({row.reignIndex})</span>
                        ) : null}
                      </td>
                      <td>{row.startDate}</td>
                      <td>{row.endDate ?? "Present"}</td>
                      <td>{row.weeks ?? "—"}</td>
                      <td>{row.totalWeeks ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "milestones" ? (
          <div className="overflow-x-auto">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Best</th>
                  <th>Worst</th>
                  <th>Peak pts</th>
                  <th>Trough pts</th>
                </tr>
              </thead>
              <tbody>
                {milestonesByTeam.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-zinc-500">
                      No milestones yet. Run Import Wikipedia.
                    </td>
                  </tr>
                ) : (
                  milestonesByTeam.map((row) => (
                    <tr key={row.teamName}>
                      <td>
                        <strong>{row.teamName}</strong>
                      </td>
                      <td>
                        {row.bestRank?.rank != null ? `#${row.bestRank.rank}` : "—"}
                        {row.bestRank?.yearLabel ? (
                          <span className="text-zinc-500"> ({row.bestRank.yearLabel})</span>
                        ) : null}
                      </td>
                      <td>
                        {row.worstRank?.rank != null ? `#${row.worstRank.rank}` : "—"}
                        {row.worstRank?.yearLabel ? (
                          <span className="text-zinc-500"> ({row.worstRank.yearLabel})</span>
                        ) : null}
                      </td>
                      <td>
                        {row.peakPoints?.points != null
                          ? formatPoints(row.peakPoints.points)
                          : "—"}
                        {row.peakPoints?.achievedOn ? (
                          <span className="text-zinc-500"> · {row.peakPoints.achievedOn}</span>
                        ) : null}
                      </td>
                      <td>
                        {row.troughPoints?.points != null
                          ? formatPoints(row.troughPoints.points)
                          : "—"}
                        {row.troughPoints?.achievedOn ? (
                          <span className="text-zinc-500"> · {row.troughPoints.achievedOn}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
