"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { ImportProgressPanel } from "@/components/admin/ImportProgressPanel";
import {
  estimateImportDurationSeconds,
  postImportWithProgress,
  useImportProgress,
} from "@/lib/use-import-progress";
import { LIVESPORT_LEAGUE_PRESETS } from "@/lib/livesport-import-presets";

type TournamentPreview = {
  kind: "tournament";
  competitionSlug: string;
  competitionName: string;
  seasonLabel: string;
  tournamentId?: string | null;
  fixtureCount?: number;
  resultCount?: number;
  tableRowCount?: number;
  sourceUrl?: string;
};

type Preset = (typeof LIVESPORT_LEAGUE_PRESETS)[number];

export function ImportLiveSportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPreset =
    LIVESPORT_LEAGUE_PRESETS.find((preset) => preset.slug === searchParams.get("preset")) ??
    LIVESPORT_LEAGUE_PRESETS[0];

  const [url, setUrl] = useState<string>(initialPreset.url);
  const [selectedSlug, setSelectedSlug] = useState<string>(initialPreset.slug);
  const [preview, setPreview] = useState<TournamentPreview | null>(null);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [seasonLabel, setSeasonLabel] = useState(initialPreset.seasonLabel);
  const [statusMessage, setStatusMessage] = useState("");
  const { state: importProgress, start: startImportProgress, update: updateImportProgress, stop: stopImportProgress, finish: finishImportProgress } =
    useImportProgress();

  const urlRef = useRef(url);
  urlRef.current = url;

  const fetchPreview = useCallback(async (targetUrl: string, season?: string) => {
    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) return;

    setFetching(true);
    setError("");
    setStatusMessage("Loading from LiveSport…");

    try {
      const qs = new URLSearchParams({ url: trimmedUrl });
      if (season) qs.set("seasonLabel", season);

      const res = await fetch(`/api/admin/data-sources/livesport/parse?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fetch failed");
        setPreview(null);
        setStatusMessage("");
        return;
      }

      if (data.kind !== "tournament") {
        setError("URL must be a LiveSport competition page.");
        setPreview(null);
        setStatusMessage("");
        return;
      }

      setPreview(data);
      if (data.seasonLabel) setSeasonLabel(data.seasonLabel);
      setStatusMessage(
        `Loaded ${data.competitionName} (${data.seasonLabel}) · ${data.tableRowCount ?? 0} table rows · ${data.resultCount ?? 0} results · ${data.fixtureCount ?? 0} fixtures`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
      setPreview(null);
      setStatusMessage("");
    } finally {
      setFetching(false);
    }
  }, []);

  const applyPreset = useCallback(
    async (preset: Preset) => {
      loadedPresetRef.current = preset.slug;
      setSelectedSlug(preset.slug);
      setUrl(preset.url);
      urlRef.current = preset.url;
      setSeasonLabel(preset.seasonLabel);
      setPreview(null);
      setError("");
      setStatusMessage(`Loading ${preset.name}…`);
      await fetchPreview(preset.url, preset.seasonLabel);
    },
    [fetchPreview],
  );

  const presetFromQuery = searchParams.get("preset");
  const loadedPresetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!presetFromQuery || loadedPresetRef.current === presetFromQuery) return;
    const preset = LIVESPORT_LEAGUE_PRESETS.find((item) => item.slug === presetFromQuery);
    if (!preset) return;
    void applyPreset(preset);
  }, [presetFromQuery, applyPreset]);

  async function runImport() {
    if (!seasonLabel) {
      setError("Enter a season year (e.g. 2026).");
      return;
    }
    setImporting(true);
    setError("");

    const estimatedSeconds = estimateImportDurationSeconds({
      seasonCount: 1,
      resultCount: preview?.resultCount,
      fixtureCount: preview?.fixtureCount,
      importMatchDetails: false,
      mode: "full",
    });

    startImportProgress({
      message: `Importing ${preview?.competitionName ?? "competition"} (${seasonLabel}) from LiveSport…`,
      estimatedSeconds,
    });

    try {
      const data = await postImportWithProgress(
        "/api/admin/competitions/import-livesport",
        {
          tournamentUrl: urlRef.current.trim(),
          seasonLabel,
          streamProgress: true,
        },
        {
          estimateSeconds: estimatedSeconds,
          onProgress: updateImportProgress,
        },
      );

      finishImportProgress();
      alert(
        `Imported ${data.competitionName} (${data.seasonLabel}): ` +
          `${data.standingsRows} table rows · ${data.created} matches created, ${data.updated} updated`,
      );
      router.push(`/competitions/${data.competitionSlug}/results`);
    } catch (e) {
      stopImportProgress();
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Import from LiveSport"
        description="Import tables, fixtures and results from LiveSport (Flashscore UK) for domestic leagues, Super Rugby, Six Nations, World Cup and more."
        actions={
          <Link href="/admin/competitions" className="cms-btn cms-btn--secondary touch-target">
            Competitions
          </Link>
        }
      />

      <div className="cms-card space-y-5 max-w-2xl mb-4">
        <div>
          <p className="text-sm text-zinc-400 m-0 mb-2">Quick import</p>
          <div className="flex flex-wrap gap-2">
            {LIVESPORT_LEAGUE_PRESETS.map((preset) => (
              <Link
                key={preset.slug}
                href={`/admin/competitions/import-livesport?preset=${preset.slug}`}
                scroll={false}
                className={`cms-btn text-xs no-underline ${
                  selectedSlug === preset.slug
                    ? "cms-btn--primary ring-1 ring-amber-400/60"
                    : "cms-btn--secondary"
                } ${fetching && selectedSlug === preset.slug ? "pointer-events-none opacity-70" : ""}`}
              >
                {fetching && selectedSlug === preset.slug ? `Loading ${preset.name}…` : preset.name}
              </Link>
            ))}
          </div>
        </div>

        {statusMessage ? <p className="text-sm text-zinc-500 m-0">{statusMessage}</p> : null}
        <ImportProgressPanel title="LiveSport import" state={importProgress} />
        {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}

        <label className="block text-sm text-zinc-400">
          LiveSport competition URL
          <input
            type="url"
            value={url}
            onChange={(e) => {
              const nextUrl = e.target.value;
              setUrl(nextUrl);
              urlRef.current = nextUrl;
              setSelectedSlug("");
              setPreview(null);
              setStatusMessage("");
            }}
            placeholder="https://www.livesport.com/uk/rugby-union/europe/six-nations/"
            className="cms-input w-full mt-1"
          />
        </label>

        <label className="block text-sm text-zinc-400">
          Season year
          <input
            type="text"
            inputMode="numeric"
            pattern="20\d{2}"
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
            placeholder="2026"
            className="cms-input w-full mt-1"
          />
          <span className="text-xs text-zinc-600 mt-1 block">
            Domestic leagues use the season start year (e.g. 2024 for 2024–25). Internationals and
            World Cup use the championship year (e.g. 2026 for Six Nations, 2023 for RWC).
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={fetching || !url.trim()}
            onClick={() => {
              void fetchPreview(urlRef.current, seasonLabel || undefined);
            }}
            className="cms-btn cms-btn--secondary"
          >
            {fetching ? "Loading…" : "Preview"}
          </button>
          <button
            type="button"
            disabled={importing || !url.trim() || !seasonLabel}
            onClick={runImport}
            className="cms-btn cms-btn--primary"
          >
            {importing ? "Importing…" : "Import table, fixtures & results"}
          </button>
        </div>

        {preview && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm space-y-2">
            <p className="m-0 font-medium text-zinc-200">{preview.competitionName}</p>
            <p className="m-0 text-zinc-500">
              Slug: {preview.competitionSlug} · Tournament: {preview.tournamentId ?? "—"}
            </p>
            <p className="m-0 text-zinc-500">
              {preview.seasonLabel}: {preview.tableRowCount ?? 0} table rows ·{" "}
              {preview.resultCount ?? 0} results · {preview.fixtureCount ?? 0} fixtures
            </p>
          </div>
        )}
      </div>

      <div className="cms-card max-w-2xl text-sm text-zinc-500">
        <p className="m-0 font-medium text-zinc-300 mb-2">How it works</p>
        <ol className="m-0 pl-4 space-y-1">
          <li>Paste a LiveSport URL or pick a competition preset below.</li>
          <li>Set the season year (start year for Premiership, Top 14 and URC).</li>
          <li>Preview counts, then import fixtures, results and computed standings.</li>
        </ol>
        <p className="m-0 mt-3 text-xs text-zinc-600">
          Also available:{" "}
          <Link href="/admin/competitions/import" className="text-amber-400/80 hover:underline">
            Planet Rugby import
          </Link>
        </p>
      </div>
    </>
  );
}
