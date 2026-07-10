"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

export default function NewCoachPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    name: "",
    slug: "",
    nationality: "",
    birthDate: "",
    bioSummary: "",
    wikipediaUrl: "",
    sourceUrl: "",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        birthDate: values.birthDate || null,
      }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/coaches/${data.coach.id}/edit`);
    else setError(data.error ?? "Failed to create coach");
    setSaving(false);
  }

  return (
    <>
      <PageHeader eyebrow="CMS" title="Add coach" />
      <form onSubmit={submit} className="cms-card space-y-4 max-w-2xl">
        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        <label className="block">
          <span className="text-sm text-zinc-400">Name</span>
          <input
            className="cms-input w-full mt-1"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Slug (optional)</span>
          <input
            className="cms-input w-full mt-1"
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-zinc-400">Nationality</span>
            <input
              className="cms-input w-full mt-1"
              value={values.nationality}
              onChange={(e) => setValues((v) => ({ ...v, nationality: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Date of birth</span>
            <input
              type="date"
              className="cms-input w-full mt-1"
              value={values.birthDate}
              onChange={(e) => setValues((v) => ({ ...v, birthDate: e.target.value }))}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-zinc-400">Bio summary</span>
          <textarea
            className="cms-input w-full mt-1"
            rows={4}
            value={values.bioSummary}
            onChange={(e) => setValues((v) => ({ ...v, bioSummary: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Wikipedia URL</span>
          <input
            className="cms-input w-full mt-1"
            value={values.wikipediaUrl}
            onChange={(e) => setValues((v) => ({ ...v, wikipediaUrl: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Source URL</span>
          <input
            className="cms-input w-full mt-1"
            value={values.sourceUrl}
            onChange={(e) => setValues((v) => ({ ...v, sourceUrl: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Notes</span>
          <textarea
            className="cms-input w-full mt-1"
            rows={2}
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="cms-btn cms-btn--primary">
            {saving ? "Creating…" : "Create coach"}
          </button>
          <Link href="/admin/coaches" className="cms-btn cms-btn--secondary">
            Back
          </Link>
        </div>
      </form>
    </>
  );
}
