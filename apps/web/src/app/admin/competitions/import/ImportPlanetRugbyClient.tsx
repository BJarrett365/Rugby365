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
import {
  importOptionsForMode,
  PLANET_RUGBY_LEAGUE_PRESETS,
  planetRugbyPresetById,
  type PlanetRugbyImportMode,
} from "@/lib/planet-rugby-import-presets";

type TournamentPreview = {
  kind: "tournament";
  competitionSlug: string;
  competitionName: string;
  sdmsCompCode?: string;
  activeSeason?: string | null;
  seasons?: string[];
  fixtureCount?: number;
  resultCount?: number;
  tableRowCount?: number;
  pageType: string;
};

type Preset = (typeof PLANET_RUGBY_LEAGUE_PRESETS)[number];

export function ImportPlanetRugbyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPreset =
    planetRugbyPresetById(searchParams.get("preset") ?? "") ??
    PLANET_RUGBY_LEAGUE_PRESETS.find((preset) => preset.slug === searchParams.get("preset")) ??
    PLANET_RUGBY_LEAGUE_PRESETS[0];

  const [url, setUrl] = useState<string>(initialPreset.url);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [mode, setMode] = useState<PlanetRugbyImportMode>("full");
  const [preview, setPreview] = useState<TournamentPreview | null>(null);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importAllSeasons, setImportAllSeasons] = useState(false);
  const [error, setError] = useState("");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const { state: importProgress, start: startImportProgress, update: updateImportProgress, stop: stopImportProgress, finish: finishImportProgress } =
    useImportProgress();

  const urlRef = useRef(url);
  urlRef.current = url;

  const fetchPreview = useCallback(
    async (
      targetUrl: string,
      options?: {
        season?: string;
        resetSeason?: boolean;
      },
    ) => {
      const trimmedUrl = targetUrl.trim();
      if (!trimmedUrl) return;

      const season =
        options?.season !== undefined
          ? options.season || undefined
          : options?.resetSeason
            ? undefined
            : seasonLabel || undefined;

      setFetching(true);
      setError("");
      setStatusMessage("Loading seasons from Planet Rugby…");

      try {
        const qs = new URLSearchParams({ url: trimmedUrl });
        if (season) qs.set("seasonLabel", season);

        const res = await fetch(`/api/admin/data-sources/planet-rugby/parse?${qs}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Fetch failed");
          setPreview(null);
          setStatusMessage("");
          return;
        }

        if (data.kind !== "tournament") {
          setError("URL must be a tournament page (table, fixtures, or results).");
          setPreview(null);
          setStatusMessage("");
          return;
        }

        setPreview(data);
        const available = data.seasons ?? [];
        setSeasons(available);
        const resolved =
          options?.season ||
          (options?.resetSeason ? null : seasonLabel) ||
          data.activeSeason ||
          available.at(-1) ||
          "";
        if (resolved) setSeasonLabel(resolved);
        setStatusMessage(
          `Loaded ${data.competitionName} · ${available.length} season(s) available`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fetch failed");
        setPreview(null);
        setStatusMessage("");
      } finally {
        setFetching(false);
      }
    },
    [seasonLabel],
  );

  const applyPreset = useCallback(
    async (preset: Preset) => {
      loadedPresetRef.current = preset.id;
      setSelectedPresetId(preset.id);
      setUrl(preset.url);
      urlRef.current = preset.url;
      setPreview(null);
      setSeasons([]);
      setSeasonLabel("");
      setError("");
      setStatusMessage(`Loading ${preset.name}…`);
      await fetchPreview(preset.url, { resetSeason: true });
    },
    [fetchPreview],
  );

  const presetFromQuery = searchParams.get("preset");
  const loadedPresetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!presetFromQuery || loadedPresetRef.current === presetFromQuery) return;
    const preset =
      planetRugbyPresetById(presetFromQuery) ??
      PLANET_RUGBY_LEAGUE_PRESETS.find((item) => item.slug === presetFromQuery);
    if (!preset) return;
    void applyPreset(preset);
  }, [presetFromQuery, applyPreset]);

  async function onSeasonChange(nextSeason: string) {
    setSeasonLabel(nextSeason);
    if (!nextSeason) return;
    await fetchPreview(urlRef.current, { season: nextSeason });
  }

  async function runImport() {
    if (!importAllSeasons && !seasonLabel) {
      setError("Select a season year before importing.");
      return;
    }
    const modeOptions = importOptionsForMode(mode);
    setImporting(true);
    setError("");

    const seasonCount = (seasons.length ? seasons : preview?.seasons ?? []).length;
    const estimatedSeconds = estimateImportDurationSeconds({
      seasonCount,
      resultCount: preview?.resultCount,
      fixtureCount: preview?.fixtureCount,
      importAllSeasons,
      importMatchDetails: modeOptions.importMatchDetails,
      mode,
    });

    startImportProgress({
      message: importAllSeasons
        ? `Importing all ${seasonCount} seasons from SDMS…`
        : `Importing ${seasonLabel} from SDMS…`,
      estimatedSeconds,
    });

    try {
      const data = await postImportWithProgress(
        "/api/admin/competitions/import",
        {
          tournamentUrl: urlRef.current.trim(),
          seasonLabel: importAllSeasons ? undefined : seasonLabel,
          importAllSeasons,
          mode,
          streamProgress: importAllSeasons || estimatedSeconds >= 30,
        },
        {
          estimateSeconds: estimatedSeconds,
          onProgress: (event) => {
            updateImportProgress(event);
          },
        },
      );

      finishImportProgress();

      if (data.seasonsImported != null) {
        const t = (data.totals as Record<string, number> | undefined) ?? {};
        alert(
          `Imported ${data.competitionSlug}: ${data.seasonsImported} seasons · ` +
            `${t.created ?? 0} matches created, ${t.updated ?? 0} updated` +
            (t.matchDetailsEnriched != null
              ? ` · ${t.matchDetailsEnriched} with lineups/stats/H2H` +
                (t.matchDetailsFailed ? ` (${t.matchDetailsFailed} failed)` : "")
              : ""),
        );
      } else {
        const tableMsg =
          data.standingsRows != null ? `${data.standingsRows} table rows` : "table synced";
        const matchMsg =
          mode === "full"
            ? ` · ${data.created} matches created, ${data.updated} updated` +
              (data.matchDetailsEnriched != null
                ? ` · ${data.matchDetailsEnriched} with lineups/stats/H2H` +
                  (data.matchDetailsFailed ? ` (${data.matchDetailsFailed} failed)` : "")
                : "")
            : "";
        alert(`Imported ${data.competitionSlug} (${data.seasonLabel}): ${tableMsg}${matchMsg}`);
      }
      router.push(
        mode === "table"
          ? `/competitions/${data.competitionSlug}/table`
          : `/competitions/${data.competitionSlug}/results`,
      );
    } catch (e) {
      stopImportProgress();
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const modeOptions = importOptionsForMode(mode);

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Import leagues & tables from Planet Rugby"
        description="Paste any Planet Rugby tournament URL (results, table, or fixtures). Includes domestic leagues, Internationals, Six Nations and World Cup. Data is pulled from Planet Rugby SDMS."
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
            {PLANET_RUGBY_LEAGUE_PRESETS.map((preset) => (
              <Link
                key={preset.id}
                href={`/admin/competitions/import?preset=${preset.id}`}
                scroll={false}
                className={`cms-btn text-xs no-underline ${
                  selectedPresetId === preset.id
                    ? "cms-btn--primary ring-1 ring-amber-400/60"
                    : "cms-btn--secondary"
                } ${fetching && selectedPresetId === preset.id ? "pointer-events-none opacity-70" : ""}`}
              >
                {fetching && selectedPresetId === preset.id ? `Loading ${preset.name}…` : preset.name}
              </Link>
            ))}
          </div>
        </div>

        {statusMessage ? <p className="text-sm text-zinc-500 m-0">{statusMessage}</p> : null}
        <ImportProgressPanel
          title={importAllSeasons ? "Bulk Planet Rugby import" : "Planet Rugby import"}
          state={importProgress}
        />
        {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}

        <label className="block text-sm text-zinc-400">
          Planet Rugby tournament URL
          <input
            type="url"
            value={url}
            onChange={(e) => {
              const nextUrl = e.target.value;
              setUrl(nextUrl);
              urlRef.current = nextUrl;
              setSelectedPresetId("");
              setPreview(null);
              setSeasons([]);
              setSeasonLabel("");
              setStatusMessage("");
            }}
            placeholder="https://www.planetrugby.com/tournament/rugby-champions-cup/results"
            className="cms-input w-full mt-1"
          />
        </label>

        {(seasons.length > 0 || preview?.seasons?.length) && (
          <label className="block text-sm text-zinc-400">
            Season year
            <select
              className="cms-select w-full mt-1"
              value={seasonLabel}
              disabled={importAllSeasons || fetching}
              onChange={(e) => {
                void onSeasonChange(e.target.value);
              }}
            >
              <option value="">Select year…</option>
              {(seasons.length ? seasons : preview?.seasons ?? []).map((year) => (
                <option key={year} value={year}>
                  {year}
                  {year === preview?.activeSeason ? " (current)" : ""}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-500 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={importAllSeasons}
                onChange={(e) => setImportAllSeasons(e.target.checked)}
              />
              Import all seasons ({(seasons.length ? seasons : preview?.seasons ?? []).length}{" "}
              years from SDMS)
            </label>
            <span className="text-xs text-zinc-600 mt-1 block">
              {importAllSeasons
                ? "Imports every SDMS season for this competition. Full import with match details can take a long time."
                : "Import table, fixtures and results for the selected SDMS season."}
            </span>
          </label>
        )}

        <fieldset className="border-0 p-0 m-0">
          <legend className="text-sm text-zinc-400 mb-2">Import scope</legend>
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "table"}
                onChange={() => setMode("table")}
                className="mt-1"
              />
              <span>
                <span className="text-zinc-200 font-medium">League + table only</span>
                <span className="block text-zinc-500 text-xs mt-0.5">
                  Creates the competition, seasons, and standings (P, W, D, L, BP, Pts, form).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "full"}
                onChange={() => setMode("full")}
                className="mt-1"
              />
              <span>
                <span className="text-zinc-200 font-medium">Full import</span>
                <span className="block text-zinc-500 text-xs mt-0.5">
                  League, table, results, and fixtures — including round, venue, scores, teams,
                  lineups, stats, and head-to-head for completed matches.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={fetching || !url.trim()}
            onClick={() => {
              void fetchPreview(urlRef.current, { resetSeason: !seasonLabel });
            }}
            className="cms-btn cms-btn--secondary"
          >
            {fetching ? "Loading seasons…" : "Load seasons & preview"}
          </button>
          <button
            type="button"
            disabled={importing || !url.trim() || (!importAllSeasons && !seasonLabel)}
            onClick={runImport}
            className="cms-btn cms-btn--primary"
          >
            {importing
              ? "Importing…"
              : importAllSeasons
                ? mode === "table"
                  ? "Import all seasons (table)"
                  : "Import all seasons (full)"
                : mode === "table"
                  ? "Import league & table"
                  : "Import league, table & matches"}
          </button>
        </div>

        {preview && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm space-y-2">
            <p className="m-0 font-medium text-zinc-200">{preview.competitionName}</p>
            <p className="m-0 text-zinc-500">
              Slug: {preview.competitionSlug} · SDMS: {preview.sdmsCompCode ?? "—"}
            </p>
            <p className="m-0 text-zinc-500">
              {seasonLabel ? (
                <>
                  <span className="text-zinc-300">{seasonLabel}</span>: {preview.tableRowCount ?? 0}{" "}
                  table rows · {preview.resultCount ?? 0} results · {preview.fixtureCount ?? 0}{" "}
                  fixtures
                  {preview.competitionSlug === "international" &&
                  (preview.tableRowCount ?? 0) === 0 ? (
                    <span className="block text-zinc-600 text-xs mt-1">
                      Internationals have fixtures and results but no league table — use full import
                      for matches.
                    </span>
                  ) : null}
                </>
              ) : (
                <>Select a season year to see counts for that season.</>
              )}
            </p>
            <p className="m-0 text-zinc-600 text-xs">
              Will import:{" "}
              {modeOptions.syncStandings ? "standings" : ""}
              {modeOptions.importResults ? " · results" : ""}
              {modeOptions.importFixtures ? " · fixtures" : ""}
              {modeOptions.importMatchDetails ? " · match details (lineups, stats, H2H)" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="cms-card max-w-2xl text-sm text-zinc-500">
        <p className="m-0 font-medium text-zinc-300 mb-2">How it works</p>
        <ol className="m-0 pl-4 space-y-1">
          <li>Paste a URL or pick a preset (e.g. Internationals fixtures).</li>
          <li>
            Click <strong className="text-zinc-400">Load seasons & preview</strong> — available years
            come from SDMS.
          </li>
          <li>
            Choose the <strong className="text-zinc-400">season year</strong> (e.g. 2025 for last
            season, 2026 for current).
          </li>
          <li>Import league + table, or full import with matches.</li>
        </ol>
        <p className="m-0 mt-3 text-xs text-zinc-600">
          Also available:{" "}
          <Link href="/admin/competitions/import-livesport" className="text-amber-400/80 hover:underline">
            LiveSport import
          </Link>{" "}
          (Six Nations tables, fixtures and results)
        </p>
      </div>
    </>
  );
}
