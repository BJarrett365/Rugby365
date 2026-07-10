"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

const ENGLISH_REFEREES_CATEGORY =
  "https://en.wikipedia.org/wiki/Category:English_rugby_union_referees";

const PRESETS = [
  {
    label: "English rugby union referees",
    url: ENGLISH_REFEREES_CATEGORY,
    countryName: "England",
  },
  {
    label: "Wayne Barnes (single referee)",
    url: "https://en.wikipedia.org/wiki/Wayne_Barnes",
    countryName: "England",
  },
  {
    label: "Matthew Carley (single referee)",
    url: "https://en.wikipedia.org/wiki/Matthew_Carley",
    countryName: "England",
  },
];

type CategoryPreview = {
  categoryTitle: string;
  members: Array<{ title: string; pageId: number }>;
};

type ImportSummary = {
  categoryTitle?: string;
  imported: Array<{
    refereeId: string;
    slug: string;
    created: boolean;
    wikipediaUrl: string;
    competitionCount: number;
  }>;
  failed: Array<{ title: string; error: string }>;
};

function isCategoryUrl(value: string) {
  return value.includes("/wiki/Category:");
}

export default function ImportRefereesPage() {
  const router = useRouter();
  const [url, setUrl] = useState(ENGLISH_REFEREES_CATEGORY);
  const [defaultCountryName, setDefaultCountryName] = useState("England");
  const [preview, setPreview] = useState<CategoryPreview | null>(null);
  const [singlePreview, setSinglePreview] = useState<Record<string, unknown> | null>(null);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function loadPreview() {
    setFetching(true);
    setError("");
    setPreview(null);
    setSinglePreview(null);
    setSummary(null);

    try {
      if (isCategoryUrl(url)) {
        const qs = new URLSearchParams({ url: url.trim() });
        const res = await fetch(`/api/admin/referees/wikipedia/category?${qs}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Category preview failed");
          return;
        }
        setPreview(data as CategoryPreview);
      } else {
        const res = await fetch(
          `/api/admin/data-sources/wikipedia/parse?${new URLSearchParams({
            url: url.trim(),
            entityType: "referee",
          })}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Referee preview failed");
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

    try {
      if (isCategoryUrl(url)) {
        const res = await fetch("/api/admin/referees/wikipedia/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            defaultCountryName: defaultCountryName.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Category import failed");
          return;
        }
        setSummary(data as ImportSummary);
      } else {
        const res = await fetch("/api/admin/referees/wikipedia/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            defaultCountryName: defaultCountryName.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Referee import failed");
          return;
        }
        router.push(`/admin/referees/${data.refereeId}/edit`);
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Import referees from Wikipedia"
        actions={
          <Link href="/admin/referees" className="cms-btn cms-btn--secondary">
            Back to referees
          </Link>
        }
      />

      <div className="cms-card mb-4 space-y-4">
        <p className="text-sm text-zinc-500 m-0">
          Import a single referee article or bulk-import every referee listed in a Wikipedia category.
          Competitions officiated are parsed from rugby biography infobox{" "}
          <code>refereecomps</code> fields.
        </p>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => {
                setUrl(preset.url);
                setDefaultCountryName(preset.countryName);
              }}
            >
              {preset.label}
            </button>
          ))}
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

        <label className="block max-w-xs">
          <span className="text-sm text-zinc-400">Default country / nationality</span>
          <input
            className="cms-input w-full mt-1"
            value={defaultCountryName}
            onChange={(e) => setDefaultCountryName(e.target.value)}
            placeholder="England"
          />
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
                ? "Import all referees"
                : "Import referee"}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0 mb-2">{preview.categoryTitle}</h3>
          <p className="text-sm text-zinc-500 m-0 mb-4">{preview.members.length} referees in category</p>
          <ul className="text-sm text-zinc-300 space-y-1 m-0 list-none p-0 max-h-80 overflow-y-auto">
            {preview.members.map((member) => (
              <li key={member.pageId}>{member.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {singlePreview ? (
        <div className="cms-card mb-4 text-sm space-y-2">
          <h3 className="font-semibold m-0">{(singlePreview.name as string) ?? "Referee preview"}</h3>
          {singlePreview.birthDate ? (
            <p className="m-0 text-zinc-400">Born: {String(singlePreview.birthDate)}</p>
          ) : null}
          {singlePreview.nationality ? (
            <p className="m-0 text-zinc-400">Nationality: {String(singlePreview.nationality)}</p>
          ) : null}
          {Array.isArray(singlePreview.refereeCareer) ? (
            <p className="m-0 text-zinc-400">
              Competitions: {singlePreview.refereeCareer.length}
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
          </p>
          {summary.imported.length > 0 ? (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">Referee</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Competitions</th>
                </tr>
              </thead>
              <tbody>
                {summary.imported.map((row) => (
                  <tr key={row.refereeId} className="border-b border-zinc-800/60">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/referees/${row.refereeId}/edit`} className="text-emerald-400">
                        {row.slug}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-zinc-500">{row.created ? "Created" : "Updated"}</td>
                    <td className="py-2 pr-3 text-zinc-500">{row.competitionCount}</td>
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
    </>
  );
}
