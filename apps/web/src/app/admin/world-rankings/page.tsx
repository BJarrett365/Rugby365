"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type { WorldRankingFeedView } from "@/lib/world-rugby-rankings-service";

type Category = "mru" | "wru";

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

export default function WorldRankingsAdminPage() {
  const [feeds, setFeeds] = useState<WorldRankingFeedView[]>([]);
  const [category, setCategory] = useState<Category>("mru");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
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

  useEffect(() => {
    void load();
  }, [load]);

  const activeFeed = useMemo(
    () => feeds.find((feed) => feed.category === category) ?? null,
    [feeds, category],
  );

  const sync = async (target: Category | "all") => {
    setSyncing(true);
    setError("");
    const res = await fetch("/api/admin/world-rankings/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: target }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sync failed");
    } else {
      await load();
    }
    setSyncing(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="World Rugby rankings"
        description="Sync men's and women's World Rugby rankings from the official Pulselive feed used on world.rugby."
        actions={
          <div className="flex flex-wrap gap-2">
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
              Sync all
            </button>
          </div>
        }
      />

      <div className="cms-card space-y-5 mb-4">
        <p className="text-sm text-zinc-400 m-0">
          Data is fetched from{" "}
          <a
            href="https://www.world.rugby/rankings"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            world.rugby/rankings
          </a>{" "}
          via the public Pulselive RIMS API. Teams are matched or created in the CMS using World
          Rugby nation IDs.
        </p>

        {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}

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

        {loading ? (
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

            {activeFeed.rowCount === 0 ? (
              <p className="text-sm text-zinc-400 m-0">
                No rankings stored yet. Run sync to pull the latest table from World Rugby.
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
        ) : null}
      </div>
    </>
  );
}
