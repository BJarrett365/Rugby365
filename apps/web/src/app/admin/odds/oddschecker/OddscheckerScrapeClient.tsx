"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";

type MarketPreview = {
  kind: "market";
  sourceUrl: string;
  marketLabel: string;
  competitionName: string | null;
  homeName: string | null;
  awayName: string | null;
  bookmakerCount: number;
  outcomes: Array<{
    name: string;
    bestDecimal: number | null;
    bestFractional: string | null;
    bestBookmakerCodes: string[];
    prices: Array<{
      bookmakerCode: string;
      bookmakerName: string;
      fractional: string | null;
      decimal: number | null;
      impliedProbability: number | null;
    }>;
  }>;
};

type ListingPreview = {
  kind: "listing";
  sourceUrl: string;
  title: string | null;
  matches: Array<{
    sourceUrl: string;
    homeName: string;
    awayName: string;
    competitionName: string | null;
    kickoffLabel: string | null;
    bestHomeFractional: string | null;
    bestDrawFractional: string | null;
    bestAwayFractional: string | null;
  }>;
};

type SnapshotRow = {
  id: string;
  fixtureId: string | null;
  sourceUrl: string;
  marketLabel: string;
  homeName: string | null;
  awayName: string | null;
  competitionName: string | null;
  bookmakerCount: number;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
  impliedHome: number | null;
  impliedDraw: number | null;
  impliedAway: number | null;
  scrapedAt: string;
};

