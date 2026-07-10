"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type MatchPreview = {
  kind: "match";
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  competition?: string;
  kickoffAt?: string;
  venue?: { name?: string; city?: string };
  incidentCount: number;
  suggestedSlug: string;
  resolvedTeams: {
    home: { id: string; name: string } | null;
    away: { id: string; name: string } | null;
  };
};

type TournamentMatch = {
  matchId: string;
  sourceUrl: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  competition: string;
  stageName: string;
  kickoffAt?: string;
  suggestedSlug: string;
};

type TournamentPreview = {
  kind: "tournament";
  sourceUrl: string;
  competitionName: string;
  stageName: string;
  matches: TournamentMatch[];
};

const DEFAULT_SPORT365_MATCH_URL =
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";
const DEFAULT_SPORT365_TOURNAMENT_URL = "https://www.sport365.com/rugby-union/international/men";
const DEFAULT_PLANET_RUGBY_MATCH_URL =
  "https://www.planetrugby.com/matches/rjd8n546/investec-champions-cup/g56e3970/leinster-v-toulon/2026-05-02";

type PlanetRugbyMatchPreview = {
  provider: "planet_rugby";
  sourceUrl: string;
  matchTitle: string;
  competition: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  matchStatus: string;
  kickoffAt?: string;
  venue?: string;
  sdmsMatchId?: string;
  url: { match_external_id: string };
};

