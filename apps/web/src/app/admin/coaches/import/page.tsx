"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES,
  INTERNATIONAL_COACH_WIKIPEDIA_HUB,
} from "@/lib/coach-wikipedia-category-catalog";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type CategoryPreview = {
  categoryTitle: string;
  country: string | null;
  members: Array<{ title: string; pageId: number }>;
  subcategories: Array<{ title: string; pageId: number }>;
};

type ImportSummary = {
  categoryTitle?: string;
  country?: string | null;
  imported: Array<{
    coachId: string;
    slug: string;
    created: boolean;
    wikipediaUrl: string;
    assignmentsCreated: number;
    assignmentsUpdated: number;
  }>;
  failed: Array<{ title: string; error: string }>;
};

type BulkImportSummary = {
  categoriesProcessed: number;
  imported: number;
  failed: number;
  results: ImportSummary[];
};

function isCategoryUrl(value: string) {
  return value.includes("/wiki/Category:");
}

function findTeamIdForCountry(groups: TeamPickerGroup[], country: string) {
  const normalized = country.toLowerCase();
  const catalog = IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES.find(
    (entry) => entry.country.toLowerCase() === normalized,
  );
  const slugHints = new Set((catalog?.teamSlugs ?? []).map((slug) => slug.toLowerCase()));
  const nameHints = new Set((catalog?.teamNames ?? [country]).map((name) => name.toLowerCase()));

  return (
    groups
      .flatMap((group) => group.teams)
      .find(
        (team) =>
          slugHints.has(team.slug.toLowerCase()) || nameHints.has(team.name.toLowerCase()),
      )?.id ?? ""
  );
}

