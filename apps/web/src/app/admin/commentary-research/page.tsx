"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Product = {
  slug: string;
  name: string;
  role: string;
  learnFrom: string[];
  doNotCopy: string[];
  matchCentrePatterns?: string[];
  commentaryPatterns?: string[];
};

type Finding = {
  id: string;
  provider: string;
  eventType: string;
  category: string;
  style: { ordering: string; frequency: string; importance: string };
  presentation: {
    minuteFormat: string;
    includesScore: boolean;
    includesTeam: boolean;
    tone: string;
    sentenceLength: string;
  };
  researchNotes: string;
  templateGuidance: string;
  rugby365TemplateKeys: string[];
};

type ApiResponse = {
  policy: { noCopyrightedText: boolean; originalTemplatesOnly: boolean };
  referenceProducts: Product[];
  findings: Finding[];
  rugby365Templates: { templateKey: string; body: string; eventTypes: string[]; tone: string }[];
  stats: { findingCount: number; templateCount: number; eventTypes: string[] };
};

const PROVIDERS = ["planet_rugby", "sport365", "espn_scrum", "statscore", "all_rugby"];

export default function CommentaryResearchPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [eventType, setEventType] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (provider) params.set("provider", provider);
    if (eventType) params.set("eventType", eventType);
    const res = await fetch(`/api/admin/commentary-research?${params}`);
    setData((await res.json()) as ApiResponse);
  }, [provider, eventType]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="DataHub"
        title="Commentary research"
        description="Reference product analysis — structural metadata only. No copyrighted commentary text."
        actions={
          <button type="button" className="cms-btn cms-btn--secondary no-print" onClick={() => window.print()}>
            Print
          </button>
        }
      />

      {data?.policy && (
        <p className="text-sm text-zinc-500 mb-4">
          Policy: original templates only · facts from structured data · {data.stats.findingCount} findings ·{" "}
          {data.stats.templateCount} Rugby365 templates
        </p>
      )}

      <section className="cms-card no-print mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-zinc-400">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="cms-select block mt-1"
            >
              <option value="">All</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-400">
            Event type
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="cms-select block mt-1"
            >
              <option value="">All</option>
              {(data?.stats.eventTypes ?? []).map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {data && (
        <div className="cms-split">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 m-0">Reference products</h2>
            {data.referenceProducts.map((p) => (
              <article key={p.slug} className="cms-card">
                <p className="text-xs text-amber-400 uppercase m-0">{p.role.replace(/_/g, " ")}</p>
                <h3 className="font-semibold m-0 mt-1">{p.name}</h3>
                <p className="text-xs text-zinc-500 mt-2 mb-1">Learn from</p>
                <ul className="text-sm text-zinc-400 m-0 pl-4">
                  {p.learnFrom.slice(0, 5).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="text-xs text-zinc-500 mt-2 mb-1">Do not copy</p>
                <ul className="text-sm text-zinc-500 m-0 pl-4">
                  {p.doNotCopy.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 m-0">Research findings</h2>
            {data.findings.slice(0, 24).map((f) => (
              <article key={f.id} className="cms-card">
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  <span className="text-violet-400">{f.provider}</span>
                  <span className="text-emerald-400">{f.eventType}</span>
                  <span className="text-zinc-500">{f.category}</span>
                  <span className="text-zinc-600">{f.style.importance} · {f.presentation.tone}</span>
                </div>
                <p className="text-sm text-zinc-300 m-0">{f.templateGuidance}</p>
                <p className="text-xs text-zinc-500 mt-2 m-0">{f.researchNotes}</p>
                <p className="text-xs text-zinc-600 mt-2 m-0">
                  Templates: {f.rugby365TemplateKeys.join(", ")}
                </p>
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
