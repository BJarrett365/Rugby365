"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type CatalogSummary = {
  uniquePlayers: number;
  rawEntries: number;
  withCollections: number;
};

type SeedResult = {
  total: number;
  processed: number;
  linked: number;
  created: number;
  membershipAdded: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  items: Array<{
    name: string;
    playerSlug: string | null;
    action: string;
    message?: string;
  }>;
};

type LegendRow = {
  id: string;
  playerName: string;
  playerSlug: string;
  era: string | null;
  legendLevelLabel: string;
  countryName: string | null;
  legendStatus: string;
};

export default function AdminLegendsPage() {
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [legends, setLegends] = useState<LegendRow[]>([]);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [enrichWikipedia, setEnrichWikipedia] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, listRes] = await Promise.all([
        fetch("/api/admin/legends?catalog=1"),
        fetch("/api/admin/legends?legendStatus=active"),
      ]);
      const catalogData = await catalogRes.json();
      const listData = await listRes.json();
      if (!catalogRes.ok) throw new Error(catalogData.error || "Failed to load catalog");
      if (!listRes.ok) throw new Error(listData.error || "Failed to load legends");
      setSummary(catalogData.summary ?? null);
      setLegends(listData.legends ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSeed(dryRun: boolean) {
    setSeeding(true);
    setError(null);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/legends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "seed",
          dryRun,
          limit,
          enrichWikipedia: dryRun ? false : enrichWikipedia,
          delayMs: 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      setSeedResult(data as SeedResult);
      if (!dryRun) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  async function runAction(action: "seed_coaches" | "recalculate_scores") {
    setSeeding(true);
    setError(null);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/legends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          dryRun: false,
          enrichWikipedia,
          limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setSeedResult({
        total: data.total ?? data.processed ?? 0,
        processed: data.processed ?? data.updated ?? 0,
        linked: data.linked ?? 0,
        created: data.created ?? 0,
        membershipAdded: data.membershipAdded ?? 0,
        skipped: 0,
        failed: data.failed ?? 0,
        dryRun: false,
        items: data.items ?? [
          {
            name: action,
            playerSlug: null,
            action: "done",
            message: JSON.stringify(data),
          },
        ],
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="cms-page">
      <PageHeader
        title="Legends"
        description="Planet Rugby Legends database — resolve or create player profiles, then attach legend membership. Public hub: /legends"
      />

      <div className="cms-card mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold m-0">Catalog seed</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-0">
              Links existing profiles first (no duplicates). Creates missing players, sets{" "}
              <code>careerStatus=legend</code>, enriches from Wikipedia when enabled.
            </p>
            {summary ? (
              <p className="text-sm text-zinc-400 mt-2 mb-0">
                Catalog: {summary.uniquePlayers} unique players · {summary.rawEntries} era rows ·{" "}
                {summary.withCollections} in collections
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              Batch
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 20)}
                className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1"
              />
            </label>
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={enrichWikipedia}
                onChange={(e) => setEnrichWikipedia(e.target.checked)}
              />
              Wikipedia enrich
            </label>
            <button
              type="button"
              className="cms-btn cms-btn--secondary"
              disabled={seeding}
              onClick={() => void runSeed(true)}
            >
              Dry run
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={seeding}
              onClick={() => void runSeed(false)}
            >
              {seeding ? "Seeding…" : "Seed legends"}
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary"
              disabled={seeding}
              onClick={() => void runAction("seed_coaches")}
            >
              Seed coaches
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary"
              disabled={seeding}
              onClick={() => void runAction("recalculate_scores")}
            >
              Recalculate scores
            </button>
            <Link href="/legends" className="cms-btn cms-btn--secondary">
              Open public hub
            </Link>
          </div>
        </div>

        {error ? <p className="text-sm text-red-400 mt-3 mb-0">{error}</p> : null}
        {seedResult ? (
          <div className="mt-3 text-sm text-zinc-300">
            <p className="m-0 text-emerald-400/90">
              {seedResult.dryRun ? "Dry run" : "Seed"} complete — processed {seedResult.processed}/
              {seedResult.total}: linked {seedResult.linked}, created {seedResult.created},
              memberships {seedResult.membershipAdded}, failed {seedResult.failed}
            </p>
            <ul className="mt-2 max-h-64 overflow-auto text-xs text-zinc-500 list-disc pl-5">
              {seedResult.items.slice(0, 40).map((item) => (
                <li key={`${item.name}-${item.action}`}>
                  <strong className="text-zinc-300">{item.name}</strong> — {item.action}
                  {item.playerSlug ? (
                    <>
                      {" "}
                      →{" "}
                      <Link href={`/players/${item.playerSlug}`} className="text-sky-400">
                        /players/{item.playerSlug}
                      </Link>
                    </>
                  ) : null}
                  {item.message ? ` · ${item.message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">
          Active legend memberships {loading ? "" : `(${legends.length})`}
        </h3>
        {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        {!loading && legends.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No active legends yet. Run Seed legends.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Era</th>
                  <th>Level</th>
                  <th>Nation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {legends.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/players/${row.playerSlug}`} className="text-sky-400">
                        {row.playerName}
                      </Link>
                    </td>
                    <td>{row.era ?? "—"}</td>
                    <td>{row.legendLevelLabel}</td>
                    <td>{row.countryName ?? "—"}</td>
                    <td>{row.legendStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
