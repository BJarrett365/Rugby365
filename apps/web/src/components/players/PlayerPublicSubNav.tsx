import Link from "next/link";

type SubNavItem = {
  id: string;
  label: string;
  /** Relative path under /players/[slug]/; empty = overview. Absolute paths start with /. */
  href: string;
};

const SUB_NAV: SubNavItem[] = [
  { id: "overview", label: "Overview", href: "" },
  { id: "stats", label: "Stats", href: "stats" },
  { id: "career", label: "Career", href: "career" },
  { id: "performance", label: "Performance", href: "performance" },
  { id: "intelligence", label: "Intelligence", href: "intelligence" },
  { id: "rating", label: "Rating", href: "rating" },
];

export function PlayerPublicSubNav({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  return (
    <nav className="pr-player-v2__nav" aria-label="Player sections">
      {SUB_NAV.map((item) => {
        const href = item.href.startsWith("/")
          ? item.href
          : item.href
            ? `/players/${slug}/${item.href}`
            : `/players/${slug}`;
        return (
          <Link key={item.id} href={href} className={item.id === active ? "is-active" : undefined}>
            {item.label}
          </Link>
        );
      })}
      <Link
        href={`/players/compare?player=${slug}`}
        className={active === "comparison" ? "is-active" : undefined}
      >
        Comparison
      </Link>
      <Link href={`/players/${slug}/news`} className={active === "news" ? "is-active" : undefined}>
        News
      </Link>
      <div className="pr-player-v2__actions">
        <Link className="pr-player-v2__btn pr-player-v2__btn--primary" href={`/players/compare?player=${slug}`}>
          Compare
        </Link>
        <button
          type="button"
          className="pr-player-v2__btn"
          disabled
          title="Follow — coming soon"
          aria-disabled="true"
        >
          Follow
        </button>
      </div>
    </nav>
  );
}
