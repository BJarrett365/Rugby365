import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionSeasonShirtPage } from "@/components/shirts/CompetitionSeasonShirtPage";
import {
  getCompetitionShirtLibraryPage,
  listShirtLibraryCompetitionHub,
} from "@/lib/shirt-library-public-service";
import "@/styles/shirt-library-public.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitionSlug: string; seasonSlug: string }>;
}) {
  const { competitionSlug, seasonSlug } = await params;
  const data = await getCompetitionShirtLibraryPage({
    competitionSlug,
    seasonSlug,
    preview: true,
  });
  if (!data || data.blocked) {
    return { title: "Shirt Library · Rugby365" };
  }
  return {
    title: `${data.competition.name} ${data.season.label} Home and Away Shirts | Rugby365`,
    description: `View the approved Rugby365 home and away shirt designs for every team in ${data.competition.name} ${data.season.label}, including club links, team colours and competition details.`,
    alternates: {
      canonical: `/shirt-library/${data.competition.slug}/${data.season.slug}`,
    },
    openGraph: {
      title: `${data.competition.name} ${data.season.label} Shirts | Rugby365`,
      description: data.about.slice(0, 160),
    },
  };
}

export default async function ShirtLibrarySeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ competitionSlug: string; seasonSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { competitionSlug, seasonSlug } = await params;
  const sp = await searchParams;
  const preview = sp.preview === "1";

  const [data, hub] = await Promise.all([
    getCompetitionShirtLibraryPage({ competitionSlug, seasonSlug, preview }),
    listShirtLibraryCompetitionHub(competitionSlug),
  ]);

  if (!data) notFound();
  if (data.blocked) {
    return (
      <div className="slp">
        <div className="slp__empty">
          <h1 className="slp__title" style={{ fontSize: "1.4rem" }}>
            {data.competition.name} {data.season.label}
          </h1>
          <p>This shirt guide is not published yet.</p>
          <p style={{ fontSize: "0.9rem" }}>
            Publish it from Admin → Shirt Library, or{" "}
            <Link href={`/shirt-library/${competitionSlug}/${seasonSlug}?preview=1`}>
              preview
            </Link>
            .
          </p>
          <Link className="slp__btn" href={`/shirt-library/${competitionSlug}`}>
            Back to competition
          </Link>
        </div>
      </div>
    );
  }

  const allSeasons = (hub?.seasons ?? []).map((s) => ({ slug: s.slug, label: s.label }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${data.competition.name} ${data.season.label} Shirt Designs`,
    description: `Approved Rugby365 home and away shirt designs for ${data.competition.name} ${data.season.label}.`,
    url: `/shirt-library/${data.competition.slug}/${data.season.slug}`,
    about: {
      "@type": "SportsOrganization",
      name: data.competition.name,
    },
    hasPart: data.teams.map((t) => ({
      "@type": "SportsTeam",
      name: t.name,
      url: t.clubHref,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CompetitionSeasonShirtPage data={data} allSeasons={allSeasons} />
    </>
  );
}
