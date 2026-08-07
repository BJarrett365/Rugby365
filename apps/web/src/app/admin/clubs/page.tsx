"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type ClubRow = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  teamType: string | null;
  sourceProvider: string;
};

function letterBucket(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

/** Extra search tokens so "Springboks" finds South Africa, etc. */
function searchHaystack(club: ClubRow): string {
  const parts = [club.name, club.slug, club.shortName ?? ""];
  const lower = club.name.toLowerCase();
  if (lower === "south africa" || club.slug === "south-africa") {
    parts.push("springboks", "springbok", "boks", "rsa");
  }
  if (lower.includes("emerging springbok")) {
    parts.push("emerging boks", "sa a", "south africa a");
  }
  return parts.join(" ").toLowerCase();
}

export default function ClubsAdminPage() {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [letter, setLetter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/admin/teams")
      .then((res) => res.json())
      .then((data) => {
        setClubs((data.teams ?? []) as ClubRow[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return clubs
      .filter((club) => {
        if (letter !== "ALL" && letterBucket(club.name) !== letter) return false;
        if (!q) return true;
        return searchHaystack(club).includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [clubs, deferredQuery, letter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ClubRow[]>();
    for (const club of filtered) {
      const key = letterBucket(club.name);
      const bucket = map.get(key) ?? [];
      bucket.push(club);
      map.set(key, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const alphabet = ["ALL", ..."#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Clubs"
        description="Every club and national side in alphabetical order. Search or jump by letter, then open a club for squad, history and stats."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/teams" className="cms-btn cms-btn--secondary touch-target">
              Season teams
            </Link>
            <Link href="/admin/teams/new" className="cms-btn cms-btn--primary touch-target">
              New club
            </Link>
          </div>
        }
      />

      <div className="cms-card mb-4 space-y-3">
        <label className="block">
          <span className="sr-only">Search clubs</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clubs (e.g. Stormers, Bulls, Springboks)…"
            className="cms-input w-full"
            autoFocus
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {alphabet.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLetter(item)}
              className={`min-w-8 rounded px-2 py-1 text-xs font-semibold ${
                letter === item
                  ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40"
                  : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item === "ALL" ? "All" : item}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 m-0">
          {loading
            ? "Loading clubs…"
            : `${filtered.length.toLocaleString()} of ${clubs.length.toLocaleString()} clubs`}
          {" · "}
          <Link href="/admin/teams" className="text-zinc-300 underline">
            Competition-season team picker
          </Link>
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No clubs match that search.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([bucket, rows]) => (
            <section key={bucket} id={`letter-${bucket}`}>
              <h2 className="text-lg font-semibold text-zinc-200 mb-3 sticky top-0 bg-[var(--cms-bg,#0b1220)]/95 py-1 backdrop-blur">
                {bucket}
              </h2>
              <div className="space-y-2">
                {rows.map((club) => (
                  <article key={club.id} className="cms-card">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-lg m-0">{club.name}</h3>
                        <p className="text-sm text-zinc-500 m-0 mt-1">
                          {club.shortName ?? "—"}
                          {club.teamType ? ` · ${club.teamType}` : ""}
                          {` · ${club.sourceProvider}`}
                        </p>
                        <p className="text-xs text-zinc-600 m-0 mt-1">Slug: {club.slug}</p>
                        {club.slug === "south-africa" ? (
                          <p className="text-xs text-amber-200/80 m-0 mt-1">
                            Senior Springboks national team
                          </p>
                        ) : null}
                        {club.slug === "emerging-springboks" ? (
                          <p className="text-xs text-zinc-500 m-0 mt-1">
                            Development / Emerging side (not the senior Springboks)
                          </p>
                        ) : null}
                      </div>
                      <Link
                        href={`/admin/teams/${club.id}/edit`}
                        className="cms-btn cms-btn--secondary text-xs shrink-0"
                      >
                        Open club
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
