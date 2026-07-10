"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type EntityType = "auto" | "player" | "team" | "competition";

type CareerRow = {
  careerType: string;
  yearsLabel: string;
  teamName: string;
  apps?: number | null;
  points?: number | null;
};

type Preview = {
  entityType: EntityType;
  name: string;
  fullName?: string;
  birthDate?: string;
  birthPlace?: string;
  heightCm?: number;
  weightKg?: number;
  school?: string;
  relatives?: string;
  positions?: string[];
  currentTeam?: string;
  countryName?: string;
  foundedYear?: number;
  bioSummary?: string;
  wikipediaUrl: string;
  clubCareer?: CareerRow[];
  internationalCareer?: CareerRow[];
  source: string;
  credentialsConfigured?: boolean;
  usingEnterpriseApi?: boolean;
  infoboxTemplate?: string;
};

const PRESETS = [
  {
    label: "Blair Kinghorn (player)",
    url: "https://en.wikipedia.org/wiki/Blair_Kinghorn",
    entityType: "player" as const,
  },
  {
    label: "Edinburgh Rugby (team)",
    url: "https://en.wikipedia.org/wiki/Edinburgh_Rugby",
    entityType: "team" as const,
  },
  {
    label: "Six Nations (competition)",
    url: "https://en.wikipedia.org/wiki/Six_Nations_Championship",
    entityType: "competition" as const,
  },
];

