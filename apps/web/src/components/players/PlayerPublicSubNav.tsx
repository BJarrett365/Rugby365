"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

function withEmbedParams(href: string, embed: boolean, compareWith: string | null): string {
  if (!embed && !compareWith) return href;
  const url = new URL(href, "https://rugby365.local");
  if (embed) url.searchParams.set("embed", "1");
  if (compareWith) url.searchParams.set("compareWith", compareWith);
  return `${url.pathname}${url.search}`;
}

function PlayerPublicSubNavInner({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const compareWith = searchParams.get("compareWith")?.trim() || null;

  const compareHref =
    compareWith && compareWith !== slug
      ? `/players/compare?player=${encodeURIComponent(slug)}&opponent=${encodeURIComponent(compareWith)}`
      : `/players/compare?player=${encodeURIComponent(slug)}`;
  const compareLinkProps = embed
    ? ({ target: "_parent" as const, rel: "noopener" } as const)
    : {};

  return (
    <nav className="pr-player-v2__nav" aria-label="Player sections">
      {SUB_NAV.map((item) => {
        const base = item.href.startsWith("/")
          ? item.href
          : item.href
            ? `/players/${slug}/${item.href}`
            : `/players/${slug}`;
        const href = withEmbedParams(base, embed, compareWith);
        return (
          <Link key={item.id} href={href} className={item.id === active ? "is-active" : undefined}>
            {item.label}
          </Link>
        );
      })}
      <Link
        href={compareHref}
        className={active === "comparison" ? "is-active" : undefined}
        {...compareLinkProps}
      >
        Comparison
      </Link>
      <Link
        href={withEmbedParams(`/players/${slug}/news`, embed, compareWith)}
        className={active === "news" ? "is-active" : undefined}
      >
        News
      </Link>
      <div className="pr-player-v2__actions">
        <Link
          className="pr-player-v2__btn pr-player-v2__btn--primary"
          href={compareHref}
          {...compareLinkProps}
        >
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

export function PlayerPublicSubNav({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  return (
    <Suspense
      fallback={
        <nav className="pr-player-v2__nav" aria-label="Player sections">
          {SUB_NAV.map((item) => (
            <span key={item.id}>{item.label}</span>
          ))}
        </nav>
      }
    >
      <PlayerPublicSubNavInner slug={slug} active={active} />
    </Suspense>
  );
}
