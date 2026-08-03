"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlert } from "@/components/admin/MatchCmsIcons";

type IssueRow = {
  code: string;
  label: string;
  actionLabel: string;
  severity: "error" | "warning";
};

type Suggestion = {
  id: string;
  field: "venueId" | "refereeId";
  label: string;
  value: string;
  displayName: string;
  source: string;
  confidence: number;
  detail?: string | null;
  wikipediaUrl?: string | null;
};

type Duplicate = {
  otherFixtureId: string;
  slug: string;
  status: string;
  score: number;
  recommendedKeeperId: string;
  externalMatchId: string | null;
  homeScore: number;
  awayScore: number;
};

type Report = {
  fixtureId: string;
  matchLabel: string;
  status: string;
  issues: IssueRow[];
  suggestions: Suggestion[];
  duplicates: Duplicate[];
  verification: {
    source: "rules" | "openai";
    summary: string;
    confirmed: string[];
    missing: string[];
    conflicts: string[];
    confidenceScore: number;
    wikiHints: Array<{ label: string; url: string }>;
  };
  counts: { issueCount: number; suggestionCount: number; duplicateCount: number };
};

function confidencePct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Focused CMS page for an issue code (API `href` is a function and does not serialize). */
function issuePageHref(fixtureId: string, code: string): string {
  if (code === "lineups") return `/admin/matches/${fixtureId}/lineups`;
  if (code === "team_stats") return `/admin/matches/${fixtureId}/stats`;
  if (code === "player_stats") return `/admin/matches/${fixtureId}/player-stats`;
  if (code === "primary_mapping") return `/admin/matches/${fixtureId}/sources`;
  return `/admin/matches/${fixtureId}/edit`;
}

