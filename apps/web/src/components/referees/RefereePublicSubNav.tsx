"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type SubNavItem = {
  id: string;
  label: string;
  href: string;
};

const SUB_NAV: SubNavItem[] = [
  { id: "overview", label: "Overview", href: "" },
  { id: "matches", label: "Matches", href: "matches" },
  { id: "stats", label: "Stats", href: "stats" },
  { id: "career", label: "Career", href: "career" },
  { id: "rankings", label: "Rankings", href: "rankings" },
  { id: "disciplinary", label: "Disciplinary", href: "disciplinary" },
];

function withEmbed(href: string, embed: boolean): string {
  if (!embed) return href;
  const url = new URL(href, "https://rugby365.local");
  url.searchParams.set("embed", "1");
  return `${url.pathname}${url.search}`;
}

function RefereePublicSubNavInner({ slug, active }: { slug: string; active: string }) {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const compareHref = `/competitions/rugby-world-cup/rankings?board=referees`;

  return (
    <nav className="pr-player-v2__nav" aria-label="Referee sections">
      {SUB_NAV.map((item) => {
        const base = item.href ? `/referees/${slug}/${item.href}` : `/referees/${slug}`;
        return (
          <Link key={item.id} href={withEmbed(base, embed)} className={item.id === active ? "is-active" : undefined}>
            {item.label}
          </Link>
        );
      })}
      <Link
        href={withEmbed(`/referees/${slug}/news`, embed)}
        className={active === "news" ? "is-active" : undefined}
      >
        News
      </Link>
      <div className="pr-player-v2__actions">
        <Link className="pr-player-v2__btn pr-player-v2__btn--primary" href={compareHref}>
          Compare
        </Link>
        <button type="button" className="pr-player-v2__btn" disabled title="Follow — coming soon" aria-disabled="true">
          Follow
        </button>
      </div>
    </nav>
  );
}

export function RefereePublicSubNav({ slug, active }: { slug: string; active: string }) {
  return (
    <Suspense
      fallback={
        <nav className="pr-player-v2__nav" aria-label="Referee sections">
          {SUB_NAV.map((item) => (
            <span key={item.id}>{item.label}</span>
          ))}
        </nav>
      }
    >
      <RefereePublicSubNavInner slug={slug} active={active} />
    </Suspense>
  );
}
