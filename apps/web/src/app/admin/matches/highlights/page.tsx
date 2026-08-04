"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Channel = {
  key: string;
  label: string;
  handle: string;
  channelId: string;
  competitionSlugs: string[];
};

type SyncMatch = {
  videoId: string;
  title: string;
  homeName: string;
  awayName: string;
  roundHint?: string | null;
  watchUrl: string;
  fixtureId: string | null;
  assigned: boolean;
  reason?: string;
};

type SyncResult = {
  channelLabel: string;
  videosParsed: number;
  highlightVideos: number;
  matched: number;
  assigned: number;
  skippedExisting: number;
  unmatched: number;
  matches: SyncMatch[];
  message?: string;
};

export default function MatchHighlightsImportPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelKey, setChannelKey] = useState("npc");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    fetch("/api/admin/matches/highlights")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.channels) && data.channels.length) {
          setChannels(data.channels);
          setChannelKey(data.channels[0].key);
        }
      })
      .catch(() => setError("Failed to load channels"));
  }, []);

  async function run(action: "preview" | "sync") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/matches/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, channelKey, overwrite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Request failed");
        setResult(null);
      } else {
        setMessage(data.message ?? "Done.");
        setResult({
          channelLabel: data.channelLabel,
          videosParsed: data.videosParsed ?? 0,
          highlightVideos: data.highlightVideos ?? 0,
          matched: data.matched ?? 0,
          assigned: data.assigned ?? 0,
          skippedExisting: data.skippedExisting ?? 0,
          unmatched: data.unmatched ?? 0,
          matches: Array.isArray(data.matches) ? data.matches : [],
          message: data.message,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
    setBusy(false);
  }

  const selected = channels.find((c) => c.key === channelKey);

  return (
    <>
      <PageHeader
        eyebrow="Matches"
        title="Match highlights"
        description="Scrape YouTube channel feeds and assign full-match highlights onto existing fixtures. NPC uses @NZProvincialRugby — add more league channels as you find them."
        actions={
          <Link href="/admin/matches" className="cms-btn cms-btn--secondary touch-target">
            Matches
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <label className="block text-sm">
          <span className="text-zinc-400">Channel / league</span>
          <select
            className="cms-select w-full mt-1"
            value={channelKey}
            onChange={(e) => setChannelKey(e.target.value)}
          >
            {channels.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.handle})
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <p className="text-sm text-zinc-500 m-0">
            Feed:{" "}
            <a
              href={`https://www.youtube.com/${selected.handle}/videos`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              youtube.com/{selected.handle}
            </a>
            {" · "}
            competition slugs: {selected.competitionSlugs.join(", ")}
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          Overwrite fixtures that already have highlights
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary touch-target"
            disabled={busy || !channelKey}
            onClick={() => void run("preview")}
          >
            {busy ? "Working…" : "Preview"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary touch-target"
            disabled={busy || !channelKey}
            onClick={() => {
              if (!confirm(`Assign YouTube highlights for ${selected?.label ?? channelKey} onto matching fixtures?`)) {
                return;
              }
              void run("sync");
            }}
          >
            {busy ? "Assigning…" : "Assign to fixtures"}
          </button>
        </div>

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}

        {result ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-2">
            <p className="m-0 text-zinc-300">
              {result.videosParsed} videos · {result.highlightVideos} highlights ·{" "}
              {result.matched} matched · {result.assigned} assigned · {result.skippedExisting}{" "}
              skipped · {result.unmatched} unmatched
            </p>
            <ul className="m-0 pl-4 space-y-1 text-zinc-500 max-h-72 overflow-y-auto">
              {result.matches.map((row) => (
                <li key={row.videoId}>
                  <a
                    href={row.watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    {row.homeName} v {row.awayName}
                  </a>
                  {row.roundHint ? (
                    <span className="text-zinc-600"> · {row.roundHint}</span>
                  ) : null}
                  {row.assigned ? (
                    <span className="text-emerald-500"> · assigned</span>
                  ) : row.fixtureId ? (
                    <span className="text-zinc-500"> · {row.reason ?? "skipped"}</span>
                  ) : (
                    <span className="text-amber-500"> · {row.reason ?? "unmatched"}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-zinc-600 m-0">
          Only titles like <code className="text-zinc-400">RD 1 HIGHLIGHTS: Home v Away (Hilux NPC…)</code>{" "}
          are used. Clip packages and feature videos are ignored. Never creates fixtures.
        </p>
      </div>
    </>
  );
}
