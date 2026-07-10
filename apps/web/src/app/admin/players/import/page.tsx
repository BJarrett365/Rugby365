"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

const DEFAULT_URL = "https://www.rugbypass.com/players/pierre-schoeman/";

const EXAMPLE_PLAYERS = [
  { name: "Pierre Schoeman", slug: "pierre-schoeman" },
  { name: "Adam Brocklebank", slug: "adam-brocklebank" },
  { name: "Finn Russell", slug: "finn-russell" },
  { name: "Antoine Dupont", slug: "antoine-dupont" },
] as const;

type PlayerPreview = {
  kind: "player";
  slug: string;
  sourceUrl: string;
  displayName: string;
  nationality: string | null;
  age: number | null;
  birthDate: string | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  currentTeam: string | null;
  imageUrl: string | null;
  rugbypassPlayerId: string | null;
  seasonStatCount: number;
  recentMatchCount: number;
  recentMatches: Array<{
    matchTitle: string;
    competitionName: string;
    kickoffAt: string;
    minutesPlayed: number;
    tries: number;
    points: number;
  }>;
  seasonStats: Array<{
    competitionName: string;
    seasonLabel: string;
    gamesPlayed: number | null;
    tries: number | null;
    points: number | null;
  }>;
  existingPlayer: { id: string; name: string } | null;
  conflict: { id: string; name: string } | null;
};

