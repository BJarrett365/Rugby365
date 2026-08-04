"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";

type CatalogComp = {
  key: string;
  name: string;
  group: string;
  country: string | null;
  region: string;
  gender: string;
  ageGroup: string;
  format: string;
  level: string;
  seasonStructure: string;
  lifecycle: string;
  competitionType: string;
  populated: boolean;
  competitionId: string | null;
  dbName: string | null;
  seasons: number;
  fixtures: number;
  standings: number;
};

type Group = { group: string; competitions: CatalogComp[] };

export function CompetitionCatalogClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [summary, setSummary] = useState({
    catalogSize: 0,
    populatedInDb: 0,
    populatedTagged: 0,
    roadmapUnpopulated: 0,
  });
  const [filter, setFilter] = useState<"all" | "populated" | "roadmap" | "former">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch("/api/admin/competitions/catalog");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load catalog");
    setGroups(json.groups ?? []);
    setSummary({
      catalogSize: json.catalogSize ?? 0,
      populatedInDb: json.populatedInDb ?? 0,
      populatedTagged: json.populatedTagged ?? 0,
      roadmapUnpopulated: json.roadmapUnpopulated ?? 0,
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  function syncTaxonomy() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch("/api/admin/competitions/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-taxonomy" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Sync failed");
        return;
      }
      setMessage(
        `Tagged ${json.matched?.length ?? 0} populated competition(s). Unmatched: ${
          json.unmatched?.map((u: { name: string }) => u.name).join(", ") || "none"
        }.`,
      );
      await load();
    });
  }

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        competitions: g.competitions.filter((c) => {
          if (filter === "populated" && !c.populated) return false;
          if (filter === "roadmap" && c.populated) return false;
          if (filter === "former" && c.lifecycle !== "former") return false;
          if (!q) return true;
          return (
            c.name.toLowerCase().includes(q) ||
            (c.country?.toLowerCase().includes(q) ?? false) ||
            c.group.toLowerCase().includes(q) ||
            c.region.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.competitions.length > 0);
  }, [groups, filter, query]);

  return (
    <div className="space-y-4">
      <section className="cms-card">
        <p className="text-sm text-[var(--pr-grey)] mt-0">
          Full Rugby365 competition roadmap. <strong>Only populated leagues/cups</strong> (with
          seasons, fixtures or standings) are linked in the database — empty shells are not created.
        </p>
        <div className="grid gap-2 sm:grid-cols-4 mt-3">
          <div className="rounded border border-zinc-800 p-3">
            <strong className="block text-lg">{summary.catalogSize}</strong>
            Catalog entries
          </div>
          <div className="rounded border border-zinc-800 p-3">
            <strong className="block text-lg">{summary.populatedInDb}</strong>
            Populated in DB
          </div>
          <div className="rounded border border-zinc-800 p-3">
            <strong className="block text-lg">{summary.populatedTagged}</strong>
            Tagged from catalog
          </div>
          <div className="rounded border border-zinc-800 p-3">
            <strong className="block text-lg">{summary.roadmapUnpopulated}</strong>
            Roadmap (not populated)
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={pending}
            onClick={syncTaxonomy}
          >
            {pending ? "Syncing…" : "Tag populated competitions"}
          </button>
          <Link href="/admin/competitions" className="cms-btn cms-btn--secondary">
            ← Competitions list
          </Link>
        </div>
        {error ? <p className="text-sm text-red-400 mt-3 mb-0">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--pr-gold)] mt-3 mb-0">{message}</p> : null}
      </section>

      <section className="cms-card">
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            className="cms-input flex-1 min-w-[180px]"
            placeholder="Search competition, country, region…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(
            [
              ["all", "All"],
              ["populated", "Populated only"],
              ["roadmap", "Roadmap only"],
              ["former", "Former"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`cms-btn ${filter === id ? "cms-btn--primary" : "cms-btn--secondary"}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {visibleGroups.map((g) => (
          <div key={g.group} className="mb-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mt-0 mb-2">
              {g.group}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-1.5 pr-2">Competition</th>
                    <th className="py-1.5 pr-2">Country</th>
                    <th className="py-1.5 pr-2">Gender</th>
                    <th className="py-1.5 pr-2">Format</th>
                    <th className="py-1.5 pr-2">Level</th>
                    <th className="py-1.5 pr-2">Status</th>
                    <th className="py-1.5 pr-2">DB</th>
                  </tr>
                </thead>
                <tbody>
                  {g.competitions.map((c) => (
                    <tr key={c.key} className="border-b border-zinc-800/50">
                      <td className="py-1.5 pr-2">
                        {c.competitionId ? (
                          <Link
                            href={`/admin/competitions/${c.competitionId}/edit`}
                            className="text-emerald-400 font-medium"
                          >
                            {c.name}
                          </Link>
                        ) : (
                          <span className="text-zinc-300">{c.name}</span>
                        )}
                        <span className="block text-[11px] text-zinc-600">
                          {c.region} · {c.ageGroup} · {c.seasonStructure}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-zinc-400">{c.country ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-zinc-400">{c.gender}</td>
                      <td className="py-1.5 pr-2 text-zinc-400">{c.format}</td>
                      <td className="py-1.5 pr-2 text-zinc-400">{c.level}</td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={
                            c.lifecycle === "former" ? "text-amber-400" : "text-emerald-400/90"
                          }
                        >
                          {c.lifecycle}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">
                        {c.populated ? (
                          <span className="text-emerald-400 text-xs">
                            Populated · {c.fixtures} fixtures · {c.seasons} seasons
                            {c.dbName && c.dbName !== c.name ? (
                              <span className="block text-zinc-600">DB: {c.dbName}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">Not populated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