export default function WikipediaImportPage() {
  const router = useRouter();
  const [url, setUrl] = useState(PRESETS[0].url);
  const [entityType, setEntityType] = useState<EntityType>("auto");
  const [linkEntityId, setLinkEntityId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function fetchPreview() {
    setFetching(true);
    setError("");
    setPreview(null);
    const qs = new URLSearchParams({
      url: url.trim(),
      entityType,
    });
    const res = await fetch(`/api/admin/data-sources/wikipedia/parse?${qs}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Preview failed");
    } else {
      setPreview(data);
      if (data.entityType && data.entityType !== "auto") {
        setEntityType(data.entityType);
      }
    }
    setFetching(false);
  }

  async function runImport() {
    setImporting(true);
    setError("");
    const res = await fetch("/api/admin/wikipedia/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        entityType,
        linkEntityId: linkEntityId.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      setImporting(false);
      return;
    }

    const label =
      data.entityType === "player"
        ? "player"
        : data.entityType === "team"
          ? "team"
          : "competition";
    const career =
      data.careerStints != null ? ` · ${data.careerStints} career rows` : "";
    alert(
      `${data.created ? "Created" : "Updated"} ${label} “${data.slug}” from Wikipedia${career}`,
    );

    if (data.entityType === "player") router.push(`/admin/players/${data.entityId}/edit`);
    else if (data.entityType === "team") router.push(`/admin/teams/${data.entityId}/edit`);
    else router.push(`/admin/competitions/${data.entityId}/edit`);

    setImporting(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Archive data"
        title="Import from Wikipedia"
        description="Enrich players, teams and leagues with biography, career tables and metadata. Live fixtures and tables remain on Planet Rugby."
        actions={
          <Link href="/admin/integrations/wikimedia" className="cms-btn cms-btn--secondary touch-target">
            Wikimedia credentials
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-3xl">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => {
                setUrl(preset.url);
                setEntityType(preset.entityType);
                setPreview(null);
                setError("");
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="block text-sm">
          <span className="text-zinc-400">Wikipedia URL or article title</span>
          <input
            className="cms-input mt-1 w-full font-mono text-xs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/Blair_Kinghorn"
          />
        </label>

        <fieldset className="text-sm border-0 p-0 m-0">
          <legend className="text-zinc-400 mb-2">Entity type</legend>
          <div className="flex flex-wrap gap-4">
            {(["auto", "player", "team", "competition"] as const).map((value) => (
              <label key={value} className="inline-flex items-center gap-2 capitalize">
                <input
                  type="radio"
                  name="entityType"
                  checked={entityType === value}
                  onChange={() => setEntityType(value)}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="text-zinc-400">Link to existing record (optional UUID)</span>
          <input
            className="cms-input mt-1 w-full font-mono text-xs"
            value={linkEntityId}
            onChange={(e) => setLinkEntityId(e.target.value)}
            placeholder="Merge archive data into an existing player/team/league"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={fetching || !url.trim()}
            onClick={fetchPreview}
          >
            {fetching ? "Fetching…" : "Preview"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={importing || !url.trim()}
            onClick={runImport}
          >
            {importing ? "Importing…" : "Import archive data"}
          </button>
        </div>

        {preview ? (
          <div className="border border-zinc-800 rounded-lg p-4 text-sm space-y-3">
            <p className="m-0 text-zinc-300">
              <strong>{preview.name}</strong> · {preview.entityType}
              {preview.infoboxTemplate ? ` · ${preview.infoboxTemplate}` : ""}
            </p>
            <p className="m-0 text-xs text-zinc-500">
              Source: {preview.usingEnterpriseApi ? "Wikimedia Enterprise" : "Public Wikipedia API"}
              {preview.credentialsConfigured === false ? " (add credentials for Enterprise)" : ""}
            </p>
            {preview.entityType === "player" ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 m-0">
                {preview.fullName ? (
                  <>
                    <dt className="text-zinc-500">Full name</dt>
                    <dd className="m-0">{preview.fullName}</dd>
                  </>
                ) : null}
                {preview.birthDate ? (
                  <>
                    <dt className="text-zinc-500">Born</dt>
                    <dd className="m-0">
                      {preview.birthDate}
                      {preview.birthPlace ? ` · ${preview.birthPlace}` : ""}
                    </dd>
                  </>
                ) : null}
                {preview.heightCm ? (
                  <>
                    <dt className="text-zinc-500">Height</dt>
                    <dd className="m-0">{preview.heightCm} cm</dd>
                  </>
                ) : null}
                {preview.weightKg ? (
                  <>
                    <dt className="text-zinc-500">Weight</dt>
                    <dd className="m-0">{preview.weightKg} kg</dd>
                  </>
                ) : null}
                {preview.school ? (
                  <>
                    <dt className="text-zinc-500">School</dt>
                    <dd className="m-0">{preview.school}</dd>
                  </>
                ) : null}
                {preview.relatives ? (
                  <>
                    <dt className="text-zinc-500">Relatives</dt>
                    <dd className="m-0">{preview.relatives}</dd>
                  </>
                ) : null}
                {preview.positions?.length ? (
                  <>
                    <dt className="text-zinc-500">Positions</dt>
                    <dd className="m-0">{preview.positions.join(", ")}</dd>
                  </>
                ) : null}
                {preview.currentTeam ? (
                  <>
                    <dt className="text-zinc-500">Current team</dt>
                    <dd className="m-0">{preview.currentTeam}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            {(preview.clubCareer?.length ?? 0) > 0 ? (
              <div>
                <h3 className="text-zinc-300 text-sm mt-0 mb-2">Senior career</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 text-left">
                      <th className="pr-2">Years</th>
                      <th className="pr-2">Team</th>
                      <th className="pr-2">Apps</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.clubCareer?.map((row) => (
                      <tr key={`${row.yearsLabel}-${row.teamName}`}>
                        <td className="pr-2 font-mono">{row.yearsLabel}</td>
                        <td className="pr-2">{row.teamName}</td>
                        <td className="pr-2 font-mono">{row.apps ?? "—"}</td>
                        <td className="font-mono">{row.points ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {(preview.internationalCareer?.length ?? 0) > 0 ? (
              <div>
                <h3 className="text-zinc-300 text-sm mt-0 mb-2">International career</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 text-left">
                      <th className="pr-2">Years</th>
                      <th className="pr-2">Team</th>
                      <th className="pr-2">Caps</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.internationalCareer?.map((row) => (
                      <tr key={`${row.yearsLabel}-${row.teamName}`}>
                        <td className="pr-2 font-mono">{row.yearsLabel}</td>
                        <td className="pr-2">{row.teamName}</td>
                        <td className="pr-2 font-mono">{row.apps ?? "—"}</td>
                        <td className="font-mono">{row.points ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {preview.bioSummary ? (
              <p className="text-zinc-400 m-0 text-xs leading-relaxed">{preview.bioSummary}</p>
            ) : null}
            <a href={preview.wikipediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400 text-xs">
              View on Wikipedia
            </a>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>
    </>
  );
}