const DEFAULT_LISTING = "https://www.oddschecker.com/rugby-union";
const DEFAULT_MARKET =
  "https://www.oddschecker.com/rugby-union/south-africa/currie-cup/griquas-v-cheetahs/winner";

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function OddscheckerScrapeClient() {
  const [url, setUrl] = useState(DEFAULT_MARKET);
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<MarketPreview | ListingPreview | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshSnapshots() {
    const res = await fetch("/api/admin/odds/oddschecker", { cache: "no-store" });
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
    try {
      const res = await fetch("/api/admin/data-sources/oddschecker/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          html: html.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.preview);
      setStatus(
        data.preview.kind === "market"
          ? `Parsed ${data.preview.outcomes.length} outcomes across ${data.preview.bookmakerCount} bookmakers.`
          : `Found ${data.preview.matches.length} matches on listing.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview || preview.kind !== "market") {
      setStatus("Preview a match /winner market first, then save.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/odds/oddschecker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: preview.sourceUrl,
          html: html.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      setStatus(
        `Saved snapshot ${data.snapshotId}${
          data.fixtureId ? ` · linked fixture ${data.fixtureId}` : " · no fixture linked yet"
        }.`,
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
        title="Oddschecker import"
        description="Pull rugby-union odds into Betting Intelligence. Cloudflare often blocks automated fetch — paste View Source HTML when needed."
      />

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-2">Source</h3>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Listing:{" "}
          <button
            type="button"
            className="text-emerald-400 underline"
            onClick={() => setUrl(DEFAULT_LISTING)}
          >
            /rugby-union
          </button>
          {" · "}
          Market:{" "}
          <button
            type="button"
            className="text-emerald-400 underline"
            onClick={() => setUrl(DEFAULT_MARKET)}
          >
            Griquas v Cheetahs /winner
          </button>
        </p>
        <label className="block text-sm text-zinc-400 mb-1">Oddschecker URL</label>
        <input
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm mb-3"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={DEFAULT_MARKET}
        />
        <label className="block text-sm text-zinc-400 mb-1">
          Optional HTML paste (View Source) — use when fetch is blocked
        </label>
        <textarea
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono min-h-[8rem] mb-3"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="Paste full page HTML here if Cloudflare blocks the server fetch…"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-emerald-700 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => void runPreview()}
          >
            Preview
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-zinc-800 text-sm disabled:opacity-50"
            disabled={busy || preview?.kind !== "market"}
            onClick={() => void runImport()}
          >
            Save market snapshot
          </button>
        </div>
        {status ? <p className="text-sm text-zinc-300 mt-3 mb-0">{status}</p> : null}
        <p className="text-xs text-zinc-600 mt-3 mb-0">
          Respect Oddschecker terms for production use. Prefer commercial/API access for high
          volume. This tool is for internal Betting Intelligence development.
        </p>
      </div>

      {preview?.kind === "listing" ? (
        <div className="cms-card mb-4 overflow-x-auto">
          <h3 className="font-semibold m-0 mb-2">
            Listing · {preview.title ?? "Rugby Union"} ({preview.matches.length})
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Kickoff</th>
                <th className="py-2 pr-3">Home</th>
                <th className="py-2 pr-3">Draw</th>
                <th className="py-2 pr-3">Away</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {preview.matches.map((m) => (
                <tr key={m.sourceUrl} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <span className="text-zinc-200">
                      {m.homeName} v {m.awayName}
                    </span>
                    <span className="block text-xs text-zinc-600">{m.competitionName}</span>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{m.kickoffLabel ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-emerald-400">
                    {m.bestHomeFractional ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">
                    {m.bestDrawFractional ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-emerald-400">
                    {m.bestAwayFractional ?? "—"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-emerald-400"
                      onClick={() => {
                        setUrl(m.sourceUrl);
                        setHtml("");
                        setPreview(null);
                      }}
                    >
                      Load market
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {preview?.kind === "market" ? (
        <div className="cms-card mb-4 overflow-x-auto">
          <h3 className="font-semibold m-0 mb-1">
            {preview.homeName} v {preview.awayName} · {preview.marketLabel}
          </h3>
          <p className="text-sm text-zinc-500 mt-0 mb-3">
            {preview.competitionName} · {preview.bookmakerCount} bookmakers ·{" "}
            <a href={preview.sourceUrl} className="text-emerald-400" target="_blank" rel="noreferrer">
              Open source
            </a>
          </p>
          {preview.outcomes.map((o) => (
            <div key={o.name} className="mb-4">
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <strong className="text-zinc-100">{o.name}</strong>
                <span className="font-mono text-emerald-400">
                  Best {o.bestFractional ?? "—"} ({o.bestDecimal ?? "—"})
                </span>
                <span className="text-xs text-zinc-500">
                  Implied {pct(o.bestDecimal != null ? 1 / o.bestDecimal : null)} ·{" "}
                  {o.bestBookmakerCodes.join(", ") || "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {o.prices.slice(0, 16).map((p) => (
                  <span
                    key={`${o.name}-${p.bookmakerCode}`}
                    className="text-xs font-mono border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300"
                    title={p.bookmakerName}
                  >
                    {p.bookmakerCode} {p.fractional ?? p.decimal ?? "—"}
                  </span>
                ))}
                {o.prices.length > 16 ? (
                  <span className="text-xs text-zinc-600">+{o.prices.length - 16} more</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="cms-card overflow-x-auto">
        <h3 className="font-semibold m-0 mb-2">Recent snapshots</h3>
        {snapshots.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No snapshots saved yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Best H/D/A</th>
                <th className="py-2 pr-3">Implied H/D/A</th>
                <th className="py-2 pr-3">Fixture</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">
                    {new Date(s.scrapedAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-zinc-200">
                      {s.homeName} v {s.awayName}
                    </span>
                    <span className="block text-xs text-zinc-600">{s.competitionName}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-300">
                    {s.bestHomeDecimal?.toFixed(2) ?? "—"} / {s.bestDrawDecimal?.toFixed(2) ?? "—"}{" "}
                    / {s.bestAwayDecimal?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">
                    {pct(s.impliedHome)} / {pct(s.impliedDraw)} / {pct(s.impliedAway)}
                  </td>
                  <td className="py-2 pr-3">
                    {s.fixtureId ? (
                      <Link
                        href={`/admin/matches/${s.fixtureId}/edit`}
                        className="text-emerald-400 text-xs"
                      >
                        Linked
                      </Link>
                    ) : (
                      <span className="text-zinc-600 text-xs">Unlinked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
