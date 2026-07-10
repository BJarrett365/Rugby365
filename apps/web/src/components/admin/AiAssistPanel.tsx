"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AiEnrichmentPayload,
  AiEnrichmentTask,
  AiEntityType,
  AiVerificationReportPayload,
} from "@/lib/ai-enrichment-types";

type SuggestionRow = {
  id: string;
  task: string;
  status: string;
  createdAt: string;
  suggestions: AiEnrichmentPayload;
};

type VerificationRow = {
  id: string;
  status: string;
  createdAt: string;
  confidenceScore: number | null;
  report: AiVerificationReportPayload;
};

const TASKS: Array<{ task: AiEnrichmentTask; label: string }> = [
  { task: "generate_bio", label: "Generate bio" },
  { task: "check_missing", label: "Check missing data" },
  { task: "check_duplicates", label: "Check duplicates" },
  { task: "compare_sources", label: "Compare sources" },
  { task: "suggest_aliases", label: "Suggest aliases" },
];

export function AiAssistPanel({
  entityType,
  entityId,
  onApplied,
}: {
  entityType: AiEntityType;
  entityId: string;
  onApplied?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [reports, setReports] = useState<VerificationRow[]>([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [allowOverwrite, setAllowOverwrite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ entityType, entityId });
    const [enrichRes, verifyRes] = await Promise.all([
      fetch(`/api/admin/ai/enrich?${qs}`),
      fetch(`/api/admin/ai/verify?${qs}`),
    ]);
    const enrichData = await enrichRes.json();
    const verifyData = await verifyRes.json();
    if (!enrichRes.ok) setError(enrichData.error ?? "Failed to load AI suggestions");
    else setSuggestions(enrichData.suggestions ?? []);
    if (verifyRes.ok) setReports(verifyData.reports ?? []);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSuggestion = useMemo(
    () => suggestions.find((row) => row.id === activeSuggestionId) ?? suggestions[0] ?? null,
    [suggestions, activeSuggestionId],
  );

  useEffect(() => {
    if (!activeSuggestion) return;
    setActiveSuggestionId(activeSuggestion.id);
    setSelectedFields(
      activeSuggestion.suggestions.fieldSuggestions
        .filter((field) => !field.overwriteRequired)
        .map((field) => field.field),
    );
  }, [activeSuggestion?.id]);

  async function runTask(task: AiEnrichmentTask) {
    setRunningTask(task);
    setError("");
    const res = await fetch("/api/admin/ai/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, task }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "AI enrichment failed");
    } else {
      setActiveSuggestionId(data.suggestion.id);
      await load();
    }
    setRunningTask(null);
  }

  async function createVerificationReport() {
    setVerifying(true);
    setError("");
    const res = await fetch("/api/admin/ai/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Verification failed");
    else await load();
    setVerifying(false);
  }

  async function approveSuggestion() {
    if (!activeSuggestion || activeSuggestion.status !== "pending") return;
    const res = await fetch(`/api/admin/ai/suggestions/${activeSuggestion.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        approvedFields: selectedFields,
        allowOverwrite,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Approve failed");
      return;
    }
    await load();
    onApplied?.();
  }

  async function rejectSuggestion() {
    if (!activeSuggestion || activeSuggestion.status !== "pending") return;
    const res = await fetch(`/api/admin/ai/suggestions/${activeSuggestion.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Reject failed");
    else await load();
  }

  const latestReport = reports[0] ?? null;

  return (
    <div className="cms-card mb-4 border border-violet-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold m-0">AI Assist</h3>
        <span className="text-xs text-zinc-500">Suggestions require editor approval before publishing</span>
      </div>
      <p className="text-sm text-zinc-500 mt-0 mb-3">
        OpenAI helps summarise verified Rugby365 data, spot gaps, compare sources, and flag conflicts.
        Database, SDMS, Planet Rugby, RugbyPass, and Wikipedia remain the sources of truth.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {TASKS.map((item) => (
          <button
            key={item.task}
            type="button"
            className="cms-btn cms-btn--secondary touch-target"
            disabled={Boolean(runningTask) || verifying}
            onClick={() => void runTask(item.task)}
          >
            {runningTask === item.task ? "Running…" : item.label}
          </button>
        ))}
        <button
          type="button"
          className="cms-btn touch-target"
          disabled={Boolean(runningTask) || verifying}
          onClick={() => void createVerificationReport()}
        >
          {verifying ? "Building report…" : "Create verification report"}
        </button>
      </div>

      {error ? <p className="text-red-400 text-sm m-0 mb-3">{error}</p> : null}
      {loading ? <p className="text-sm text-zinc-500 m-0">Loading AI history…</p> : null}

      {activeSuggestion ? (
        <section className="space-y-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium m-0 text-sm">
              Latest suggestion: {activeSuggestion.task.replaceAll("_", " ")}
            </h4>
            <span className="text-xs text-zinc-500">{activeSuggestion.status}</span>
            {suggestions.length > 1 ? (
              <select
                className="cms-input text-sm"
                value={activeSuggestion.id}
                onChange={(e) => setActiveSuggestionId(e.target.value)}
              >
                {suggestions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.task} · {new Date(row.createdAt).toLocaleString()} · {row.status}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {activeSuggestion.suggestions.textSuggestions.length > 0 ? (
            <div className="space-y-2">
              {activeSuggestion.suggestions.textSuggestions.map((item) => (
                <div key={item.key} className="rounded border border-zinc-800 p-3 text-sm">
                  <p className="m-0 font-medium">{item.label}</p>
                  <p className="m-0 mt-1 text-zinc-300 whitespace-pre-wrap">{item.text}</p>
                  <p className="m-0 mt-2 text-xs text-zinc-500">{item.rationale}</p>
                </div>
              ))}
            </div>
          ) : null}

          {activeSuggestion.suggestions.fieldSuggestions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="cms-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Apply</th>
                    <th>Field</th>
                    <th>Suggested</th>
                    <th>Current</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSuggestion.suggestions.fieldSuggestions.map((field) => (
                    <tr key={field.field}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.field)}
                          disabled={activeSuggestion.status !== "pending"}
                          onChange={(e) => {
                            setSelectedFields((current) =>
                              e.target.checked
                                ? [...current, field.field]
                                : current.filter((value) => value !== field.field),
                            );
                          }}
                        />
                      </td>
                      <td>
                        {field.label}
                        {field.overwriteRequired ? (
                          <span className="text-xs text-amber-400 block">Overwrite required</span>
                        ) : null}
                      </td>
                      <td>{String(field.suggestedValue ?? "—")}</td>
                      <td>{String(field.currentValue ?? "—")}</td>
                      <td>{Math.round(field.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeSuggestion.suggestions.duplicateWarnings.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium m-0 mb-1">Duplicate warnings</p>
              <ul className="m-0 pl-4 text-zinc-300">
                {activeSuggestion.suggestions.duplicateWarnings.map((warning) => (
                  <li key={warning.entityId}>
                    {warning.name} ({warning.slug}) — {warning.rationale}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeSuggestion.suggestions.aliasSuggestions.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium m-0 mb-1">Alias suggestions</p>
              <ul className="m-0 pl-4 text-zinc-300">
                {activeSuggestion.suggestions.aliasSuggestions.map((alias) => (
                  <li key={alias.alias}>
                    {alias.alias} — seen in {alias.seenIn.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeSuggestion.suggestions.missingFields.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium m-0 mb-1">Missing fields</p>
              <p className="m-0 text-zinc-300">
                {activeSuggestion.suggestions.missingFields
                  .map((field) => `${field.label} (${field.importance})`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}

          {activeSuggestion.status === "pending" ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowOverwrite}
                  onChange={(e) => setAllowOverwrite(e.target.checked)}
                />
                Allow overwrite of populated fields
              </label>
              <button type="button" className="cms-btn touch-target" onClick={() => void approveSuggestion()}>
                Approve selected fields
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary touch-target"
                onClick={() => void rejectSuggestion()}
              >
                Reject suggestion
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {latestReport ? (
        <section className="space-y-3 border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium m-0 text-sm">Verification report</h4>
            <span className="text-xs text-zinc-500">
              {latestReport.confidenceScore != null
                ? `${Math.round(latestReport.confidenceScore * 100)}% confidence`
                : "No score"}
            </span>
            <span className="text-xs text-zinc-500">{latestReport.status}</span>
          </div>
          <p className="text-sm text-zinc-300 m-0">{latestReport.report.summary}</p>

          {latestReport.report.conflictingFields.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium m-0 mb-1">Conflicts</p>
              <ul className="m-0 pl-4 text-zinc-300">
                {latestReport.report.conflictingFields.map((conflict) => (
                  <li key={conflict.field}>
                    {conflict.label}:{" "}
                    {conflict.values.map((value) => `${value.source}=${value.value ?? "—"}`).join(" vs ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {latestReport.report.editorActions.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium m-0 mb-1">Suggested editor actions</p>
              <ul className="m-0 pl-4 text-zinc-300">
                {latestReport.report.editorActions.map((action) => (
                  <li key={`${action.priority}-${action.action}`}>
                    [{action.priority}] {action.action} — {action.rationale}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {latestReport.report.sourceUrls.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium m-0 mb-1">Source URLs</p>
              <ul className="m-0 pl-4">
                {latestReport.report.sourceUrls.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
