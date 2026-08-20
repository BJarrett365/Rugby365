"use client";

import { useState } from "react";
import type {
  CoachProfileCheckReport,
  CoachProfileCheckScope,
  CoachProfileFinding,
} from "@/lib/coach-openai-profile-check-service";

type Props = {
  coachId: string;
  lastChecked?: string | null;
  report: CoachProfileCheckReport | null;
  busy?: boolean;
  onRun: (scope: CoachProfileCheckScope) => void;
  onAcceptFinding?: (finding: CoachProfileFinding) => void;
  onDismissFinding?: (finding: CoachProfileFinding) => void;
  onSafeAction?: (action: "recalculate" | "refresh-wikipedia" | "refresh-rugbypass" | "refresh-links") => void;
};

function severityClass(s: string): string {
  if (s === "HIGH") return "bg-red-950 text-red-300 border-red-800";
  if (s === "MEDIUM") return "bg-amber-950 text-amber-300 border-amber-800";
  return "bg-zinc-900 text-zinc-300 border-zinc-700";
}

function fmtValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function CoachCmsOpenAiProfileCheckPanel({
  coachId: _coachId,
  lastChecked,
  report,
  busy,
  onRun,
  onAcceptFinding,
  onDismissFinding,
  onSafeAction,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="cms-card mb-4 border border-sky-900/50">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-sky-500/90 mb-1">
            OpenAI Profile Check
          </div>
          <h3 className="font-semibold m-0">Analysis layer — not a data source</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Retrieves available sources first, then audits the CMS record. Nothing publishes
            automatically.
          </p>
          <p className="text-xs text-zinc-600 mt-1 mb-0">
            Last checked:{" "}
            {lastChecked
              ? new Date(lastChecked).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy}
            onClick={() => onRun("full")}
          >
            {busy ? "Checking…" : "Check profile with OpenAI"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy}
            onClick={() => onRun("career")}
          >
            Check career
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy}
            onClick={() => onRun("honours")}
          >
            Check honours
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy}
            onClick={() => onRun("bio")}
          >
            Check bio
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy}
            onClick={() => onRun("images")}
          >
            Check images
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy}
            onClick={() => onRun("stats")}
          >
            Check stats
          </button>
        </div>
      </div>

      {report ? (
        <>
          <div className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-3 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="text-[11px] uppercase text-zinc-500">Profile health</div>
                <div className="text-2xl font-bold text-emerald-300">{report.profileHealth}%</div>
              </div>
              <div className="flex-1 min-w-[12rem]">
                <div className="text-sm text-zinc-200 font-medium">PROFILE CHECK COMPLETE</div>
                <div className="text-sm text-zinc-400 mt-0.5">{report.summary.headline}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold tracking-wide">
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
                    {report.summary.missing} missing
                  </span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
                    {report.summary.conflicts} conflicts
                  </span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
                    {report.summary.improvements} improvements
                  </span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
                    {report.summary.missingCrest} missing crest
                  </span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
                    {report.summary.verified} verified
                  </span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
                    {report.summary.calculationGaps} calc gaps
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {report.sections.map((s) => (
                <div key={s.id} className="rounded border border-zinc-800 px-2.5 py-2">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>{s.label}</span>
                    <span className="text-zinc-100 font-semibold">{s.score}%</span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {report.nextBestActions.length > 0 ? (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                Next best actions
              </div>
              <ol className="m-0 pl-4 text-sm text-zinc-300 space-y-1">
                {report.nextBestActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => onSafeAction?.("recalculate")}
            >
              Recalculate
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => onSafeAction?.("refresh-links")}
            >
              Refresh match links
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => onSafeAction?.("refresh-wikipedia")}
            >
              Refresh Wikipedia
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => onSafeAction?.("refresh-rugbypass")}
            >
              Refresh RugbyPass
            </button>
          </div>

          <div className="mb-2 text-xs text-zinc-500">
            Sources used:{" "}
            {report.sourcesUsed
              .map((s) => `${s.label}${s.retrieved ? " ✓" : " (not retrieved)"}`)
              .join(" · ")}
          </div>

          <div className="space-y-2">
            {report.findings.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">No findings.</p>
            ) : (
              report.findings.map((f) => {
                const open = expandedId === f.id;
                return (
                  <div key={f.id} className="rounded border border-zinc-800 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        className="text-left bg-transparent border-0 p-0 cursor-pointer"
                        onClick={() => setExpandedId(open ? null : f.id)}
                      >
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-sm font-semibold text-zinc-100">{f.label}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${severityClass(f.severity)}`}
                          >
                            {f.severity}
                          </span>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border border-zinc-700 text-zinc-300">
                            {f.issueType}
                          </span>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border border-sky-900 text-sky-300">
                            {f.suggestionClass}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">{f.rationale}</div>
                      </button>
                      <div className="flex flex-wrap gap-1">
                        {f.recommendedAction === "ACCEPT" || f.recommendedAction === "EDIT" ? (
                          <button
                            type="button"
                            className="cms-btn cms-btn--primary text-xs"
                            onClick={() => onAcceptFinding?.(f)}
                          >
                            Accept
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs"
                          onClick={() => onDismissFinding?.(f)}
                        >
                          Keep current
                        </button>
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs"
                          onClick={() => onDismissFinding?.(f)}
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                        <div className="rounded bg-zinc-950/80 border border-zinc-800 p-2">
                          <div className="text-zinc-500 mb-1">Current Rugby365</div>
                          <div className="text-zinc-200 font-mono break-all">
                            {fmtValue(f.currentValue)}
                          </div>
                        </div>
                        <div className="rounded bg-zinc-950/80 border border-zinc-800 p-2">
                          <div className="text-zinc-500 mb-1">OpenAI check result</div>
                          <div className="text-zinc-200 font-mono break-all">
                            {fmtValue(f.foundValue)}
                          </div>
                        </div>
                        <div className="sm:col-span-2 text-zinc-500">
                          Sources: {f.sources.length ? f.sources.join(", ") : "—"} · Confidence:{" "}
                          {f.confidence} · Action: {f.recommendedAction}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500 m-0">
          Run a full check to see profile health, conflicts, missing data, and backfill
          recommendations.
        </p>
      )}
    </div>
  );
}
