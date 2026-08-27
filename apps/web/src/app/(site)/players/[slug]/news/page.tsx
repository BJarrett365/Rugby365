import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicPlayerNews } from "@/lib/public-player-news-service";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

function sourceLabel(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes("ultimate")) return "Ultimate Rugby";
  if (p.includes("alamy")) return "Alamy";
  if (p.includes("planet")) return "Planet Rugby";
  if (p.includes("springbok")) return "Springboks";
  if (p.includes("rugby365")) return "Rugby365";
  return provider.replace(/_/g, " ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: false });
  const name = overview?.displayName ?? slug;
  return {
    title: `News | ${name} | Rugby365`,
    description: `Latest news and mentions for ${name}`,
  };
}

export default async function PlayerNewsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, {
    preview: isPreviewParam(sp.preview),
  });
  if (!overview) notFound();

  const items = await getPublicPlayerNews(overview.playerId, 50);

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "News" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="news" />
      <div className="pr-player-v2__hero-lead">
        <PlayerIdentityHero overview={overview} />
      </div>
      <div className="pr-player-v2__body">
        <header>
          <p className="pr-player-v2__kicker">Player news</p>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>{overview.displayName}</h1>
          <p className="pr-player-v2__note">
            Sourced headlines linked to this player. SA rugby feeds will keep this current.
          </p>
        </header>

        <section className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Latest</h2>
          </div>
          {items.length === 0 ? (
            <p className="pr-player-v2__empty">
              No linked news items yet for this player. Check back after the next SA news sync.
            </p>
          ) : (
            <ul className="pr-pnews__list">
              {items.map((item) => (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                  <span>
                    {sourceLabel(item.sourceProvider)}
                    {item.publishedLabel ? ` · ${item.publishedLabel}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pr-player-v2__note" style={{ marginTop: "1rem" }}>
          More coverage:{" "}
          <Link href="https://rugby365.com/countries/south-africa/" target="_blank" rel="noopener">
            Rugby365 SA
          </Link>
          {" · "}
          <Link href="https://springboks.rugby/" target="_blank" rel="noopener">
            Springboks
          </Link>
          {" · "}
          <Link href="https://www.planetrugby.com/team/south-africa" target="_blank" rel="noopener">
            Planet Rugby
          </Link>
        </p>
      </div>
    </article>
  );
}