export default function ImportCoachesPage() {
  const router = useRouter();
  const [url, setUrl] = useState(INTERNATIONAL_COACH_WIKIPEDIA_HUB);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [linkTeamId, setLinkTeamId] = useState("");
  const [preview, setPreview] = useState<CategoryPreview | null>(null);
  const [singlePreview, setSinglePreview] = useState<Record<string, unknown> | null>(null);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [bulkSummary, setBulkSummary] = useState<BulkImportSummary | null>(null);
  const [assignMessage, setAssignMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/teams?grouped=1")
      .then((r) => r.json())
      .then((data) => {
        const groups = (data.groups ?? []) as TeamPickerGroup[];
        setTeamGroups(groups);
      })
      .catch(() => undefined);
  }, []);

  function applyCategoryPreset(categoryUrl: string, country: string) {
    setUrl(categoryUrl);
    setLinkTeamId(findTeamIdForCountry(teamGroups, country));
    setPreview(null);
    setSinglePreview(null);
    setSummary(null);
    setBulkSummary(null);
    setError("");
  }

  async function loadPreview() {
    setFetching(true);
    setError("");
    setPreview(null);
    setSinglePreview(null);
    setSummary(null);
    setBulkSummary(null);

    try {
      if (isCategoryUrl(url)) {
        const qs = new URLSearchParams({ url: url.trim() });
        const res = await fetch(`/api/admin/coaches/wikipedia/category?${qs}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Category preview failed");
          return;
        }
        setPreview(data as CategoryPreview);
        if (data.country) {
          setLinkTeamId(findTeamIdForCountry(teamGroups, String(data.country)));
        }
      } else {
        const res = await fetch(
          `/api/admin/data-sources/wikipedia/parse?${new URLSearchParams({
            url: url.trim(),
            entityType: "coach",
          })}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Coach preview failed");
          return;
        }
        setSinglePreview(data);
      }
    } finally {
      setFetching(false);
    }
  }

  async function runImport() {
    setImporting(true);
    setError("");
    setSummary(null);
    setBulkSummary(null);

    try {
      if (isCategoryUrl(url)) {
        const res = await fetch("/api/admin/coaches/wikipedia/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            linkTeamId: linkTeamId || undefined,
            countryName: preview?.country ?? undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Category import failed");
          return;
        }
        setSummary(data as ImportSummary);
      } else {
        const res = await fetch("/api/admin/coaches/wikipedia/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            linkTeamId: linkTeamId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Coach import failed");
          return;
        }
        router.push(`/admin/coaches/${data.coachId}/edit`);
      }
    } finally {
      setImporting(false);
    }
  }

  async function runBulkImport() {
    if (
      !confirm(
        `Import all ${IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES.length} international coach categories from Wikipedia? This will take a long time and respects Wikipedia rate limits.`,
      )
    ) {
      return;
    }
    setImporting(true);
    setError("");
    setSummary(null);
    setBulkSummary(null);

    try {
      const res = await fetch("/api/admin/coaches/wikipedia/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importAll: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bulk import failed");
        return;
      }
      setBulkSummary(data as BulkImportSummary);
    } finally {
      setImporting(false);
    }
  }

  async function runAssignToCmsTeams() {
    if (!confirm("Assign all coaches to existing CMS teams?")) return;
    setImporting(true);
    setError("");
    setSummary(null);
    setBulkSummary(null);
    setAssignMessage("");
    try {
      const res = await fetch("/api/admin/coaches/assign-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Assign to CMS teams failed");
        return;
      }
      setAssignMessage(
        `Assigned ${data.coachesProcessed} coaches · +${data.assignmentsCreated} created · ${data.assignmentsRelinked} relinked`,
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Import coaches from Wikipedia"
        actions={
          <Link href="/admin/coaches" className="cms-btn cms-btn--secondary">
            Back to coaches
          </Link>
        }
      />

      <div className="cms-card mb-4 space-y-4">
        <p className="text-sm text-zinc-500 m-0">
          Import a single coach article or bulk-import every coach listed in a Wikipedia category.
          Coaches are stored with nationality from the biography infobox and linked to a
          country/national team from the category. Coaching career rows are parsed from rugby
          biography infobox <code>coachyears</code> / <code>coachteams</code> fields.
        </p>

        <div>
          <p className="text-xs text-zinc-500 mb-2 m-0">International coach categories</p>
          <div className="flex flex-wrap gap-2">
            {IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES.map((preset) => (
              <button
                key={preset.url}
                type="button"
                className="cms-btn cms-btn--secondary text-xs"
                onClick={() => applyCategoryPreset(preset.url, preset.country)}
              >
                {preset.country}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-zinc-400">Wikipedia article or category URL</span>
          <input
            className="cms-input w-full mt-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/Category:..."
          />
        </label>

        <label className="block max-w-md">
          <span className="text-sm text-zinc-400">Link national team (auto-detected from category)</span>
          <div className="mt-1">
            <GroupedTeamSelect
              groups={teamGroups}
              value={linkTeamId}
              onChange={setLinkTeamId}
              placeholder="Select team for country + current-role detection…"
            />
          </div>
          <span className="text-xs text-zinc-600 mt-1 block">
            Used to store coached country and mark current head coach assignments when Wikipedia tenure
            is open-ended.
          </span>
        </label>

        {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={fetching || !url.trim()}
            onClick={() => loadPreview()}
          >
            {fetching ? "Loading…" : "Preview"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={importing || !url.trim()}
            onClick={() => runImport()}
          >
            {importing
              ? isCategoryUrl(url)
                ? "Importing category…"
                : "Importing…"
              : isCategoryUrl(url)
                ? "Import all coaches"
                : "Import coach"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={importing}
            onClick={() => runBulkImport()}
          >
            {importing ? "Importing all countries…" : "Import all international categories"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={importing}
            onClick={() => runAssignToCmsTeams()}
          >
            {importing ? "Assigning…" : "Assign all coaches to CMS teams"}
          </button>
        </div>
      </div>

      {assignMessage ? <p className="text-sm text-zinc-400 mb-4">{assignMessage}</p> : null}

      {preview ? (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0 mb-2">{preview.categoryTitle}</h3>
          <p className="text-sm text-zinc-500 m-0 mb-2">
            {preview.members.length} coaches in category
            {preview.country ? ` · Country: ${preview.country}` : ""}
          </p>
          {preview.subcategories.length > 0 ? (
            <p className="text-xs text-zinc-600 m-0 mb-4">
              {preview.subcategories.length} subcategories (hub category — use country presets above for
              coach articles)
            </p>
          ) : null}
          <ul className="text-sm text-zinc-300 space-y-1 m-0 list-none p-0 max-h-80 overflow-y-auto">
            {preview.members.map((member) => (
              <li key={member.pageId}>{member.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {singlePreview ? (
        <div className="cms-card mb-4 text-sm space-y-2">
          <h3 className="font-semibold m-0">{(singlePreview.name as string) ?? "Coach preview"}</h3>
          {singlePreview.birthDate ? (
            <p className="m-0 text-zinc-400">Born: {String(singlePreview.birthDate)}</p>
          ) : null}
          {singlePreview.nationality ? (
            <p className="m-0 text-zinc-400">Nationality: {String(singlePreview.nationality)}</p>
          ) : null}
          {Array.isArray(singlePreview.coachingCareer) ? (
            <p className="m-0 text-zinc-400">
              Coaching stints: {singlePreview.coachingCareer.length}
            </p>
          ) : null}
          {singlePreview.bioSummary ? (
            <p className="m-0 text-zinc-500">{String(singlePreview.bioSummary)}</p>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0 mb-2">Import complete</h3>
          <p className="text-sm text-zinc-500 m-0 mb-4">
            {summary.imported.length} imported · {summary.failed.length} failed
            {summary.country ? ` · Country: ${summary.country}` : ""}
          </p>
          {summary.imported.length > 0 ? (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">Coach</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Assignments</th>
                </tr>
              </thead>
              <tbody>
                {summary.imported.map((row) => (
                  <tr key={row.coachId} className="border-b border-zinc-800/60">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/coaches/${row.coachId}/edit`} className="text-emerald-400">
                        {row.slug}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-zinc-500">{row.created ? "Created" : "Updated"}</td>
                    <td className="py-2 pr-3 text-zinc-500">
                      +{row.assignmentsCreated} / ~{row.assignmentsUpdated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {summary.failed.length > 0 ? (
            <div>
              <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">Failed</h4>
              <ul className="text-sm text-red-300 space-y-1 m-0 list-none p-0">
                {summary.failed.map((row) => (
                  <li key={row.title}>
                    {row.title}: {row.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {bulkSummary ? (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0 mb-2">Bulk import complete</h3>
          <p className="text-sm text-zinc-500 m-0 mb-4">
            {bulkSummary.categoriesProcessed} categories · {bulkSummary.imported} imported ·{" "}
            {bulkSummary.failed} failed
          </p>
          <div className="space-y-3">
            {bulkSummary.results.map((result) => (
              <div key={result.categoryTitle} className="text-sm text-zinc-400">
                <span className="text-zinc-300">{result.country ?? result.categoryTitle}</span> —{" "}
                {result.imported.length} imported, {result.failed.length} failed
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
