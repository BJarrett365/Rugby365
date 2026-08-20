"use client";

import Link from "next/link";
import type { CoachCmsCompleteness } from "@/lib/coach-cms-completeness";

type Props = {
  coachName: string;
  currentTeam: string | null;
  currentRole: string | null;
  slug: string | null;
  publishStatus: string;
  completeness: CoachCmsCompleteness;
  lastUpdated: string | null;
  lastVerifiedAt: string | null;
  lastDataCheck: string | null;
  lastRatingAt: string | null;
  saving?: boolean;
  busyAction?: string;
  onSave: () => void;
  onPublish: () => void;
  onCheckData: () => void;
  onFindMissing: () => void;
  onRefreshStats: () => void;
  onRecalculateRating: () => void;
  onOpenAiProfileCheck?: () => void;
  onTab: (tab: string) => void;
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CoachCmsWorkflowHeader({
  coachName,
  currentTeam,
  currentRole,
  slug,
  publishStatus,
  completeness,
  lastUpdated,
  lastVerifiedAt,
  lastDataCheck,
  lastRatingAt,
  saving,
  busyAction,
  onSave,
  onPublish,
  onCheckData,
  onFindMissing,
  onRefreshStats,
  onRecalculateRating,
  onOpenAiProfileCheck,
  onTab,
}: Props) {
  const statusLabel = completeness.workflowStatus.replace(/_/g, " ").toUpperCase();

  return (
    <div className="cms-card mb-4 border border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Coach CMS</div>
          <h1 className="m-0 text-xl font-bold text-zinc-50">{coachName || "Coach"}</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">
            {currentRole || "No current role"}
            {currentTeam ? ` · ${currentTeam}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              {statusLabel}
            </span>
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-300">
              Public: {publishStatus}
            </span>
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-100">
              Profile complete {completeness.percent}%
            </span>
          </div>
          {completeness.issues.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {completeness.issues.map((issue) => (
                <span
                  key={issue}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-amber-950 text-amber-300 border border-amber-800"
                >
                  {issue}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 justify-end max-w-xl">
          <button type="button" className="cms-btn cms-btn--primary" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </button>
          {slug ? (
            <Link
              href={`/coaches/${slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null}
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={Boolean(busyAction)}
            onClick={onPublish}
          >
            Publish
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={busyAction === "check"}
            onClick={onCheckData}
          >
            {busyAction === "check" ? "Checking…" : "Check data"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={busyAction === "missing"}
            onClick={onFindMissing}
          >
            {busyAction === "missing" ? "Scanning…" : "Find missing data"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={busyAction === "stats"}
            onClick={onRefreshStats}
          >
            {busyAction === "stats" ? "Refreshing…" : "Refresh stats"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={busyAction === "rating"}
            onClick={onRecalculateRating}
          >
            {busyAction === "rating" ? "Calculating…" : "Recalculate rating"}
          </button>
          {onOpenAiProfileCheck ? (
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={busyAction === "openai"}
              onClick={onOpenAiProfileCheck}
            >
              {busyAction === "openai" ? "OpenAI checking…" : "Check profile with OpenAI"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-500">
        <div>
          Last updated
          <div className="text-zinc-300">{fmt(lastUpdated)}</div>
        </div>
        <div>
          Last data check
          <div className="text-zinc-300">{fmt(lastDataCheck)}</div>
        </div>
        <div>
          Last verified
          <div className="text-zinc-300">{fmt(lastVerifiedAt)}</div>
        </div>
        <div>
          Last rating calculation
          <div className="text-zinc-300">{fmt(lastRatingAt)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {completeness.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="text-left rounded border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 hover:border-zinc-600"
            onClick={() => onTab(section.tab)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400">{section.label}</span>
              <span className="text-[11px] font-semibold text-zinc-100">{section.score}%</span>
            </div>
            <div className="mt-1 h-1 rounded bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.max(0, Math.min(100, section.score))}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
