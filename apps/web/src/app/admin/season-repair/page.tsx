"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type {
  SeasonRepairPreview,
  SeasonRepairRow,
} from "@/lib/season-repair-service";

type CompStat = {
  competitionId: string;
  competitionName: string;
  competitionType: string | null;
  totalFixtures: number;
  nullSeasonCount: number;
};

export default function SeasonRepairPage() {
  const [comps, setComps] = useState<CompStat[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preview, setPreview] = useState<SeasonRepairPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/season-repair?stats=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setComps(data.competitions ?? []);
      })
      .catch(() => setError("Failed to load competition stats"));
  }, []);

  const runPreview = useCallback(async () => {
    if (!competitionId) {
      setError("Select a competition");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const sp = new URLSearchParams({ competitionId, onlyProblems: "1" });
      if (fromDate) sp.set("from", fromDate);
      if (toDate) sp.set("to", toDate);
      const res = await fetch(`/api/admin/season-repair?${sp.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, [competitionId, fromDate, toDate]);

  const applySafe = useCallback(async () => {
    if (!competitionId || !preview?.summary.safeToApply) return;
    if (
      !window.confirm(
        `Apply ${preview.summary.safeToApply} safe season repair(s)? Fixture IDs and mappings will not change.`,
      )
    ) {
      return;
    }
    setApplying(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/season-repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId,
          fromDate: fromDate || null,
          toDate: toDate || null,
          confirmApply: true,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setMessage(`Applied ${data.applied} repair(s); skipped ${data.skipped}.`);
      await runPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }, [competitionId, fromDate, toDate, preview, runPreview]);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Season repair"
        description="Preview fixture season fixes by competition. Apply only unique high-confidence matches. Unmapped rows stay for review."
      />

      <div className="cms-card space-y-4 mb-6">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block text-sm">
            <span className="text-zinc-400">Competition</span>
            <select
              className="mt-1 w-full"
              value={competitionId}
              onChange={(e) => {
                setCompetitionId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Select…</option>
              {comps.map((c) => (
                <option key={c.competitionId} value={c.competitionId}>
                  {c.competitionName} — {c.nullSeasonCount} null / {c.totalFixtures}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">From (optional)</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">To (optional)</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" className="cms-btn" disabled={loading || !competitionId} onClick={() => void runPreview()}>
              {loading ? "Preview…" : "Preview"}
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={applying || !preview?.summary.safeToApply}
              onClick={() => void applySafe()}
            >
              {applying ? "Applying…" : `Apply safe (${preview?.summary.safeToApply ?? 0})`}
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
      </div>

      {preview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4 text-sm">
            <Stat label="Problem rows" value={preview.summary.total} />
            <Stat label="Missing (safe)" value={preview.summary.missingSafe} />
            <Stat label="Wrong (safe)" value={preview.summary.wrongSafe} />
            <Stat label="Review" value={preview.summary.review} />
            <Stat label="Unmapped" value={preview.summary.unmapped} />
            <Stat label="Safe to apply" value={preview.summary.safeToApply} />
          </div>
          <div className="cms-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-2">Fixture</th>
                  <th className="py-2 pr-2">Kick-off</th>
                  <th className="py-2 pr-2">Current</th>
                  <th className="py-2 pr-2">Proposed</th>
                  <th className="py-2 pr-2">Class</th>
                  <th className="py-2 pr-2">Conf</th>
                  <th className="py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((row) => (
                  <RepairRow key={row.fixtureId} row={row} />
                ))}
              </tbody>
            </table>
            {preview.rows.length > 200 ? (
              <p className="text-xs text-zinc-500 mt-2 mb-0">Showing first 200 of {preview.rows.length} rows.</p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Select a competition and run Preview before applying any repairs.</p>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}

function RepairRow({ row }: { row: SeasonRepairRow }) {
  return (
    <tr className="border-b border-zinc-900/80">
      <td className="py-2 pr-2">
        <Link href={`/admin/matches/${row.fixtureId}/edit`} className="text-[var(--cms-accent)]">
          {row.slug}
        </Link>
      </td>
      <td className="py-2 pr-2 whitespace-nowrap text-zinc-400">
        {row.kickoffAt ? row.kickoffAt.slice(0, 16).replace("T", " ") : "—"}
      </td>
      <td className="py-2 pr-2">{row.currentSeasonLabel ?? "—"}</td>
      <td className="py-2 pr-2">{row.proposedSeasonLabel ?? "—"}</td>
      <td className="py-2 pr-2">
        <span className={row.safeToApply ? "text-emerald-400" : "text-amber-300"}>{row.classification}</span>
      </td>
      <td className="py-2 pr-2">{row.confidence}</td>
      <td className="py-2 text-zinc-500">{row.reason}</td>
    </tr>
  );
}
