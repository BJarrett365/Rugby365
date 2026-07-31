import type { Metadata } from "next";
import Link from "next/link";
import { LegendsGrid } from "@/components/legends/LegendsGrid";
import { getPublicLegendsHub } from "@/lib/public-legends-service";

export const metadata: Metadata = {
  title: "Planet Rugby Legends — Players Who Defined Every Era | Rugby365",
  description:
    "The Planet Rugby Legends database: iconic players by era and collection, linked to full Rugby365 player profiles.",
  alternates: { canonical: "/legends" },
};

type PageProps = {
  searchParams: Promise<{ era?: string; collection?: string; q?: string }>;
};

export default async function LegendsHubPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const hub = await getPublicLegendsHub();
  const era = sp.era?.trim() || null;
  const collection = sp.collection?.trim() || null;
  const q = sp.q?.trim() || null;

  const filtered = hub.legends.filter((l) => {
    if (era && l.eraSlug !== era && !l.era?.includes(era)) return false;
    if (collection && !l.collections.includes(collection)) return false;
    if (q) {
      const hay = `${l.name} ${l.countryName ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const activeCollection = hub.collections.find((c) => c.slug === collection);

  return (
    <article className="pr-mc-fixtures-page pr-legends-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Home</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">Legends</span>
      </nav>

      <header className="pr-legends-header">
        <p className="pr-mc-pr-badge">Planet Rugby Legends</p>
        <h1>Legends</h1>
        <p className="pr-legends-header__lede">
          The players who defined each era of rugby — linked to full Rugby365 profiles.{" "}
          {hub.total.toLocaleString("en-GB")} published legend
          {hub.total === 1 ? "" : "s"} in the database.
        </p>
        <p className="pr-legends-header__links">
          <Link href="/players">Player directory</Link>
          <span aria-hidden>·</span>
          <Link href="/players/compare">Compare players</Link>
        </p>
      </header>

      <form className="pr-player-filters" method="get" role="search">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name or nation"
            className="pr-players-directory__search"
          />
        </label>
        {era ? <input type="hidden" name="era" value={era} /> : null}
        {collection ? <input type="hidden" name="collection" value={collection} /> : null}
        <button type="submit" className="pr-player-filters__submit">
          Search
        </button>
        {era || collection || q ? (
          <Link href="/legends" className="pr-player-filters__submit">
            Clear
          </Link>
        ) : null}
      </form>

      <section className="pr-legends-section" aria-labelledby="legends-eras">
        <h2 id="legends-eras">Browse by era</h2>
        <ul className="pr-legends-chip-row">
          {hub.eras.map((e) => (
            <li key={e.slug}>
              <Link
                href={`/legends/eras/${e.slug}`}
                className={`pr-legends-chip${era === e.slug ? " is-active" : ""}`}
              >
                {e.label}
                <span>{e.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-legends-section" aria-labelledby="legends-collections">
        <h2 id="legends-collections">Collections</h2>
        <ul className="pr-legends-collections">
          {hub.collections.map((col) => (
            <li key={col.slug}>
              <Link
                href={`/legends/collections/${col.slug}`}
                className={`pr-legends-collection-card${
                  collection === col.slug ? " is-active" : ""
                }`}
              >
                <h3>{col.label}</h3>
                <p>{col.description}</p>
                <span className="pr-legends-collection-card__meta">
                  {col.count} {col.entityKind === "coach" ? "coach" : "player"}
                  {col.count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-legends-section" aria-labelledby="legends-list">
        <h2 id="legends-list">
          {activeCollection
            ? activeCollection.label
            : era
              ? `Era: ${era}`
              : q
                ? `Results for “${q}”`
                : "All legends"}
        </h2>
        <LegendsGrid legends={filtered} />
      </section>
    </article>
  );
}
