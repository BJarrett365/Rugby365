"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PersonIntelligencePanel } from "@/components/admin/PersonIntelligencePanel";
import { CoachTeamAssignmentSection } from "@/components/admin/CoachTeamAssignmentSection";
import type { CoachingStaffRow } from "@/lib/coach-admin-service";

export default function EditCoachPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<CoachingStaffRow[]>([]);
  const [values, setValues] = useState({
    name: "",
    slug: "",
    nationality: "",
    birthDate: "",
    imageUrl: "",
    bioSummary: "",
    wikipediaUrl: "",
    wikidataId: "",
    sourceUrl: "",
    notes: "",
    socialTwitter: "",
    socialInstagram: "",
    socialLinkedin: "",
    socialWebsite: "",
  });

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [id]);

  async function reload() {
    const d = await fetch(`/api/admin/coaches/${id}`).then((r) => r.json());
    if (d.coach) {
      setValues({
        name: d.coach.name,
        slug: d.coach.slug,
        nationality: d.coach.nationality ?? "",
        birthDate: d.coach.birthDate ?? "",
        imageUrl: d.coach.imageUrl ?? "",
        bioSummary: d.coach.bioSummary ?? "",
        wikipediaUrl: d.coach.wikipediaUrl ?? "",
        wikidataId: d.coach.wikidataId ?? "",
        sourceUrl: d.coach.sourceUrl ?? "",
        notes: d.coach.notes ?? "",
        socialTwitter: d.socialAccounts?.twitter ?? "",
        socialInstagram: d.socialAccounts?.instagram ?? "",
        socialLinkedin: d.socialAccounts?.linkedin ?? "",
        socialWebsite: d.socialAccounts?.website ?? "",
      });
    }
    setAssignments(d.assignments ?? []);
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        slug: values.slug,
        nationality: values.nationality || null,
        birthDate: values.birthDate || null,
        imageUrl: values.imageUrl || null,
        bioSummary: values.bioSummary || null,
        wikipediaUrl: values.wikipediaUrl || null,
        wikidataId: values.wikidataId || null,
        sourceUrl: values.sourceUrl || null,
        notes: values.notes || null,
        socialAccounts: {
          twitter: values.socialTwitter || null,
          instagram: values.socialInstagram || null,
          linkedin: values.socialLinkedin || null,
          website: values.socialWebsite || null,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Failed to save");
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Delete this coach and all team assignments?")) return;
    const res = await fetch(`/api/admin/coaches/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/coaches");
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Edit coach"
        actions={
          values.slug ? (
            <Link
              href={`/coaches/${values.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null
        }
      />
      <div className="cms-card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold m-0">Wikipedia</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={async () => {
                const res = await fetch(`/api/admin/coaches/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "enrich-wikipedia" }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error ?? "Wikipedia refresh failed");
                  return;
                }
                window.location.reload();
              }}
            >
              Refresh from Wikipedia
            </button>
            <Link href="/admin/coaches/import" className="cms-btn cms-btn--secondary text-xs">
              Import more coaches
            </Link>
          </div>
        </div>
        {values.wikipediaUrl ? (
          <a href={values.wikipediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400 text-sm">
            Wikipedia source
          </a>
        ) : (
          <p className="text-sm text-zinc-500 m-0">
            No Wikipedia URL yet. Set one below or use Import from Wikipedia.
          </p>
        )}
      </div>
      <PersonIntelligencePanel
        roleType="coach"
        roleEntityId={id}
        intelligenceUrl={`/api/admin/coaches/${id}/intelligence`}
        onApplied={() => {
          fetch(`/api/admin/coaches/${id}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.coach) {
                setValues((v) => ({
                  ...v,
                  bioSummary: d.coach.bioSummary ?? "",
                }));
              }
            })
            .catch(() => undefined);
        }}
      />
      <form onSubmit={submit} className="cms-card space-y-4 max-w-2xl mb-4">
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
          <span className="text-sm text-zinc-400">Slug</span>
          <input
            className="cms-input w-full mt-1"
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            required
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
          <span className="text-sm text-zinc-400">Photo URL</span>
          <input
            className="cms-input w-full mt-1"
            value={values.imageUrl}
            onChange={(e) => setValues((v) => ({ ...v, imageUrl: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Bio summary</span>
          <textarea
            className="cms-input w-full mt-1"
            rows={4}
            value={values.bioSummary}
            onChange={(e) => setValues((v) => ({ ...v, bioSummary: e.target.value }))}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-zinc-400">Wikipedia URL</span>
            <input
              className="cms-input w-full mt-1"
              value={values.wikipediaUrl}
              onChange={(e) => setValues((v) => ({ ...v, wikipediaUrl: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Wikidata ID</span>
            <input
              className="cms-input w-full mt-1"
              value={values.wikidataId}
              onChange={(e) => setValues((v) => ({ ...v, wikidataId: e.target.value }))}
            />
          </label>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-zinc-400">Twitter / X</span>
            <input
              className="cms-input w-full mt-1"
              value={values.socialTwitter}
              onChange={(e) => setValues((v) => ({ ...v, socialTwitter: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Instagram</span>
            <input
              className="cms-input w-full mt-1"
              value={values.socialInstagram}
              onChange={(e) => setValues((v) => ({ ...v, socialInstagram: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">LinkedIn</span>
            <input
              className="cms-input w-full mt-1"
              value={values.socialLinkedin}
              onChange={(e) => setValues((v) => ({ ...v, socialLinkedin: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Website</span>
            <input
              className="cms-input w-full mt-1"
              value={values.socialWebsite}
              onChange={(e) => setValues((v) => ({ ...v, socialWebsite: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="cms-btn cms-btn--primary">
            {saving ? "Saving…" : "Save"}
          </button>
          {values.slug ? (
            <Link
              href={`/coaches/${values.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null}
          <Link href="/admin/coaches" className="cms-btn cms-btn--secondary">
            Back
          </Link>
          <button type="button" onClick={remove} className="cms-btn cms-btn--secondary text-red-400">
            Delete
          </button>
        </div>
      </form>

      <CoachTeamAssignmentSection
        coachId={id}
        assignments={assignments}
        onChanged={() => reload()}
      />
    </>
  );
}