export default function ImportRugbyPassPlayerPage() {
  const router = useRouter();
  const [url, setUrl] = useState(DEFAULT_URL);
  const [selectedSlug, setSelectedSlug] = useState("pierre-schoeman");
  const [preview, setPreview] = useState<PlayerPreview | null>(null);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function loadPreview(nextUrl?: string) {
    const targetUrl = (nextUrl ?? url).trim();
    if (!targetUrl) return;

    setFetching(true);
    setError("");
    setStatusMessage("Fetching RugbyPass profile…");

    try {
      const qs = new URLSearchParams({ url: targetUrl });
      const res = await fetch(`/api/admin/data-sources/rugbypass/parse?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        setPreview(null);
        setStatusMessage("");
        return;
      }
      setPreview(data as PlayerPreview);
      setStatusMessage(`Loaded ${data.displayName} from RugbyPass`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
      setPreview(null);
      setStatusMessage("");
    } finally {
      setFetching(false);
    }
  }

  function selectExample(slug: string) {
    const nextUrl = `https://www.rugbypass.com/players/${slug}/`;
    setSelectedSlug(slug);
    setUrl(nextUrl);
    setPreview(null);
    setError("");
    void loadPreview(nextUrl);
  }

  async function runImport() {
    setImporting(true);
    setError("");
    const res = await fetch("/api/admin/players/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceUrl: url.trim(),
        linkPlayerId: preview?.existingPlayer?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.reason ?? "Import failed");
      setImporting(false);
      return;
    }

    const created = data.created ? "Created" : "Updated";
    alert(
      `${created} player · ` +
        `${data.fieldsUpdated?.length ?? 0} profile fields · ` +
        `${data.matchesImported ?? 0} new external matches · ` +
        `${data.matchesLinked ?? 0} linked to fixtures`,
    );
    router.push(`/admin/players/${data.playerId}/edit`);
    setImporting(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Import player from RugbyPass"
        description="Paste a RugbyPass player URL to create or enrich a Rugby365 player profile with physical stats, club, nationality, season stats and recent match appearances."
        actions={
          <Link href="/admin/players" className="cms-btn cms-btn--secondary touch-target">
            Players
          </Link>
        }
      />

      <div className="cms-card space-y-5 max-w-2xl mb-4">
        <div>
          <p className="text-sm text-zinc-400 m-0 mb-2">Quick examples</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PLAYERS.map((player) => (
              <button
                key={player.slug}
                type="button"
                className={`cms-btn text-xs ${
                  selectedSlug === player.slug
                    ? "cms-btn--primary ring-1 ring-amber-400/60"
                    : "cms-btn--secondary"
                }`}
                onClick={() => selectExample(player.slug)}
                disabled={fetching && selectedSlug === player.slug}
              >
                {fetching && selectedSlug === player.slug ? `Loading ${player.name}…` : player.name}
              </button>
            ))}
          </div>
        </div>

        {statusMessage ? <p className="text-sm text-zinc-500 m-0">{statusMessage}</p> : null}
        {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}

        <label className="block text-sm text-zinc-400">
          RugbyPass player URL
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSelectedSlug("");
              setPreview(null);
              setStatusMessage("");
            }}
            placeholder="https://www.rugbypass.com/players/pierre-schoeman/"
            className="cms-input w-full mt-1"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={fetching || !url.trim()}
            onClick={() => void loadPreview()}
            className="cms-btn cms-btn--secondary"
          >
            {fetching ? "Loading preview…" : "Load preview"}
          </button>
          <button
            type="button"
            disabled={importing || !url.trim() || !preview}
            onClick={() => void runImport()}
            className="cms-btn cms-btn--primary"
          >
            {importing
              ? "Importing…"
              : preview?.existingPlayer
                ? "Enrich existing player"
                : "Import player"}
          </button>
        </div>

        {preview ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm space-y-3">
            <div className="flex gap-3 items-start">
              {preview.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded object-cover bg-zinc-900"
                />
              ) : null}
              <div>
                <p className="m-0 font-medium text-zinc-200">{preview.displayName}</p>
                <p className="m-0 text-zinc-500">
                  {preview.position ?? "—"} · {preview.currentTeam ?? "—"} ·{" "}
                  {preview.nationality ?? "—"}
                </p>
                <p className="m-0 text-zinc-500">
                  {preview.heightCm ? `${preview.heightCm} cm` : "—"} ·{" "}
                  {preview.weightKg ? `${preview.weightKg} kg` : "—"}
                  {preview.age ? ` · age ${preview.age}` : ""}
                </p>
                <p className="m-0 text-zinc-600 text-xs mt-1">
                  RugbyPass ID {preview.rugbypassPlayerId ?? "—"} · slug {preview.slug}
                </p>
              </div>
            </div>

            {preview.existingPlayer ? (
              <p className="m-0 text-amber-300 text-xs">
                Matches existing player{" "}
                <Link href={`/admin/players/${preview.existingPlayer.id}/edit`} className="underline">
                  {preview.existingPlayer.name}
                </Link>
                . Import will enrich that record.
              </p>
            ) : (
              <p className="m-0 text-zinc-500 text-xs">
                No Rugby365 player linked yet — import will create or match by name.
              </p>
            )}

            {preview.conflict && preview.conflict.id !== preview.existingPlayer?.id ? (
              <p className="m-0 text-red-400 text-xs">
                RugbyPass identity already linked to {preview.conflict.name}. Resolve before importing.
              </p>
            ) : null}

            <p className="m-0 text-zinc-500">
              {preview.seasonStatCount} season stat rows · {preview.recentMatchCount} recent appearances
            </p>

            {preview.recentMatches.length > 0 ? (
              <div>
                <p className="m-0 text-zinc-400 text-xs mb-1">Recent matches</p>
                <ul className="m-0 pl-4 space-y-1 text-zinc-500">
                  {preview.recentMatches.map((match) => (
                    <li key={`${match.kickoffAt}-${match.matchTitle}`}>
                      {match.matchTitle} · {match.competitionName} ·{" "}
                      {new Date(match.kickoffAt).toLocaleDateString()} · {match.minutesPlayed} min
                      {match.tries > 0 ? ` · ${match.tries} try` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="cms-card max-w-2xl text-sm text-zinc-500">
        <p className="m-0 font-medium text-zinc-300 mb-2">How it works</p>
        <ol className="m-0 pl-4 space-y-1">
          <li>Paste a RugbyPass player URL (e.g. /players/pierre-schoeman/).</li>
          <li>Click <strong className="text-zinc-400">Load preview</strong> to verify parsed data.</li>
          <li>
            Import creates a new player or enriches an existing Rugby365 record when RugbyPass ID/slug
            already matches.
          </li>
          <li>Recent RugbyPass appearances are stored and linked to fixtures where dates and teams match.</li>
        </ol>
      </div>
    </>
  );
}
