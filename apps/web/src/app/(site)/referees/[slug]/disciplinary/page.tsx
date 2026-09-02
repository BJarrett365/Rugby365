import type { Metadata } from "next";
import { RefereeProfileChrome } from "@/components/referees/RefereeProfileChrome";
import { requireRefereeDashboard } from "@/lib/load-referee-dashboard";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await requireRefereeDashboard(slug);
  return {
    title: `Disciplinary | ${loaded.model.name} | Rugby365`,
    description: `Disciplinary record for ${loaded.model.name}`,
  };
}

export default async function RefereeDisciplinaryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { model, profile } = await requireRefereeDashboard(slug, sp.preview);
  return (
    <RefereeProfileChrome model={model} active="disciplinary" preview={profile.preview}>
      <div className="pr-player-v2__grid">
        <section className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Disciplinary record</h2>
          </div>
          <div className="pr-player-v2__appearance-role-grid">
            {model.disciplinary.map((row) => (
              <div key={row.key}>
                <strong>{row.careerTotal}</strong>
                <span>
                  {row.label} · {row.perMatch.toFixed(2)} / match
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </RefereeProfileChrome>
  );
}