/** Post-match issues template — Wiki + AI verify, one-click venue/ref fixes, duplicates. */
export function MatchIssuesPanel({
  fixtureId,
  onChanged,
}: {
  fixtureId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/issues`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load issues");
      setReport(data as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verifyWithAi() {
    setVerifying(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", useAi: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setReport(data as Report);
      setMessage(
        data.verification?.source === "openai"
          ? "Wiki + OpenAI verification complete."
          : "Rule + Wikipedia verification complete (OpenAI key not used or unavailable).",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function applySuggestion(s: Suggestion) {
    setBusyId(s.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          field: s.field,
          value: s.value,
          source: s.source,
          displayName: s.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setReport(data as Report);
      setMessage(`Applied ${s.field === "venueId" ? "venue" : "referee"}: ${s.displayName}`);
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusyId(null);
    }
  }

  async function mergeDuplicate(dup: Duplicate, keep: "this" | "other" | "recommended") {
    if (
      !confirm(
        keep === "this"
          ? `Merge ${dup.slug} into this match and delete the duplicate?`
          : keep === "other"
            ? `Keep ${dup.slug} and merge this match into it?`
            : `Merge using the recommended keeper (${dup.recommendedKeeperId === fixtureId ? "this match" : dup.slug})?`,
      )
    ) {
      return;
    }
    setBusyId(dup.otherFixtureId);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge_duplicate",
          otherFixtureId: dup.otherFixtureId,
          keep,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");
      if (data.redirectedTo) {
        setMessage("Duplicate merged — opening keeper match…");
        router.push(data.redirectedTo);
        return;
      }
      if (data.report) setReport(data.report as Report);
      setMessage("Duplicate merged.");
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusyId(null);
    }
  }

  const venueSuggestions = report?.suggestions.filter((s) => s.field === "venueId") ?? [];
  const refSuggestions = report?.suggestions.filter((s) => s.field === "refereeId") ?? [];

  return (
    <div className="cms-card border border-amber-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="cms-section-title flex items-center gap-2 m-0">
            <IconAlert className="w-4 h-4 text-amber-400" />
            Match issues
          </h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Post-match gaps, Wikipedia / OpenAI verification, and one-click fixes for venue, referee,
            and duplicates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary touch-target"
            disabled={loading || verifying}
            onClick={() => void load()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary touch-target"
            disabled={loading || verifying}
            onClick={() => void verifyWithAi()}
          >
            {verifying ? "Verifying…" : "Verify with Wiki / AI"}
          </button>
        </div>
      </div>

      {error ? <p className="text-red-400 text-sm m-0 mb-3">{error}</p> : null}
      {message ? <p className="text-emerald-400 text-sm m-0 mb-3">{message}</p> : null}
      {loading && !report ? <p className="text-sm text-zinc-500 m-0">Loading issues…</p> : null}

      {report ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
            <span>{report.counts.issueCount} issue(s)</span>
            <span>{report.counts.suggestionCount} suggestion(s)</span>
            <span>{report.counts.duplicateCount} duplicate(s)</span>
            <span>
              Confidence {confidencePct(report.verification.confidenceScore)} ·{" "}
              {report.verification.source === "openai" ? "OpenAI + rules" : "Rules + Wikipedia"}
            </span>
          </div>

          <section>
            <h4 className="text-sm font-medium text-zinc-200 m-0 mb-2">Verification</h4>
            <p className="text-sm text-zinc-400 m-0 mb-2">{report.verification.summary}</p>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div>
                <div className="text-emerald-400/90 mb-1">Confirmed</div>
                <ul className="m-0 pl-4 text-zinc-400 space-y-0.5">
                  {report.verification.confirmed.length ? (
                    report.verification.confirmed.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>None yet</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="text-amber-400/90 mb-1">Missing</div>
                <ul className="m-0 pl-4 text-zinc-400 space-y-0.5">
                  {report.verification.missing.length ? (
                    report.verification.missing.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>Nothing missing</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="text-red-400/90 mb-1">Conflicts / duplicates</div>
                <ul className="m-0 pl-4 text-zinc-400 space-y-0.5">
                  {report.verification.conflicts.length ? (
                    report.verification.conflicts.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>None</li>
                  )}
                </ul>
              </div>
            </div>
            {report.verification.wikiHints.length ? (
              <p className="text-xs text-zinc-500 mt-2 mb-0">
                Wiki:{" "}
                {report.verification.wikiHints.map((h, i) => (
                  <span key={h.url}>
                    {i > 0 ? " · " : null}
                    <a href={h.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                      {h.label}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="text-sm font-medium text-zinc-200 m-0 mb-2">What’s missing / wrong</h4>
            {report.issues.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">No issues flagged for this match.</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-2">
                {report.issues.map((issue) => (
                  <li
                    key={`${issue.code}-${issue.label}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                  >
                    <div className="text-sm">
                      <span
                        className={
                          issue.severity === "error" ? "text-amber-300" : "text-zinc-300"
                        }
                      >
                        {issue.label}
                      </span>
                      <span className="text-xs text-zinc-500 ml-2">{issue.code}</span>
                    </div>
                    <Link
                      href={issuePageHref(fixtureId, issue.code)}
                      className="cms-btn cms-btn--secondary text-xs"
                    >
                      {issue.actionLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="text-sm font-medium text-zinc-200 m-0 mb-2">Fix venue</h4>
            {venueSuggestions.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">
                {report.issues.some((i) => i.code === "venue")
                  ? "No auto-suggestions yet — run Verify, or set venue on the match form."
                  : "Venue is already linked."}
              </p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-2">
                {venueSuggestions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-200">{s.displayName}</div>
                      <div className="text-xs text-zinc-500">
                        {s.label} · {s.source} · {confidencePct(s.confidence)}
                        {s.detail ? ` · ${s.detail}` : ""}
                        {s.wikipediaUrl ? (
                          <>
                            {" · "}
                            <a
                              href={s.wikipediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline"
                            >
                              Wiki
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cms-btn cms-btn--primary text-xs touch-target"
                      disabled={Boolean(busyId)}
                      onClick={() => void applySuggestion(s)}
                    >
                      {busyId === s.id ? "Applying…" : "Apply"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="text-sm font-medium text-zinc-200 m-0 mb-2">Fix referee</h4>
            {refSuggestions.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">
                {report.issues.some((i) => i.code === "referee")
                  ? "No auto-suggestions yet — run Verify, or set referee on the match form."
                  : "Referee is already linked."}
              </p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-2">
                {refSuggestions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-200">{s.displayName}</div>
                      <div className="text-xs text-zinc-500">
                        {s.label} · {s.source} · {confidencePct(s.confidence)}
                        {s.detail ? ` · ${s.detail}` : ""}
                        {s.wikipediaUrl ? (
                          <>
                            {" · "}
                            <a
                              href={s.wikipediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline"
                            >
                              Wiki
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cms-btn cms-btn--primary text-xs touch-target"
                      disabled={Boolean(busyId)}
                      onClick={() => void applySuggestion(s)}
                    >
                      {busyId === s.id ? "Applying…" : "Apply"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="text-sm font-medium text-zinc-200 m-0 mb-2">Duplicates</h4>
            {report.duplicates.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">No same-day home/away duplicates found.</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-3">
                {report.duplicates.map((dup) => (
                  <li
                    key={dup.otherFixtureId}
                    className="rounded border border-red-900/40 bg-red-950/20 px-3 py-3 space-y-2"
                  >
                    <div className="text-sm text-zinc-200">
                      <Link
                        href={`/admin/matches/${dup.otherFixtureId}/edit`}
                        className="text-sky-400 hover:underline"
                      >
                        {dup.slug}
                      </Link>
                      <span className="text-xs text-zinc-500 ml-2">
                        {dup.status} · {dup.homeScore}–{dup.awayScore} · score {dup.score}
                        {dup.recommendedKeeperId === fixtureId
                          ? " · recommended: keep this"
                          : " · recommended: keep other"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="cms-btn cms-btn--primary text-xs"
                        disabled={Boolean(busyId)}
                        onClick={() => void mergeDuplicate(dup, "recommended")}
                      >
                        {busyId === dup.otherFixtureId ? "Merging…" : "Merge (recommended)"}
                      </button>
                      <button
                        type="button"
                        className="cms-btn cms-btn--secondary text-xs"
                        disabled={Boolean(busyId)}
                        onClick={() => void mergeDuplicate(dup, "this")}
                      >
                        Keep this
                      </button>
                      <button
                        type="button"
                        className="cms-btn cms-btn--secondary text-xs"
                        disabled={Boolean(busyId)}
                        onClick={() => void mergeDuplicate(dup, "other")}
                      >
                        Keep other
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
