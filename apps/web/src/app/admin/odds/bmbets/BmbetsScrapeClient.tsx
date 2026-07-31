"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type ListingMatch = {
  sourceUrl: string;
  homeName: string;
  awayName: string;
  competitionName: string | null;
  dayLabel: string | null;
  kickoffLabel: string | null;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
  bookmakerCount: number | null;
  rejectedAsLeague: boolean;
  rejectReason: string | null;
};

type ListingPreview = {
  kind: "listing";
  sourceUrl: string;
  title: string | null;
  unionMatches: ListingMatch[];
  rejectedLeagueMatches: ListingMatch[];
};

type SnapshotRow = {
  id: string;
  fixtureId: string | null;
  sourceUrl: string;
  marketLabel: string | null;
  homeName: string | null;
  awayName: string | null;
  competitionName: string | null;
  bookmakerCount: number;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
  scrapedAt: string;
};

const DEFAULT_LISTING =
  "https://www.bmbets.com/rugby-union/south-africa/currie-cup-1st-division/";
const DEFAULT_MATCH =
  "https://www.bmbets.com/rugby-union/south-africa/currie-cup-1st-division/griquas-v-free-state-cheetahs-9690855/";
const HUB = "https://www.bmbets.com/matches/rugby-union/";

export function BmbetsScrapeClient() {
  const [url, setUrl] = useState(DEFAULT_LISTING);
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<ListingPreview | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastImport, setLastImport] = useState<{
    imported: number;
    skipped: number;
    rejected: number;
  } | null>(null);

  async function refreshSnapshots() {
    const res = await fetch("/api/admin/odds/bmbets", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSnapshots((data.snapshots as SnapshotRow[]) ?? []);
  }

  useEffect(() => {
    refreshSnapshots().catch(() => undefined);
  }, []);

  async function runPreview() {
    setBusy(true);
    setStatus(null);
    setPreview(null);
    setLastImport(null);
    try {
      const res = await fetch("/api/admin/data-sources/bmbets/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, html: html.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Preview failed");
      if (data.preview?.kind !== "listing") {
        throw new Error("Unexpected preview shape — expected a listing of Union matches.");
      }
      setPreview(data.preview);
      setStatus(
        `Union matches: ${data.preview.unionMatches.length} · Rejected League: ${data.preview.rejectedLeagueMatches.length}`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/odds/bmbets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          html: html.trim() || undefined,
          action: "import",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.preview?.kind === "listing") setPreview(data.preview);
      setLastImport({
        imported: data.imported?.length ?? 0,
        skipped: data.skippedNoFixture?.length ?? 0,
        rejected: data.rejectedLeague?.length ?? 0,
      });
      setStatus(
        `Imported ${data.imported?.length ?? 0} linked fixtures · skipped ${data.skippedNoFixture?.length ?? 0} (no CMS match) · rejected ${data.rejectedLeague?.length ?? 0} League.`,
      );
      await refreshSnapshots();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-5xl">
      <PageHeader
        eyebrow="Odds"
        title="BMbets Rugby Union import"
        description="Primary Rugby365 odds importer. Multi-bookmaker consensus from bmbets.com — Rugby Union only, League contaminants rejected, saved only when linked to a CMS fixture."
      />

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-2">Source</h3>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Prefer competition pages, or paste a single match URL (odds are taken from the parent listing).{" "}
          <button type="button" className="text-emerald-400 underline" onClick={() => setUrl(DEFAULT_LISTING)}>
            Currie Cup listing
          </button>
          {" · "}
          <button type="button" className="text-emerald-400 underline" onClick={() => setUrl(DEFAULT_MATCH)}>
            Griquas v Cheetahs
          </button>
          {" · "}
          <button
            type="button"
            className="text-emerald-400 underline"
            onClick={() => setUrl("https://www.bmbets.com/rugby-union/new-zealand/npc/")}
          >
            NZ NPC
          </button>
          {" · "}
          <button type="button" className="text-emerald-400 underline" onClick={() => setUrl(HUB)}>
            /matches/rugby-union/
          </button>
        </p>
        <label className="block text-sm text-zinc-400 mb-1">BMbets URL</label>
        <input
          className="cms-input w-full mb-3"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.bmbets.com/rugby-union/…"
        />
        <label className="block text-sm text-zinc-400 mb-1">
          Optional HTML paste (View Source) if fetch is blocked
        </label>
        <textarea
          className="cms-input w-full min-h-[8rem] mb-3 font-mono text-xs"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="Paste competition page HTML…"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cms-btn cms-btn--secondary text-sm" disabled={busy} onClick={() => void runPreview()}>
            Preview
          </button>
          <button type="button" className="cms-btn cms-btn--primary text-sm" disabled={busy} onClick={() => void runImport()}>
            Import linked Union fixtures only
          </button>
        </div>
        {status ? <p className="text-sm text-zinc-300 mt-3 mb-0">{status}</p> : null}
        {lastImport ? (
          <p className="text-xs text-zinc-500 mt-2 mb-0">
            Last run — imported {lastImport.imported}, skipped {lastImport.skipped}, rejected League{" "}
            {lastImport.rejected}.
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="cms-card mb-4 overflow-x-auto">
          <h3 className="font-semibold m-0 mb-2">
            Preview — {preview.title ?? "Listing"} ({preview.unionMatches.length} Union)
          </h3>
          {preview.rejectedLeagueMatches.length > 0 ? (
            <p className="text-sm text-amber-400/90 mt-0 mb-3">
              Rejected {preview.rejectedLeagueMatches.length} Rugby League row(s) misfiled under Union
              {preview.rejectedLeagueMatches[0]?.rejectReason
                ? ` — e.g. ${preview.rejectedLeagueMatches[0].rejectReason}`
                : ""}
              .
            </p>
          ) : null}
          <table className="cms-table w-full text-sm">
            <thead>
              <tr>
                <th>Kickoff</th>
                <th>Match</th>
                <th>Comp</th>
                <th>1</th>
                <th>X</th>
                <th>2</th>
                <th>B&apos;s</th>
              </tr>
            </thead>
            <tbody>
              {preview.unionMatches.map((m) => (
                <tr key={m.sourceUrl}>
                  <td className="whitespace-nowrap text-zinc-400">
                    {[m.dayLabel, m.kickoffLabel].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td>
                    {m.homeName} v {m.awayName}
                  </td>
                  <td>{m.competitionName ?? "—"}</td>
                  <td>{m.bestHomeDecimal ?? "—"}</td>
                  <td>{m.bestDrawDecimal ?? "—"}</td>
                  <td>{m.bestAwayDecimal ?? "—"}</td>
                  <td>{m.bookmakerCount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="cms-card overflow-x-auto">
        <h3 className="font-semibold m-0 mb-2">Recent BMbets snapshots (CMS-linked only)</h3>
        {snapshots.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No BMbets snapshots yet.</p>
        ) : (
          <table className="cms-table w-full text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Match</th>
                <th>1 / X / 2</th>
                <th>Fixture</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap text-zinc-400">
                    {new Date(s.scrapedAt).toLocaleString()}
                  </td>
                  <td>
                    {s.homeName} v {s.awayName}
                    <div className="text-xs text-zinc-500">{s.competitionName}</div>
                  </td>
                  <td>
                    {s.bestHomeDecimal ?? "—"} / {s.bestDrawDecimal ?? "—"} / {s.bestAwayDecimal ?? "—"}
                  </td>
                  <td className="font-mono text-xs">{s.fixtureId ? s.fixtureId.slice(0, 8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
