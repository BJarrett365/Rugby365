"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

export default function NewCompetitionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    name: "",
    slug: "",
    competitionType: "domestic",
    sdmsCompCode: "",
    planetRugbySlug: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        sdmsCompCode: values.sdmsCompCode || undefined,
        planetRugbySlug: values.planetRugbySlug || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/competitions/${data.competition.id}/edit`);
    else setError(data.error ?? "Failed to create competition");
    setLoading(false);
  }

  return (
    <>
      <PageHeader eyebrow="CMS" title="New competition" />
      <form onSubmit={submit} className="cms-card space-y-4 max-w-lg">
        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        <label className="block">
          <span className="text-sm text-zinc-400">Name</span>
          <input
            className="cms-input w-full mt-1"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Premiership"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Slug</span>
          <input
            className="cms-input w-full mt-1"
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            placeholder="premiership"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Type</span>
          <select
            className="cms-select w-full mt-1"
            value={values.competitionType}
            onChange={(e) => setValues((v) => ({ ...v, competitionType: e.target.value }))}
          >
            <option value="domestic">Domestic league</option>
            <option value="international">International (e.g. Six Nations)</option>
            <option value="world_cup">World Cup</option>
            <option value="european">European</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">SDMS comp code</span>
          <input
            className="cms-input w-full mt-1 font-mono text-sm"
            value={values.sdmsCompCode}
            onChange={(e) => setValues((v) => ({ ...v, sdmsCompCode: e.target.value }))}
            placeholder="m46vm6z5"
          />
          <span className="text-xs text-zinc-600 mt-1 block">
            From Planet Rugby tournament page <code>data-comp-code</code> attribute.
          </span>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Planet Rugby slug</span>
          <input
            className="cms-input w-full mt-1"
            value={values.planetRugbySlug}
            onChange={(e) => setValues((v) => ({ ...v, planetRugbySlug: e.target.value }))}
            placeholder="premiership"
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="cms-btn cms-btn--primary">
            {loading ? "Saving…" : "Create competition"}
          </button>
          <Link href="/admin/competitions" className="cms-btn cms-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
