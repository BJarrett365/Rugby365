import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovedRugbyShirt } from "@/components/shirts/ApprovedRugbyShirt";
import {
  getTeamShirtLibraryDetailPage,
  type PublicApprovedShirt,
} from "@/lib/shirt-library-public-service";
import "@/styles/shirt-library-public.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitionSlug: string; seasonSlug: string; teamSlug: string }>;
}) {
  const { competitionSlug, seasonSlug, teamSlug } = await params;
  const data = await getTeamShirtLibraryDetailPage({
    competitionSlug,
    seasonSlug,
    teamSlug,
    preview: true,
  });
  if (!data || data.blocked || !("team" in data)) {
    return { title: "Team shirts · Rugby365" };
  }
  return {
    title: `${data.team.name} Shirts · ${data.competition.name} ${data.season.label} | Rugby365`,
    description: `Approved Rugby365 shirt designs for ${data.team.name} in ${data.competition.name} ${data.season.label}.`,
  };
}

function KitBlock({
  label,
  shirt,
  crestUrl,
}: {
  label: string;
  shirt: PublicApprovedShirt | null;
  crestUrl: string | null;
}) {
  return (
    <div className="slp__panel" style={{ textAlign: "center" }}>
      <h2 className="slp__section-title">{label}</h2>
      {shirt ? (
        <>
          <ApprovedRugbyShirt config={shirt.svgConfig} size={140} crestUrl={crestUrl} />
          <dl className="slp__facts" style={{ textAlign: "left", marginTop: "0.75rem" }}>
            <dt>Body</dt>
            <dd>{shirt.bodyColour}</dd>
            {shirt.secondaryColour ? (
              <>
                <dt>Secondary</dt>
                <dd>{shirt.secondaryColour}</dd>
              </>
            ) : null}
            <dt>Pattern</dt>
            <dd>{shirt.patternType}</dd>
            <dt>Version</dt>
            <dd>v{shirt.versionNumber}</dd>
            <dt>Status</dt>
            <dd>Approved</dd>
          </dl>
        </>
      ) : (
        <div className="slp__awaiting" style={{ width: "100%", minHeight: 140 }}>
          Shirt Awaiting Approval
        </div>
      )}
    </div>
  );
}

export default async function ShirtLibraryTeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ competitionSlug: string; seasonSlug: string; teamSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { competitionSlug, seasonSlug, teamSlug } = await params;
  const sp = await searchParams;
  const data = await getTeamShirtLibraryDetailPage({
    competitionSlug,
    seasonSlug,
    teamSlug,
    preview: sp.preview === "1",
  });

  if (!data) notFound();
  if (data.blocked || !("team" in data)) {
    return (
      <div className="slp">
        <div className="slp__empty">
          <p>This shirt guide is not published yet.</p>
          <Link
            className="slp__btn"
            href={`/shirt-library/${competitionSlug}/${seasonSlug}?preview=1`}
          >
            Preview season
          </Link>
        </div>
      </div>
    );
  }

  const { team } = data;
  const flagUrl = team.countryIso
    ? `https://flagcdn.com/w40/${team.countryIso.toLowerCase()}.png`
    : null;

  return (
    <div className="slp" style={{ ["--slp-accent-dynamic" as string]: data.accentColour }}>
      <nav className="slp__breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shirt-library">Shirt Library</Link>
        <span>/</span>
        <Link href={`/shirt-library/${data.competition.slug}`}>{data.competition.name}</Link>
        <span>/</span>
        <Link href={`/shirt-library/${data.competition.slug}/${data.season.slug}`}>
          {data.season.label}
        </Link>
        <span>/</span>
        <span>{team.name}</span>
      </nav>

      <header className="slp__header">
        <div className="slp__card-head">
          {team.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="slp__card-logo" src={team.imageUrl} alt="" style={{ width: 64, height: 64 }} />
          ) : null}
          <div>
            <h1 className="slp__title" style={{ fontSize: "1.8rem" }}>
              {team.name}
            </h1>
            <p className="slp__card-country">
              {flagUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flagUrl} alt="" width={20} height={14} />
              ) : null}
              {team.countryName ?? "—"} · {data.competition.name} · {data.season.label}
            </p>
          </div>
        </div>
        <div className="slp__card-actions">
          <Link className="slp__btn slp__btn--primary" href={team.clubHref}>
            View club profile
          </Link>
          <Link
            className="slp__btn"
            href={`/shirt-library/${data.competition.slug}/${data.season.slug}`}
          >
            All teams
          </Link>
        </div>
      </header>

      <div className="slp__panels">
        <KitBlock label="Home" shirt={team.home} crestUrl={team.imageUrl} />
        <KitBlock label="Away" shirt={team.away} crestUrl={team.imageUrl} />
        {team.third || data.readiness.thirdRequired ? (
          <KitBlock label="Third" shirt={team.third} crestUrl={team.imageUrl} />
        ) : null}
      </div>

      {data.siblingSeasons.length ? (
        <section className="slp__section">
          <h2 className="slp__section-title">Other seasons</h2>
          <div className="slp__season-links">
            {data.siblingSeasons.map((s) => (
              <Link key={s.id} className="slp__btn" href={s.href}>
                {s.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
