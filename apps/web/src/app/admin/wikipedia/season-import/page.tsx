"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { usesCalendarYearSeasons } from "@/lib/season-label-utils";

const INTERNATIONAL_COMPETITION_SLUGS = new Set([
  "six-nations",
  "rugby-world-cup",
  "rugby-europe-championship",
  "end-of-year-internationals",
  "autumn-nations-cup",
  "nations-championship",
  "world-rugby-nations-cup",
]);

function presetSeasonLabel(competitionSlug: string, startYear: number): string {
  if (usesCalendarYearSeasons(competitionSlug, null)) {
    return String(startYear);
  }
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

function defaultPresetYear(competitionSlug: string): number {
  const now = new Date();
  if (usesCalendarYearSeasons(competitionSlug, null)) return now.getFullYear();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

type Preset = { startYear: number; url: string; winner: string };

type AnalyseResult = {
  pageTitle: string;
  wikipediaUrl: string;
  revisionId: number | null;
  seasonStartYear: number | null;
  championName: string | null;
  standings: number;
  fixtures: number;
  playoffs: number;
  attendance: number;
  venues: number;
  referees: number;
  warnings: string[];
  tablePreview: Array<{ rank: number; teamName: string; played: number; points: number }>;
  playoffPreview: Array<{
    round: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
};

type ImportReport = {
  pageTitle: string;
  seasonLabel: string;
  championName: string | null;
  warnings: string[];
  unmappedTeams: string[];
  table: { found: number; created: number; updated: number; skipped: number; errors: number };
  fixtures: { found: number; created: number; updated: number; skipped: number; errors: number };
  playoffs: { found: number; created: number; updated: number; skipped: number; errors: number };
  attendance: { found: number; created: number; updated: number; skipped: number; errors: number };
};

export default function WikipediaSeasonImportPage() {
  const [competitionSlug, setCompetitionSlug] = useState("premiership");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [url, setUrl] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analyse, setAnalyse] = useState<AnalyseResult | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    fetch(`/api/admin/wikipedia/season-import?competition=${competitionSlug}`)
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.presets ?? []) as Preset[];
        setPresets(rows);
        const currentStart = defaultPresetYear(competitionSlug);
        const first = rows.find((r) => r.startYear === currentStart) ?? rows[0];
        if (first) {
          setUrl(first.url);
          setYear(first.startYear);
        }
        setAnalyse(null);
        setReport(null);
      })
      .catch(() => undefined);
  }, [competitionSlug]);

  async function runAnalyse() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch("/api/admin/wikipedia/season-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyse", url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyse failed");
      setAnalyse(data);
      if (data.seasonStartYear) setYear(data.seasonStartYear);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wikipedia/season-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          url,
          competitionSlug,
          seasonStartYear: typeof year === "number" ? year : undefined,
          mode: "update_existing",
          createMissingTeams:
            competitionSlug === "challenge-cup" ||
            competitionSlug === "rugby-champions-cup" ||
            competitionSlug === "rugby-championship" ||
            competitionSlug === "currie-cup" ||
            competitionSlug.startsWith("currie-cup") ||
            competitionSlug === "top-14" ||
            competitionSlug === "super-rugby" ||
            competitionSlug === "championship" ||
            competitionSlug === "npc" ||
            competitionSlug.startsWith("npc-") ||
            INTERNATIONAL_COMPETITION_SLUGS.has(competitionSlug) ||
            competitionSlug.startsWith("autumn-nations-cup"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wikipedia season import"
        description="Analyse and import season pages from Wikipedia: table standings (teams), fixtures, playoffs, attendance, and champion."
      />

      <div className="cms-card grid gap-3">
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Competition</span>
          <select
            className="cms-input w-full"
            value={competitionSlug}
            onChange={(e) => setCompetitionSlug(e.target.value)}
          >
            <option value="premiership">Premiership</option>
            <option value="challenge-cup">Challenge Cup</option>
            <option value="rugby-champions-cup">Investec Champions Cup</option>
            <option value="rugby-championship">Rugby Championship</option>
            <option value="currie-cup">Currie Cup</option>
            <option value="top-14">Top 14</option>
            <option value="super-rugby">Super Rugby</option>
            <option value="championship">RFU Championship / Champ Rugby</option>
            <option value="npc">NPC (NZ)</option>
            <option value="six-nations">Six Nations</option>
            <option value="rugby-world-cup">Rugby World Cup</option>
            <option value="rugby-europe-championship">Rugby Europe Championship</option>
            <option value="end-of-year-internationals">End-of-year Internationals</option>
            <option value="autumn-nations-cup">Autumn Nations Cup</option>
            <option value="nations-championship">Nations Championship</option>
            <option value="world-rugby-nations-cup">World Rugby Nations Cup</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Season preset</span>
          <select
            className="cms-input w-full"
            value={typeof year === "number" ? String(year) : ""}
            onChange={(e) => {
              const y = Number.parseInt(e.target.value, 10);
              const preset = presets.find((p) => p.startYear === y);
              setYear(y);
              if (preset) setUrl(preset.url);
              setAnalyse(null);
              setReport(null);
            }}
          >
            {presets.map((p) => (
              <option key={p.startYear} value={p.startYear}>
                {presetSeasonLabel(competitionSlug, p.startYear)} · {p.winner}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Wikipedia URL</span>
          <input className="cms-input w-full" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cms-btn cms-btn--secondary" disabled={busy || !url} onClick={runAnalyse}>
            Analyse page
          </button>
          <button type="button" className="cms-btn" disabled={busy || !url || !analyse} onClick={runImport}>
            Import season
          </button>
        </div>
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>

      {analyse ? (
        <div className="cms-card">
          <h2 className="text-base font-semibold m-0 mb-2">{analyse.pageTitle}</h2>
          <p className="text-sm text-zinc-400 m-0 mb-3">
            Champion: {analyse.championName ?? "—"} · Teams {analyse.standings} · Fixtures{" "}
            {analyse.fixtures} · Playoffs {analyse.playoffs} · Attendance {analyse.attendance} · Venues{" "}
            {analyse.venues} · Referees {analyse.referees}
          </p>
          {analyse.warnings.length ? (
            <ul className="text-sm text-amber-400 mb-3">
              {analyse.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th>#</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {analyse.tablePreview.map((row) => (
                  <tr key={row.teamName} className="border-t border-zinc-800">
                    <td>{row.rank}</td>
                    <td>{row.teamName}</td>
                    <td>{row.played}</td>
                    <td>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analyse.playoffPreview.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-400">Play-offs</h3>
              <ul className="text-sm m-0 p-0 list-none">
                {analyse.playoffPreview.map((f, i) => (
                  <li key={`${f.homeTeam}-${f.awayTeam}-${i}`}>
                    {f.round}: {f.homeTeam} {f.homeScore}–{f.awayScore} {f.awayTeam}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <div className="cms-card">
          <h2 className="text-base font-semibold m-0 mb-2">Import report · {report.seasonLabel}</h2>
          <p className="text-sm m-0 mb-2">Winner: {report.championName ?? "—"}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th>Type</th>
                <th>Found</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Skipped</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Table", report.table],
                  ["Fixtures", report.fixtures],
                  ["Playoffs", report.playoffs],
                  ["Attendance", report.attendance],
                ] as const
              ).map(([label, counts]) => (
                <tr key={label} className="border-t border-zinc-800">
                  <td>{label}</td>
                  <td>{counts.found}</td>
                  <td>{counts.created}</td>
                  <td>{counts.updated}</td>
                  <td>{counts.skipped}</td>
                  <td>{counts.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.unmappedTeams.length ? (
            <p className="text-sm text-amber-400 mt-3">Unmapped: {report.unmappedTeams.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
