import Link from "next/link";

type SubNavItem = {
  id: string;
  label: string;
  /** Relative path under /coaches/[slug]/; empty = overview. Absolute paths start with /. */
  href: string;
};

const SUB_NAV: SubNavItem[] = [
  { id: "overview", label: "Overview", href: "" },
  { id: "career", label: "Career", href: "career" },
  { id: "stats", label: "Stats", href: "stats" },
  { id: "honours", label: "Honours", href: "honours" },
  { id: "history", label: "History", href: "history" },
  { id: "matches", label: "Matches", href: "matches" },
  { id: "rankings", label: "Rankings", href: "rankings" },
];

export function CoachPublicSubNav({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  return (
    <nav className="pr-coach-profile__nav" aria-label="Coach sections">
      {SUB_NAV.map((item) => {
        const href = item.href.startsWith("/")
          ? item.href
          : item.href
            ? `/coaches/${slug}/${item.href}`
            : `/coaches/${slug}`;
        return (
          <Link key={item.id} href={href} className={item.id === active ? "is-active" : undefined}>
            {item.label}
          </Link>
        );
      })}
      <div className="pr-coach-profile__actions">
        <Link className="pr-coach-profile__btn" href={`/coaches/compare?a=${slug}`}>
          Compare Coach
        </Link>
      </div>
    </nav>
  );
}
