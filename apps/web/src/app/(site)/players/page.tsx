import type { Metadata } from "next";
import Link from "next/link";
import { listPublicPlayersDirectory } from "@/lib/public-players-directory-service";
import { TeamCrest } from "@/components/matches/TeamCrest";

type PageProps = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export const metadata: Metadata = {
  title: "Rugby Players — Stats, Clubs and Profiles | Rugby365",
  description:
    "Browse published Rugby365 player profiles: club and international stats, match history, ratings and career records.",
  alternates: { canonical: "/players" },
};

export default async function PublicPlayersDirectoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = sp.q?.trim() ?? "";
  const dir = await listPublicPlayersDirectory({ page, q, pageSize: 48 });
  const totalPages = Math.max(1, Math.ceil(dir.total / dir.pageSize));

  return (
    <article className="pr-mc-fixtures-page pr-players-directory">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Home</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">Players</span>
      </nav>

      <header className="pr-players-directory__header">
        <p className="pr-mc-pr-badge">Player directory</p>
        <h1>Players</h1>
        <p className="pr-players-directory__lede">
          {dir.total.toLocaleString("en-GB")} published profiles with club, international and
          scouting views.{" "}
          <Link href="/legends">Browse Planet Rugby Legends</Link>
        </p>
      </header>

      <form className="pr-player-filters" method="get" role="search">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, club or nation"
            className="pr-players-directory__search"
          />
        </label>
        <button type="submit" className="pr-player-filters__submit">
          Search
        </button>
      </form>

      {dir.rows.length === 0 ? (
        <p className="pr-mc-transfers-muted">No players match this search.</p>
      ) : (
        <ul className="pr-players-directory__grid">
          {dir.rows.map((p) => (
            <li key={p.slug}>
              <Link href={`/players/${p.slug}`} className="pr-players-directory__card">
                <TeamCrest name={p.name} imageUrl={p.imageUrl} size="md" />
                <span className="pr-players-directory__name">{p.name}</span>
                <span className="pr-players-directory__meta">
                  {[p.positionName, p.clubName, p.nationName].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="pr-players-directory__apps">
                  {p.appearanceCount > 0
                    ? `${p.appearanceCount} recorded appearance${p.appearanceCount === 1 ? "" : "s"}`
                    : "Profile"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="pr-player-pagination" aria-label="Players pages">
          {page > 1 ? (
            <Link
              href={`/players?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              Previous
            </Link>
          ) : null}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/players?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </article>
  );
}
