import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { BETTING_INTEL_MODEL } from "@/lib/match-betting-intelligence-math";
import { readKnowledgePage } from "@/lib/knowledge-service";

export const metadata = {
  title: "Betting R&D · Odds · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default async function BettingIntelligenceRdPage() {
  const doc = await readKnowledgePage("betting-intelligence-rd");
  const content = doc?.content ?? "_Document missing — create docs/knowledge/betting-intelligence-rd.md._";

  return (
    <>
      <PageHeader
        eyebrow="Odds · Research & Development"
        title="Betting Intelligence R&D"
        description="Frozen production algorithm, accuracy lessons, and the roadmap to call-tier ~70% picks. Append-only improvement log in Knowledge Base."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/odds/model-accuracy" className="cms-btn cms-btn--secondary">
              Model accuracy
            </Link>
            <Link
              href="/admin/knowledge/betting-intelligence-rd"
              className="cms-btn cms-btn--primary"
            >
              Edit lab notes
            </Link>
          </div>
        }
      />

      <section className="cms-card bi-rd-summary mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--pr-grey)]">Production model</span>
            <p className="m-0 mt-1 font-mono text-[var(--pr-gold)]">{BETTING_INTEL_MODEL}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--pr-grey)]">Baseline frozen</span>
            <p className="m-0 mt-1 text-[var(--pr-white)]">2026-08-01</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--pr-grey)]">Next build</span>
            <p className="m-0 mt-1 text-[var(--pr-white)]">Phase 0 snapshots · Phase B altitude</p>
          </div>
        </div>
        <ul className="mt-4 mb-0 flex flex-wrap gap-3 list-none p-0 text-sm">
          <li>
            <Link href="/admin/odds" className="text-[var(--pr-gold)] hover:underline">
              Odds hub
            </Link>
          </li>
          <li>
            <Link href="/admin/knowledge" className="text-[var(--pr-gold)] hover:underline">
              Knowledge Base
            </Link>
          </li>
          <li>
            <Link href="/admin/knowledge/player-value" className="text-[var(--pr-gold)] hover:underline">
              Ratings &amp; Market Value
            </Link>
          </li>
        </ul>
      </section>

      <section className="cms-card">
        <h2 className="cms-section-title m-0 mb-3">Lab notes (source of truth)</h2>
        <p className="text-sm text-[var(--pr-grey)] mt-0 mb-3">
          Read-only mirror. Use <strong>Edit lab notes</strong> to append the improvement log after each
          experiment — never rewrite the v1 baseline section in place.
        </p>
        <pre className="whitespace-pre-wrap text-sm m-0 text-[var(--pr-white)] leading-relaxed font-sans">
          {content}
        </pre>
      </section>
    </>
  );
}
