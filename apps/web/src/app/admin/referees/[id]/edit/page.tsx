"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RefereeFixturesPanel } from "@/components/admin/RefereeFixturesPanel";
import { PersonIntelligencePanel } from "@/components/admin/PersonIntelligencePanel";
import { PageHeader } from "@/components/shell/PageHeader";
import type { RefereeCardEvent, RefereeFixtureRow } from "@/lib/referee-admin-service";

type RefereeDetailResponse = {
  referee: {
    id: string;
    name: string;
    slug: string;
    countryName: string | null;
    nationality: string | null;
    birthDate: string | null;
    imageUrl: string | null;
    bioSummary: string | null;
    wikipediaUrl: string | null;
    wikidataId: string | null;
    sourceUrl: string | null;
    notes: string | null;
    socialAccounts?: Record<string, string | null>;
  };
  fixtures: RefereeFixtureRow[];
  yellowCards: RefereeCardEvent[];
  redCards: RefereeCardEvent[];
  stats: {
    matchCount: number;
    yellowCardCount: number;
    redCardCount: number;
    nameOnlyMatchCount: number;
  };
};

export default function EditRefereePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<RefereeDetailResponse | null>(null);
  const [values, setValues] = useState({
    name: "",
    slug: "",
    countryName: "",
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

  const applyDetail = useCallback((data: RefereeDetailResponse) => {
    setDetail(data);
    const social = (data.referee.socialAccounts ?? {}) as Record<string, string | null>;
    setValues({
      name: data.referee.name,
      slug: data.referee.slug,
      countryName: data.referee.countryName ?? "",
      nationality: data.referee.nationality ?? "",
      birthDate: data.referee.birthDate ?? "",
      imageUrl: data.referee.imageUrl ?? "",
      bioSummary: data.referee.bioSummary ?? "",
      wikipediaUrl: data.referee.wikipediaUrl ?? "",
      wikidataId: data.referee.wikidataId ?? "",
      sourceUrl: data.referee.sourceUrl ?? "",
      notes: data.referee.notes ?? "",
      socialTwitter: social.twitter ?? "",
      socialInstagram: social.instagram ?? "",
      socialLinkedin: social.linkedin ?? "",
      socialWebsite: social.website ?? "",
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/admin/referees/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to load referee (${res.status})`);
      }
      applyDetail(data as RefereeDetailResponse);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load referee");
    } finally {
      setLoading(false);
    }
  }, [applyDetail, id]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/referees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        slug: values.slug,
        countryName: values.countryName || null,
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
    else if (data.referee) {
      setDetail((current) =>
        current
          ? {
              ...current,
              referee: { ...current.referee, ...data.referee },
            }
          : current,
      );
    }
    setSaving(false);
  }

  async function linkNameOnlyFixtures() {
    setLinking(true);
    const res = await fetch(`/api/admin/referees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link-name-only-fixtures" }),
    });
    const data = await res.json();
    if (res.ok) {
      applyDetail(data as RefereeDetailResponse);
    } else {
      alert(data.error ?? "Link failed");
    }
    setLinking(false);
  }

  async function remove() {
    if (!confirm("Delete this referee?")) return;
    const res = await fetch(`/api/admin/referees/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/referees");
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">Loading referee…</p>;

  if (loadError || !detail) {
    return (
      <div className="cms-card border border-red-900/60 flex flex-wrap items-center justify-between gap-3">
        <p className="text-red-400 text-sm m-0">{loadError || "Referee not found"}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => load()} className="cms-btn cms-btn--secondary text-xs">
            Retry
          </button>
          <Link href="/admin/referees" className="cms-btn cms-btn--secondary text-xs">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title={detail.referee.name}
        description={`${detail.stats.matchCount} fixtures · ${detail.stats.yellowCardCount} yellow · ${detail.stats.redCardCount} red`}
        actions={
          values.slug ? (
            <Link
              href={`/referees/${values.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null
        }
      />

      <RefereeFixturesPanel
        fixtures={detail.fixtures}
        yellowCards={detail.yellowCards}
        redCards={detail.redCards}
        stats={detail.stats}
        onLinkNameOnly={detail.stats.nameOnlyMatchCount > 0 ? linkNameOnlyFixtures : undefined}
        linking={linking}
      />

      <div className="cms-card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold m-0">Wikipedia</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={async () => {
                const res = await fetch(`/api/admin/referees/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "enrich-wikipedia" }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error ?? "Wikipedia refresh failed");
                  return;
                }
                applyDetail(data as RefereeDetailResponse);
              }}
            >
              Refresh from Wikipedia
            </button>
            <Link href="/admin/referees/import" className="cms-btn cms-btn--secondary text-xs">
              Import more referees
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
        roleType="referee"
        roleEntityId={id}
        intelligenceUrl={`/api/admin/referees/${id}/intelligence`}
        onApplied={() => {
          load().catch(() => undefined);
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
            <span className="text-sm text-zinc-400">Country</span>
            <input
              className="cms-input w-full mt-1"
              value={values.countryName}
              onChange={(e) => setValues((v) => ({ ...v, countryName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Nationality</span>
            <input
              className="cms-input w-full mt-1"
              value={values.nationality}
              onChange={(e) => setValues((v) => ({ ...v, nationality: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-zinc-400">Date of birth</span>
            <input
              type="date"
              className="cms-input w-full mt-1"
              value={values.birthDate}
              onChange={(e) => setValues((v) => ({ ...v, birthDate: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Photo URL</span>
            <input
              className="cms-input w-full mt-1"
              value={values.imageUrl}
              onChange={(e) => setValues((v) => ({ ...v, imageUrl: e.target.value }))}
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
              href={`/referees/${values.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null}
          <Link href="/admin/referees" className="cms-btn cms-btn--secondary">
            Back
          </Link>
          <button type="button" onClick={remove} className="cms-btn cms-btn--secondary text-red-400">
            Delete
          </button>
        </div>
      </form>
    </>
  );
}