function formatKickoff(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export default function ImportMatchPage() {
  const router = useRouter();
  const [source, setSource] = useState<"sport365" | "planet-rugby">("sport365");
  const [mode, setMode] = useState<"match" | "tournament">("tournament");
  const [url, setUrl] = useState(DEFAULT_SPORT365_TOURNAMENT_URL);
  const [matchPreview, setMatchPreview] = useState<MatchPreview | null>(null);
  const [planetRugbyPreview, setPlanetRugbyPreview] = useState<PlanetRugbyMatchPreview | null>(null);
  const [tournamentPreview, setTournamentPreview] = useState<TournamentPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createTeams, setCreateTeams] = useState(true);
  const [importEvents, setImportEvents] = useState(true);
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState("");
  const [bulkSummary, setBulkSummary] = useState("");

  const selectedCount = selectedIds.size;

  const allSelected = useMemo(() => {
    if (!tournamentPreview?.matches.length) return false;
    return tournamentPreview.matches.every((m) => selectedIds.has(m.matchId));
  }, [tournamentPreview, selectedIds]);

  function switchSource(next: "sport365" | "planet-rugby") {
    setSource(next);
    setMode("match");
    setUrl(next === "planet-rugby" ? DEFAULT_PLANET_RUGBY_MATCH_URL : DEFAULT_SPORT365_MATCH_URL);
    setMatchPreview(null);
    setPlanetRugbyPreview(null);
    setTournamentPreview(null);
    setSelectedIds(new Set());
    setError("");
    setBulkSummary("");
  }

  function switchMode(next: "match" | "tournament") {
    if (source === "planet-rugby") return;
    setMode(next);
    setUrl(next === "match" ? DEFAULT_SPORT365_MATCH_URL : DEFAULT_SPORT365_TOURNAMENT_URL);
    setMatchPreview(null);
    setPlanetRugbyPreview(null);
    setTournamentPreview(null);
    setSelectedIds(new Set());
    setError("");
    setBulkSummary("");
  }

  async function fetchPreview() {
    setLoading("preview");
    setError("");
    setBulkSummary("");
    setMatchPreview(null);
    setPlanetRugbyPreview(null);
    setTournamentPreview(null);
    setSelectedIds(new Set());

    try {
      if (source === "planet-rugby") {
        const res = await fetch(
          `/api/admin/data-sources/planet-rugby/parse?url=${encodeURIComponent(url)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Preview failed");
          setLoading(null);
          return;
        }
        setPlanetRugbyPreview(data);
        setLoading(null);
        return;
      }

      const res = await fetch(`/api/admin/data-sources/sport365/parse?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Preview failed");
        setLoading(null);
        return;
      }

      if (data.kind === "tournament") {
        setTournamentPreview(data);
        setSelectedIds(new Set(data.matches.map((m: TournamentMatch) => m.matchId)));
      } else {
        setMatchPreview(data);
      }
    } catch {
      setError(
        "Could not reach the server. Check that npm run dev is running (http://localhost:3000) and try again.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function runPlanetRugbyImport() {
    setLoading("import");
    setError("");
    const res = await fetch("/api/admin/matches/import-planet-rugby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planetRugbyUrl: url, replaceEvents: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      setLoading(null);
      return;
    }
    const detail = [
      data.hasLineups ? "lineups" : null,
      data.hasStats ? "stats" : null,
      data.hasHeadToHead ? "H2H" : null,
      data.eventsImported ? `${data.eventsImported} events` : null,
      data.squadPlayers ? `${data.squadPlayers} squad players` : null,
    ]
      .filter(Boolean)
      .join(", ");
    alert(`Match enriched${detail ? `: ${detail}` : ""}`);
    router.push(`/admin/matches`);
    router.refresh();
  }

  async function runSingleImport() {
    setLoading("import");
    setError("");
    const res = await fetch("/api/admin/matches/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sport365Url: url, createTeams, importEvents }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      setLoading(null);
      return;
    }
    router.push("/admin/matches");
    router.refresh();
  }

  async function runBulkImport() {
    if (!tournamentPreview || selectedCount === 0) return;
    setLoading("import");
    setError("");
    setBulkSummary("");

    try {
      const res = await fetch("/api/admin/matches/import-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentUrl: tournamentPreview.sourceUrl,
          matchIds: Array.from(selectedIds),
          createTeams,
          importEvents,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok && !(data.imported > 0)) {
        const detail =
          Array.isArray(data.errors) && data.errors.length
            ? data.errors.map((e: { matchId: string; error: string }) => `${e.matchId}: ${e.error}`).join(" · ")
            : undefined;
        setError(
          data.dbUnavailable
            ? "Database is not running. In the rugby365 folder run: npm run db:up (Docker Desktop must be open), then refresh."
            : typeof data.error === "string"
              ? data.error
              : (detail ?? "Bulk import failed"),
        );
        setLoading(null);
        return;
      }

      const errNote = data.errors?.length
        ? ` · ${data.errors.length} failed (${data.errors.map((e: { matchId: string }) => e.matchId).join(", ")})`
        : "";
      setBulkSummary(`Imported ${data.imported ?? 0} match(es)${errNote}`);
      setLoading(null);

      if ((data.imported ?? 0) > 0) {
        router.push("/admin/matches");
        router.refresh();
      }
    } catch {
      setError(
        "Could not reach the server. Check that npm run dev is running (http://localhost:3000) and try again.",
      );
      setLoading(null);
    }
  }

  function toggleMatch(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!tournamentPreview) return;
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(tournamentPreview.matches.map((m) => m.matchId)));
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Import matches"
        description="Import from Sport365 or enrich an existing fixture from Planet Rugby (lineups, stats, head-to-head)."
        actions={
          <>
            <Link
              href="/admin/competitions/import"
              className="cms-btn cms-btn--secondary touch-target"
            >
              Import league
            </Link>
            <Link href="/admin/matches" className="cms-btn cms-btn--secondary touch-target">
              All matches
            </Link>
          </>
        }
      />

      <div className="cms-card max-w-4xl space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchSource("sport365")}
            className={`cms-btn touch-target ${source === "sport365" ? "cms-btn--primary" : "cms-btn--secondary"}`}
          >
            Sport365
          </button>
          <button
            type="button"
            onClick={() => switchSource("planet-rugby")}
            className={`cms-btn touch-target ${source === "planet-rugby" ? "cms-btn--primary" : "cms-btn--secondary"}`}
          >
            Planet Rugby
          </button>
        </div>

        {source === "sport365" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchMode("tournament")}
              className={`cms-btn touch-target ${mode === "tournament" ? "cms-btn--primary" : "cms-btn--secondary"}`}
            >
              Tournament / stage
            </button>
            <button
              type="button"
              onClick={() => switchMode("match")}
              className={`cms-btn touch-target ${mode === "match" ? "cms-btn--primary" : "cms-btn--secondary"}`}
            >
              Single match
            </button>
          </div>
        )}

        <label className="block text-sm text-zinc-400">
          {source === "planet-rugby"
            ? "Planet Rugby match URL"
            : mode === "tournament"
              ? "Sport365 competition URL"
              : "Sport365 match URL"}
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              source === "planet-rugby"
                ? DEFAULT_PLANET_RUGBY_MATCH_URL
                : mode === "tournament"
                  ? DEFAULT_SPORT365_TOURNAMENT_URL
                  : DEFAULT_SPORT365_MATCH_URL
            }
            className="cms-input mt-1"
          />
          {source === "planet-rugby" && (
            <span className="text-xs text-zinc-600 mt-1 block">
              Fixture must already exist (import the competition season first). Enriches lineups,
              team stats, head-to-head, and scoring events. Players are deduplicated by SDMS id.
            </span>
          )}
          {source === "sport365" && mode === "tournament" && (
            <span className="text-xs text-zinc-600 mt-1 block">
              Use the competition/stage page (category + stage), not a single match URL.
            </span>
          )}
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!url || loading !== null}
            onClick={fetchPreview}
            className="cms-btn cms-btn--secondary touch-target"
          >
            {loading === "preview" ? "Fetching…" : source === "planet-rugby" ? "Preview match" : "Load fixtures"}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        {bulkSummary && <p className="text-emerald-400 text-sm m-0">{bulkSummary}</p>}

        {planetRugbyPreview && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-3 text-sm">
            <p className="m-0 font-medium text-zinc-200">{planetRugbyPreview.matchTitle}</p>
            <p className="m-0 text-zinc-500">
              {planetRugbyPreview.competition} · {formatStatus(planetRugbyPreview.matchStatus)}
              {planetRugbyPreview.homeScore != null && planetRugbyPreview.awayScore != null
                ? ` · ${planetRugbyPreview.homeScore}–${planetRugbyPreview.awayScore}`
                : ""}
            </p>
            {planetRugbyPreview.kickoffAt && (
              <p className="m-0 text-zinc-500">Kickoff: {formatKickoff(planetRugbyPreview.kickoffAt)}</p>
            )}
            {planetRugbyPreview.venue && (
              <p className="m-0 text-zinc-500">Venue: {planetRugbyPreview.venue}</p>
            )}
            <p className="m-0 text-zinc-600 text-xs">
              SDMS match id: {planetRugbyPreview.sdmsMatchId ?? planetRugbyPreview.url.match_external_id}
            </p>
            <button
              type="button"
              disabled={loading !== null}
              onClick={runPlanetRugbyImport}
              className="cms-btn cms-btn--primary touch-target"
            >
              {loading === "import" ? "Importing…" : "Import lineups, stats & H2H"}
            </button>
          </div>
        )}

        {matchPreview && source === "sport365" && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-3 text-sm">
            <p className="m-0 font-medium text-zinc-200">
              {matchPreview.homeTeam} {matchPreview.homeScore}–{matchPreview.awayScore}{" "}
              {matchPreview.awayTeam}
            </p>
            <p className="m-0 text-zinc-500">
              {matchPreview.competition ?? "Competition unknown"} ·{" "}
              {formatStatus(matchPreview.status)} · {matchPreview.incidentCount} incidents
            </p>
            {matchPreview.kickoffAt && (
              <p className="m-0 text-zinc-500">Kickoff: {formatKickoff(matchPreview.kickoffAt)}</p>
            )}
            <label className="flex items-center gap-2 text-zinc-400">
              <input type="checkbox" checked={createTeams} onChange={(e) => setCreateTeams(e.target.checked)} />
              Create missing teams automatically
            </label>
            <label className="flex items-center gap-2 text-zinc-400">
              <input type="checkbox" checked={importEvents} onChange={(e) => setImportEvents(e.target.checked)} />
              Import match incidents
            </label>
            <button
              type="button"
              disabled={loading !== null}
              onClick={runSingleImport}
              className="cms-btn cms-btn--primary touch-target"
            >
              {loading === "import" ? "Importing…" : "Import fixture"}
            </button>
          </div>
        )}

        {tournamentPreview && source === "sport365" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm">
              <p className="m-0 font-medium text-zinc-200">
                {tournamentPreview.competitionName} · {tournamentPreview.stageName}
              </p>
              <p className="m-0 text-zinc-500 mt-1">
                {tournamentPreview.matches.length} fixtures found · {selectedCount} selected
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button type="button" onClick={toggleAll} className="cms-btn cms-btn--secondary text-xs">
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              <label className="flex items-center gap-2 text-zinc-400">
                <input type="checkbox" checked={createTeams} onChange={(e) => setCreateTeams(e.target.checked)} />
                Create missing teams
              </label>
              <label className="flex items-center gap-2 text-zinc-400">
                <input type="checkbox" checked={importEvents} onChange={(e) => setImportEvents(e.target.checked)} />
                Import incidents
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-950/80 text-zinc-500 text-left">
                  <tr>
                    <th className="p-3 w-10" />
                    <th className="p-3">Match</th>
                    <th className="p-3">Kickoff</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentPreview.matches.map((m) => (
                    <tr key={m.matchId} className="border-t border-zinc-800/80">
                      <td className="p-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.matchId)}
                          onChange={() => toggleMatch(m.matchId)}
                        />
                      </td>
                      <td className="p-3 align-top">
                        <div className="font-medium text-zinc-200">
                          {m.homeTeam} vs {m.awayTeam}
                        </div>
                        <div className="text-xs text-zinc-600 mt-1">{m.suggestedSlug}</div>
                      </td>
                      <td className="p-3 align-top text-zinc-400 whitespace-nowrap">
                        {formatKickoff(m.kickoffAt)}
                      </td>
                      <td className="p-3 align-top text-zinc-400">{formatStatus(m.status)}</td>
                      <td className="p-3 align-top text-zinc-300">
                        {m.homeScore}–{m.awayScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={loading !== null || selectedCount === 0}
              onClick={runBulkImport}
              className="cms-btn cms-btn--primary touch-target"
            >
              {loading === "import"
                ? "Importing…"
                : `Import ${selectedCount} selected match${selectedCount === 1 ? "" : "es"}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
