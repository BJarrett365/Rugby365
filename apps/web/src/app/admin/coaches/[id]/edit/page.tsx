"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PersonIntelligencePanel } from "@/components/admin/PersonIntelligencePanel";
import { CoachTeamAssignmentSection } from "@/components/admin/CoachTeamAssignmentSection";
import { CoachImagesPanel } from "@/components/admin/CoachImagesPanel";
import type { CoachingStaffRow } from "@/lib/coach-admin-service";
import { rugbyPassCoachUrl } from "@rugby365/import-sdk";

type TabId = "overview" | "history" | "honours" | "stats";

type PlayingStint = {
  id: string;
  yearsLabel: string;
  teamName: string;
  teamType: string;
  apps: number | null;
  points: number | null;
  position: string | null;
};

type HonourRow = {
  id: string;
  year: number | null;
  competitionName: string | null;
  teamName: string | null;
  achievementType: string;
  honourLevel: string;
  roleType: string;
};

type AwardRow = {
  id: string;
  year: number | null;
  awardName: string;
  awardingBody: string | null;
  result: string;
};

type MedalRow = {
  id: string;
  year: number | null;
  competitionName: string | null;
  finish: string;
  medalType: string;
  teamName: string | null;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "honours", label: "Honours & Awards" },
  { id: "stats", label: "Stats/Ratings" },
];

const emptyValues = {
  name: "",
  slug: "",
  knownAs: "",
  fullName: "",
  nationality: "",
  secondNationality: "",
  birthDate: "",
  placeOfBirth: "",
  countryOfBirth: "",
  heightCm: "",
  formerPlayingPositions: "",
  playingCareerStatus: "",
  coachingCareerStartYear: "",
  appointedOn: "",
  contractExpiresOn: "",
  preferredSystem: "",
  coachingStyle: "",
  preferredSystemProvenance: "unverified",
  coachingStyleProvenance: "unverified",
  imageUrl: "",
  bioSummary: "",
  wikipediaUrl: "",
  wikidataId: "",
  sourceUrl: "",
  notes: "",
  isPublic: true,
  publishStatus: "published",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  careerRecordPartial: false,
  careerRecordNotes: "",
  lastVerifiedAt: "",
  socialTwitter: "",
  socialInstagram: "",
  socialLinkedin: "",
  socialWebsite: "",
};

export default function EditCoachPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<CoachingStaffRow[]>([]);
  const [values, setValues] = useState(emptyValues);
  const [playingStints, setPlayingStints] = useState<PlayingStint[]>([]);
  const [honours, setHonours] = useState<HonourRow[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [medals, setMedals] = useState<MedalRow[]>([]);
  const [stintForm, setStintForm] = useState({
    yearsLabel: "",
    teamName: "",
    teamType: "provincial",
    apps: "",
    points: "",
    position: "",
  });
  const [honourForm, setHonourForm] = useState({
    year: "",
    competitionName: "",
    teamName: "",
    achievementType: "winner",
    honourLevel: "secondary",
    roleType: "coach",
  });
  const [awardForm, setAwardForm] = useState({
    awardName: "",
    awardingBody: "",
    year: "",
    result: "winner",
  });
  const [medalForm, setMedalForm] = useState({
    year: "",
    competitionName: "",
    teamName: "",
    finish: "",
    medalType: "gold",
  });
  const [careerRecord, setCareerRecord] = useState<Record<string, unknown> | null>(null);
  const [ratings, setRatings] = useState<Record<string, unknown> | null>(null);
  const [impact, setImpact] = useState<Record<string, unknown> | null>(null);
  const [statsBusy, setStatsBusy] = useState("");
  const [rugbypassUrl, setRugbypassUrl] = useState("");
  const [rugbypassImporting, setRugbypassImporting] = useState(false);
  const [rugbypassImportError, setRugbypassImportError] = useState("");
  const [wikipediaImporting, setWikipediaImporting] = useState(false);
  const [wikipediaImportError, setWikipediaImportError] = useState("");
  const [wikiHonourPreview, setWikiHonourPreview] = useState<{
    proposed: Array<{
      year: number;
      competitionName: string;
      achievementType: string;
      honourLevel: string;
      roleType: string;
      sourceLine: string;
    }>;
    missing: Array<{
      year: number;
      competitionName: string;
      achievementType: string;
      honourLevel: string;
      roleType: string;
      sourceLine: string;
    }>;
  } | null>(null);
  const [wikiHonoursBusy, setWikiHonoursBusy] = useState(false);

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (tab === "history" || tab === "honours") {
      loadNested().catch(() => undefined);
    }
    if (tab === "stats") {
      loadStats().catch(() => undefined);
    }
  }, [tab, id]);

  async function reload() {
    const d = await fetch(`/api/admin/coaches/${id}`).then((r) => r.json());
    if (d.coach) {
      setValues({
        name: d.coach.name ?? "",
        slug: d.coach.slug ?? "",
        knownAs: d.coach.knownAs ?? "",
        fullName: d.coach.fullName ?? "",
        nationality: d.coach.nationality ?? "",
        secondNationality: d.coach.secondNationality ?? "",
        birthDate: d.coach.birthDate ?? "",
        placeOfBirth: d.coach.placeOfBirth ?? "",
        countryOfBirth: d.coach.countryOfBirth ?? "",
        heightCm: d.coach.heightCm != null ? String(d.coach.heightCm) : "",
        formerPlayingPositions: d.coach.formerPlayingPositions ?? "",
        playingCareerStatus: d.coach.playingCareerStatus ?? "",
        coachingCareerStartYear:
          d.coach.coachingCareerStartYear != null ? String(d.coach.coachingCareerStartYear) : "",
        appointedOn: d.coach.appointedOn ?? "",
        contractExpiresOn: d.coach.contractExpiresOn ?? "",
        preferredSystem: d.coach.preferredSystem ?? "",
        coachingStyle: d.coach.coachingStyle ?? "",
        preferredSystemProvenance: d.coach.preferredSystemProvenance ?? "unverified",
        coachingStyleProvenance: d.coach.coachingStyleProvenance ?? "unverified",
        imageUrl: d.coach.imageUrl ?? "",
        bioSummary: d.coach.bioSummary ?? "",
        wikipediaUrl: d.coach.wikipediaUrl ?? "",
        wikidataId: d.coach.wikidataId ?? "",
        sourceUrl: d.coach.sourceUrl ?? "",
        notes: d.coach.notes ?? "",
        isPublic: d.coach.isPublic !== false,
        publishStatus: d.coach.publishStatus ?? "published",
        seoTitle: d.coach.seoTitle ?? "",
        seoDescription: d.coach.seoDescription ?? "",
        ogImageUrl: d.coach.ogImageUrl ?? "",
        careerRecordPartial: Boolean(d.coach.careerRecordPartial),
        careerRecordNotes: d.coach.careerRecordNotes ?? "",
        lastVerifiedAt: d.coach.lastVerifiedAt
          ? String(d.coach.lastVerifiedAt).slice(0, 19).replace("T", " ")
          : "",
        socialTwitter: d.socialAccounts?.twitter ?? "",
        socialInstagram: d.socialAccounts?.instagram ?? "",
        socialLinkedin: d.socialAccounts?.linkedin ?? "",
        socialWebsite: d.socialAccounts?.website ?? "",
      });
      if (!rugbypassUrl) {
        setRugbypassUrl(rugbyPassCoachUrl(String(d.coach.slug ?? "")));
      }
    }
    setAssignments(d.assignments ?? []);
    setLoading(false);
  }

  async function loadNested() {
    const [stintsRes, honoursRes, awardsRes, medalsRes] = await Promise.all([
      fetch(`/api/admin/coaches/${id}/playing-stints`).then((r) => r.json()),
      fetch(`/api/admin/coaches/${id}/honours`).then((r) => r.json()),
      fetch(`/api/admin/coaches/${id}/awards`).then((r) => r.json()),
      fetch(`/api/admin/coaches/${id}/medals`).then((r) => r.json()),
    ]);
    setPlayingStints(stintsRes.playingStints ?? []);
    setHonours(honoursRes.honours ?? []);
    setAwards(awardsRes.awards ?? []);
    setMedals(medalsRes.medals ?? []);
  }

  async function loadStats() {
    const detail = await fetch(`/api/admin/coaches/${id}`).then((r) => r.json());
    if (detail.coach) {
      setValues((v) => ({
        ...v,
        careerRecordPartial: Boolean(detail.coach.careerRecordPartial),
        careerRecordNotes: detail.coach.careerRecordNotes ?? "",
        lastVerifiedAt: detail.coach.lastVerifiedAt
          ? String(detail.coach.lastVerifiedAt).slice(0, 19).replace("T", " ")
          : "",
      }));
    }
    const [careerRes, impactRes] = await Promise.all([
      fetch(`/api/admin/coaches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "career-record" }),
      }).then((r) => r.json()),
      fetch(`/api/admin/coaches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate-impact" }),
      }).then((r) => r.json()),
    ]);
    setCareerRecord(careerRes.careerRecord ?? null);
    setImpact(impactRes.impact ?? null);
    setRatings(null);
  }

  async function applyDetail(detail: { coach?: Record<string, unknown>; socialAccounts?: Record<string, string | null> }) {
    if (!detail.coach) return;
    const c = detail.coach;
    setValues((v) => ({
      ...v,
      name: String(c.name ?? v.name),
      slug: String(c.slug ?? v.slug),
      knownAs: String(c.knownAs ?? ""),
      fullName: String(c.fullName ?? ""),
      nationality: String(c.nationality ?? ""),
      secondNationality: String(c.secondNationality ?? ""),
      birthDate: c.birthDate ? String(c.birthDate) : "",
      placeOfBirth: String(c.placeOfBirth ?? ""),
      countryOfBirth: String(c.countryOfBirth ?? ""),
      heightCm: c.heightCm != null ? String(c.heightCm) : "",
      formerPlayingPositions: String(c.formerPlayingPositions ?? ""),
      playingCareerStatus: String(c.playingCareerStatus ?? ""),
      coachingCareerStartYear:
        c.coachingCareerStartYear != null ? String(c.coachingCareerStartYear) : "",
      appointedOn: c.appointedOn ? String(c.appointedOn) : "",
      contractExpiresOn: c.contractExpiresOn ? String(c.contractExpiresOn) : "",
      preferredSystem: String(c.preferredSystem ?? ""),
      coachingStyle: String(c.coachingStyle ?? ""),
      preferredSystemProvenance: String(c.preferredSystemProvenance ?? "unverified"),
      coachingStyleProvenance: String(c.coachingStyleProvenance ?? "unverified"),
      imageUrl: String(c.imageUrl ?? ""),
      bioSummary: String(c.bioSummary ?? ""),
      wikipediaUrl: String(c.wikipediaUrl ?? ""),
      wikidataId: String(c.wikidataId ?? ""),
      sourceUrl: String(c.sourceUrl ?? ""),
      notes: String(c.notes ?? ""),
    }));
  }

  async function importFromRugbyPass() {
    setRugbypassImporting(true);
    setRugbypassImportError("");
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enrich-rugbypass",
        sourceUrl: rugbypassUrl || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const reason = String(data.reason ?? data.error ?? "RugbyPass import failed");
      if (reason === "name_mismatch") {
        setRugbypassImportError(
          `RugbyPass page is for “${data.profile?.displayName ?? "unknown"}”, which does not match this coach.`,
        );
      } else {
        setRugbypassImportError(reason);
      }
      setRugbypassImporting(false);
      return;
    }
    if (data.detail) await applyDetail(data.detail);
    else await reload();
    setRugbypassImporting(false);
  }

  async function importFromWikipedia() {
    setWikipediaImporting(true);
    setWikipediaImportError("");
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enrich-wikipedia",
        sourceUrl: values.wikipediaUrl || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const reason = String(data.reason ?? data.error ?? "Wikipedia lookup failed");
      if (reason === "name_mismatch") {
        setWikipediaImportError(
          "Wikipedia page name does not match this CMS coach. Check the URL.",
        );
      } else if (reason === "missing_wikipedia_url") {
        setWikipediaImportError("Paste a Wikipedia article URL first.");
      } else {
        setWikipediaImportError(reason);
      }
      if (data.detail) await applyDetail(data.detail);
      setWikipediaImporting(false);
      return;
    }
    if (data.detail) await applyDetail(data.detail);
    else await reload();
    setWikipediaImporting(false);
  }

  async function previewWikipediaHonours() {
    setWikiHonoursBusy(true);
    try {
      const res = await fetch(`/api/admin/coaches/${id}/wikipedia-honours`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to preview honours");
      setWikiHonourPreview({
        proposed: data.proposed ?? data.review?.found ?? [],
        missing: data.review?.missing ?? data.proposed ?? [],
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to preview honours");
    } finally {
      setWikiHonoursBusy(false);
    }
  }

  async function acceptWikipediaHonour(item: {
    year: number;
    competitionName: string;
    achievementType: string;
    honourLevel: string;
    roleType: string;
    sourceLine: string;
  }) {
    const res = await fetch(`/api/admin/coaches/${id}/wikipedia-honours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: item.year,
        competitionName: item.competitionName,
        achievementType: item.achievementType,
        honourLevel: item.honourLevel,
        roleType: item.roleType || "coach",
        sourceLine: item.sourceLine,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Failed to accept honour");
      return;
    }
    await loadNested();
    await previewWikipediaHonours();
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
        knownAs: values.knownAs || null,
        fullName: values.fullName || null,
        nationality: values.nationality || null,
        secondNationality: values.secondNationality || null,
        birthDate: values.birthDate || null,
        placeOfBirth: values.placeOfBirth || null,
        countryOfBirth: values.countryOfBirth || null,
        heightCm: values.heightCm ? Number(values.heightCm) : null,
        formerPlayingPositions: values.formerPlayingPositions || null,
        playingCareerStatus: values.playingCareerStatus || null,
        coachingCareerStartYear: values.coachingCareerStartYear
          ? Number(values.coachingCareerStartYear)
          : null,
        appointedOn: values.appointedOn || null,
        contractExpiresOn: values.contractExpiresOn || null,
        preferredSystem: values.preferredSystem || null,
        coachingStyle: values.coachingStyle || null,
        preferredSystemProvenance: values.preferredSystemProvenance,
        coachingStyleProvenance: values.coachingStyleProvenance,
        imageUrl: values.imageUrl || null,
        bioSummary: values.bioSummary || null,
        wikipediaUrl: values.wikipediaUrl || null,
        wikidataId: values.wikidataId || null,
        sourceUrl: values.sourceUrl || null,
        notes: values.notes || null,
        isPublic: values.isPublic,
        publishStatus: values.publishStatus,
        seoTitle: values.seoTitle || null,
        seoDescription: values.seoDescription || null,
        ogImageUrl: values.ogImageUrl || null,
        careerRecordPartial: values.careerRecordPartial,
        careerRecordNotes: values.careerRecordNotes || null,
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

  async function addStint(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/coaches/${id}/playing-stints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yearsLabel: stintForm.yearsLabel,
        teamName: stintForm.teamName,
        teamType: stintForm.teamType,
        apps: stintForm.apps || null,
        points: stintForm.points || null,
        position: stintForm.position || null,
      }),
    });
    if (res.ok) {
      setStintForm({
        yearsLabel: "",
        teamName: "",
        teamType: "provincial",
        apps: "",
        points: "",
        position: "",
      });
      await loadNested();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add stint");
    }
  }

  async function deleteNested(path: string, rowId: string) {
    if (!confirm("Delete this row?")) return;
    const res = await fetch(`/api/admin/coaches/${id}/${path}?id=${rowId}`, { method: "DELETE" });
    if (res.ok) await loadNested();
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  async function addHonour(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/coaches/${id}/honours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: honourForm.year || null,
        competitionName: honourForm.competitionName || null,
        teamName: honourForm.teamName || null,
        achievementType: honourForm.achievementType,
        honourLevel: honourForm.honourLevel,
        roleType: honourForm.roleType,
      }),
    });
    if (res.ok) {
      setHonourForm({
        year: "",
        competitionName: "",
        teamName: "",
        achievementType: "winner",
        honourLevel: "secondary",
        roleType: "coach",
      });
      await loadNested();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add honour");
    }
  }

  async function addAward(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/coaches/${id}/awards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        awardName: awardForm.awardName,
        awardingBody: awardForm.awardingBody || null,
        year: awardForm.year || null,
        result: awardForm.result,
      }),
    });
    if (res.ok) {
      setAwardForm({ awardName: "", awardingBody: "", year: "", result: "winner" });
      await loadNested();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add award");
    }
  }

  async function addMedal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/coaches/${id}/medals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: medalForm.year || null,
        competitionName: medalForm.competitionName || null,
        teamName: medalForm.teamName || null,
        finish: medalForm.finish,
        medalType: medalForm.medalType,
      }),
    });
    if (res.ok) {
      setMedalForm({
        year: "",
        competitionName: "",
        teamName: "",
        finish: "",
        medalType: "gold",
      });
      await loadNested();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add medal");
    }
  }

  async function runStatsAction(action: "recalculate-ratings" | "recalculate-impact" | "verify") {
    setStatsBusy(action);
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setStatsBusy("");
    if (!res.ok) {
      alert(data.error ?? "Action failed");
      return;
    }
    if (action === "recalculate-ratings") setRatings(data.ratings ?? null);
    if (action === "recalculate-impact") setImpact(data.impact ?? null);
    if (action === "verify") {
      await reload();
    }
  }

  async function saveCareerMeta() {
    setStatsBusy("career-meta");
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        careerRecordPartial: values.careerRecordPartial,
        careerRecordNotes: values.careerRecordNotes || null,
      }),
    });
    setStatsBusy("");
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to save");
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

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`cms-btn ${tab === item.id ? "cms-btn--primary" : "cms-btn--secondary"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="cms-card mb-4 border border-emerald-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold m-0">RugbyPass import</h3>
            </div>
            <p className="text-sm text-zinc-500 mt-0 mb-3">
              Paste a RugbyPass coach URL to fill missing bio, nationality, role notes, and photo.
              Example:{" "}
              <span className="text-zinc-400 font-mono text-xs">
                https://www.rugbypass.com/coaches/rassie-erasmus/
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="cms-input flex-1"
                type="url"
                placeholder="https://www.rugbypass.com/coaches/coach-slug/"
                value={rugbypassUrl}
                onChange={(e) => setRugbypassUrl(e.target.value)}
              />
              <button
                type="button"
                className="cms-btn cms-btn--primary shrink-0"
                disabled={rugbypassImporting}
                onClick={() => void importFromRugbyPass()}
              >
                {rugbypassImporting ? "Importing…" : "Import from RugbyPass"}
              </button>
            </div>
            {rugbypassImportError ? (
              <p className="text-red-400 text-sm mt-2 m-0">{rugbypassImportError}</p>
            ) : null}
          </div>

          <div className="cms-card mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold m-0">Wikipedia archive</h3>
              <Link href="/admin/coaches/import" className="cms-btn cms-btn--secondary text-xs">
                Import more coaches
              </Link>
            </div>
            <p className="text-sm text-zinc-500 mt-0 mb-3">
              Paste the Wikipedia coach article URL to fill missing identity fields, photo, playing
              stints, and coaching assignments (fill-missing only).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="cms-input flex-1"
                type="url"
                placeholder="https://en.wikipedia.org/wiki/Rassie_Erasmus"
                value={values.wikipediaUrl}
                onChange={(e) => setValues((v) => ({ ...v, wikipediaUrl: e.target.value }))}
              />
              <button
                type="button"
                className="cms-btn cms-btn--primary shrink-0"
                disabled={wikipediaImporting}
                onClick={() => void importFromWikipedia()}
              >
                {wikipediaImporting ? "Refreshing…" : "Refresh from Wikipedia"}
              </button>
            </div>
            {values.wikipediaUrl ? (
              <a
                href={values.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 text-sm inline-block mt-2"
              >
                Open Wikipedia
              </a>
            ) : null}
            {wikipediaImportError ? (
              <p className="text-red-400 text-sm mt-2 m-0">{wikipediaImportError}</p>
            ) : null}
          </div>

          <CoachImagesPanel
            coachId={id}
            coachName={values.name || undefined}
            currentImageUrl={values.imageUrl || null}
            onPrimaryChanged={(imageUrl) =>
              setValues((v) => ({ ...v, imageUrl: imageUrl ?? "" }))
            }
          />

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
          <form onSubmit={submit} className="cms-card space-y-4 max-w-3xl mb-4">
            {error && <p className="text-red-400 text-sm m-0">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
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
              <label className="block">
                <span className="text-sm text-zinc-400">Known as</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.knownAs}
                  onChange={(e) => setValues((v) => ({ ...v, knownAs: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Full name</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.fullName}
                  onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
                />
              </label>
            </div>
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
                <span className="text-sm text-zinc-400">Second nationality</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.secondNationality}
                  onChange={(e) => setValues((v) => ({ ...v, secondNationality: e.target.value }))}
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
              <label className="block">
                <span className="text-sm text-zinc-400">Height (cm)</span>
                <input
                  type="number"
                  className="cms-input w-full mt-1"
                  value={values.heightCm}
                  onChange={(e) => setValues((v) => ({ ...v, heightCm: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Place of birth</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.placeOfBirth}
                  onChange={(e) => setValues((v) => ({ ...v, placeOfBirth: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Country of birth</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.countryOfBirth}
                  onChange={(e) => setValues((v) => ({ ...v, countryOfBirth: e.target.value }))}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-zinc-400">Former playing positions</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.formerPlayingPositions}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, formerPlayingPositions: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Playing career status</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.playingCareerStatus}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, playingCareerStatus: e.target.value }))
                  }
                  placeholder="e.g. retired"
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Coaching career start year</span>
                <input
                  type="number"
                  className="cms-input w-full mt-1"
                  value={values.coachingCareerStartYear}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, coachingCareerStartYear: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Appointed on</span>
                <input
                  type="date"
                  className="cms-input w-full mt-1"
                  value={values.appointedOn}
                  onChange={(e) => setValues((v) => ({ ...v, appointedOn: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Contract expires on</span>
                <input
                  type="date"
                  className="cms-input w-full mt-1"
                  value={values.contractExpiresOn}
                  onChange={(e) => setValues((v) => ({ ...v, contractExpiresOn: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">Preferred system</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.preferredSystem}
                  onChange={(e) => setValues((v) => ({ ...v, preferredSystem: e.target.value }))}
                />
                <select
                  className="cms-input w-full mt-1 text-xs"
                  value={values.preferredSystemProvenance}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, preferredSystemProvenance: e.target.value }))
                  }
                >
                  <option value="rugby365_assessment">Rugby365 assessment</option>
                  <option value="verified_fact">Verified fact</option>
                  <option value="unverified">Unverified</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-zinc-400">Coaching style</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.coachingStyle}
                  onChange={(e) => setValues((v) => ({ ...v, coachingStyle: e.target.value }))}
                />
                <select
                  className="cms-input w-full mt-1 text-xs"
                  value={values.coachingStyleProvenance}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, coachingStyleProvenance: e.target.value }))
                  }
                >
                  <option value="rugby365_assessment">Rugby365 assessment</option>
                  <option value="verified_fact">Verified fact</option>
                  <option value="unverified">Unverified</option>
                </select>
                <p className="text-xs text-zinc-500 mt-1 m-0">
                  Assessments are Rugby365 classifications — never present them as sourced facts.
                </p>
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
                <span className="text-sm text-zinc-400">Publish status</span>
                <select
                  className="cms-input w-full mt-1"
                  value={values.publishStatus}
                  onChange={(e) => setValues((v) => ({ ...v, publishStatus: e.target.value }))}
                >
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                  <option value="hidden">hidden</option>
                </select>
              </label>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={values.isPublic}
                  onChange={(e) => setValues((v) => ({ ...v, isPublic: e.target.checked }))}
                />
                <span className="text-sm text-zinc-400">Public</span>
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">SEO title</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.seoTitle}
                  onChange={(e) => setValues((v) => ({ ...v, seoTitle: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-400">OG image URL</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.ogImageUrl}
                  onChange={(e) => setValues((v) => ({ ...v, ogImageUrl: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-zinc-400">SEO description</span>
                <textarea
                  className="cms-input w-full mt-1"
                  rows={2}
                  value={values.seoDescription}
                  onChange={(e) => setValues((v) => ({ ...v, seoDescription: e.target.value }))}
                />
              </label>
            </div>
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
            {values.lastVerifiedAt ? (
              <p className="text-sm text-zinc-500 m-0">Last verified: {values.lastVerifiedAt}</p>
            ) : null}
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
              <button
                type="button"
                onClick={remove}
                className="cms-btn cms-btn--secondary text-red-400"
              >
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
      )}

      {tab === "history" && (
        <div className="space-y-4 max-w-3xl">
          <div className="cms-card">
            <h3 className="font-semibold m-0 mb-3">Playing stints</h3>
            {playingStints.length === 0 ? (
              <p className="text-sm text-zinc-500">No playing stints yet.</p>
            ) : (
              <ul className="space-y-2 mb-4 list-none p-0 m-0">
                {playingStints.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-800 pb-2"
                  >
                    <span>
                      {s.yearsLabel} · {s.teamName} ({s.teamType})
                      {s.position ? ` · ${s.position}` : ""}
                      {s.apps != null ? ` · ${s.apps} apps` : ""}
                    </span>
                    <button
                      type="button"
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                      onClick={() => deleteNested("playing-stints", s.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addStint} className="grid gap-3 sm:grid-cols-3">
              <input
                className="cms-input"
                placeholder="Years label"
                value={stintForm.yearsLabel}
                onChange={(e) => setStintForm((f) => ({ ...f, yearsLabel: e.target.value }))}
                required
              />
              <input
                className="cms-input"
                placeholder="Team name"
                value={stintForm.teamName}
                onChange={(e) => setStintForm((f) => ({ ...f, teamName: e.target.value }))}
                required
              />
              <select
                className="cms-input"
                value={stintForm.teamType}
                onChange={(e) => setStintForm((f) => ({ ...f, teamType: e.target.value }))}
              >
                <option value="provincial">provincial</option>
                <option value="franchise">franchise</option>
                <option value="club">club</option>
                <option value="international">international</option>
              </select>
              <input
                className="cms-input"
                placeholder="Apps"
                value={stintForm.apps}
                onChange={(e) => setStintForm((f) => ({ ...f, apps: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Points"
                value={stintForm.points}
                onChange={(e) => setStintForm((f) => ({ ...f, points: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Position"
                value={stintForm.position}
                onChange={(e) => setStintForm((f) => ({ ...f, position: e.target.value }))}
              />
              <button type="submit" className="cms-btn cms-btn--primary sm:col-span-3">
                Add playing stint
              </button>
            </form>
          </div>

          <div className="cms-card">
            <h3 className="font-semibold m-0 mb-3">Coaching assignments</h3>
            <CoachTeamAssignmentSection
              coachId={id}
              assignments={assignments}
              onChanged={() => reload()}
            />
          </div>
        </div>
      )}

      {tab === "honours" && (
        <div className="space-y-4 max-w-3xl">
          <div className="cms-card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold m-0">Wikipedia honours preview</h3>
              <button
                type="button"
                className="cms-btn cms-btn--secondary text-xs"
                disabled={wikiHonoursBusy || !values.wikipediaUrl}
                onClick={() => void previewWikipediaHonours()}
              >
                {wikiHonoursBusy ? "Loading…" : "Preview from Wikipedia"}
              </button>
            </div>
            <p className="text-sm text-zinc-500 mt-0 mb-3">
              Review proposed honours from the Wikipedia article. Accept adds them as unverified CMS
              rows — nothing is auto-published.
            </p>
            {!values.wikipediaUrl ? (
              <p className="text-sm text-amber-400 m-0">Set a Wikipedia URL on Overview first.</p>
            ) : null}
            {wikiHonourPreview ? (
              <ul className="space-y-2 list-none p-0 m-0">
                {wikiHonourPreview.missing.length === 0 ? (
                  <li className="text-sm text-zinc-500">No new honours to accept.</li>
                ) : (
                  wikiHonourPreview.missing.map((item) => (
                    <li
                      key={`${item.year}-${item.competitionName}-${item.achievementType}-${item.sourceLine}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-800 pb-2"
                    >
                      <span>
                        {item.year} · {item.competitionName} · {item.achievementType}/
                        {item.honourLevel}
                      </span>
                      <button
                        type="button"
                        className="cms-btn cms-btn--primary text-xs"
                        onClick={() => void acceptWikipediaHonour(item)}
                      >
                        Accept
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          <div className="cms-card">
            <h3 className="font-semibold m-0 mb-3">Honours</h3>
            {honours.length === 0 ? (
              <p className="text-sm text-zinc-500">No honours yet.</p>
            ) : (
              <ul className="space-y-2 mb-4 list-none p-0 m-0">
                {honours.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-800 pb-2"
                  >
                    <span>
                      {h.year ?? "—"} · {h.competitionName ?? "Honour"} · {h.teamName ?? "—"} (
                      {h.achievementType}/{h.honourLevel}, {h.roleType})
                    </span>
                    <button
                      type="button"
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                      onClick={() => deleteNested("honours", h.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addHonour} className="grid gap-3 sm:grid-cols-3">
              <input
                className="cms-input"
                placeholder="Year"
                value={honourForm.year}
                onChange={(e) => setHonourForm((f) => ({ ...f, year: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Competition"
                value={honourForm.competitionName}
                onChange={(e) => setHonourForm((f) => ({ ...f, competitionName: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Team"
                value={honourForm.teamName}
                onChange={(e) => setHonourForm((f) => ({ ...f, teamName: e.target.value }))}
              />
              <select
                className="cms-input"
                value={honourForm.achievementType}
                onChange={(e) => setHonourForm((f) => ({ ...f, achievementType: e.target.value }))}
              >
                <option value="winner">winner</option>
                <option value="runner_up">runner_up</option>
                <option value="champion">champion</option>
                <option value="finalist">finalist</option>
              </select>
              <select
                className="cms-input"
                value={honourForm.honourLevel}
                onChange={(e) => setHonourForm((f) => ({ ...f, honourLevel: e.target.value }))}
              >
                <option value="major">major</option>
                <option value="domestic_major">domestic_major</option>
                <option value="secondary">secondary</option>
                <option value="series">series</option>
              </select>
              <select
                className="cms-input"
                value={honourForm.roleType}
                onChange={(e) => setHonourForm((f) => ({ ...f, roleType: e.target.value }))}
              >
                <option value="coach">coach</option>
                <option value="player">player</option>
              </select>
              <button type="submit" className="cms-btn cms-btn--primary sm:col-span-3">
                Add honour
              </button>
            </form>
          </div>

          <div className="cms-card">
            <h3 className="font-semibold m-0 mb-3">Awards</h3>
            {awards.length === 0 ? (
              <p className="text-sm text-zinc-500">No awards yet.</p>
            ) : (
              <ul className="space-y-2 mb-4 list-none p-0 m-0">
                {awards.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-800 pb-2"
                  >
                    <span>
                      {a.year ?? "—"} · {a.awardName}
                      {a.awardingBody ? ` (${a.awardingBody})` : ""} · {a.result}
                    </span>
                    <button
                      type="button"
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                      onClick={() => deleteNested("awards", a.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addAward} className="grid gap-3 sm:grid-cols-2">
              <input
                className="cms-input"
                placeholder="Award name"
                value={awardForm.awardName}
                onChange={(e) => setAwardForm((f) => ({ ...f, awardName: e.target.value }))}
                required
              />
              <input
                className="cms-input"
                placeholder="Awarding body"
                value={awardForm.awardingBody}
                onChange={(e) => setAwardForm((f) => ({ ...f, awardingBody: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Year"
                value={awardForm.year}
                onChange={(e) => setAwardForm((f) => ({ ...f, year: e.target.value }))}
              />
              <select
                className="cms-input"
                value={awardForm.result}
                onChange={(e) => setAwardForm((f) => ({ ...f, result: e.target.value }))}
              >
                <option value="winner">winner</option>
                <option value="nominee">nominee</option>
                <option value="shortlisted">shortlisted</option>
                <option value="runner_up">runner_up</option>
              </select>
              <button type="submit" className="cms-btn cms-btn--primary sm:col-span-2">
                Add award
              </button>
            </form>
          </div>

          <div className="cms-card">
            <h3 className="font-semibold m-0 mb-3">Medals</h3>
            {medals.length === 0 ? (
              <p className="text-sm text-zinc-500">No medals yet.</p>
            ) : (
              <ul className="space-y-2 mb-4 list-none p-0 m-0">
                {medals.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-800 pb-2"
                  >
                    <span>
                      {m.year ?? "—"} · {m.competitionName ?? "Medal"} · {m.finish} ({m.medalType})
                      {m.teamName ? ` · ${m.teamName}` : ""}
                    </span>
                    <button
                      type="button"
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                      onClick={() => deleteNested("medals", m.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addMedal} className="grid gap-3 sm:grid-cols-3">
              <input
                className="cms-input"
                placeholder="Year"
                value={medalForm.year}
                onChange={(e) => setMedalForm((f) => ({ ...f, year: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Competition"
                value={medalForm.competitionName}
                onChange={(e) => setMedalForm((f) => ({ ...f, competitionName: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Team"
                value={medalForm.teamName}
                onChange={(e) => setMedalForm((f) => ({ ...f, teamName: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Finish"
                value={medalForm.finish}
                onChange={(e) => setMedalForm((f) => ({ ...f, finish: e.target.value }))}
                required
              />
              <select
                className="cms-input"
                value={medalForm.medalType}
                onChange={(e) => setMedalForm((f) => ({ ...f, medalType: e.target.value }))}
              >
                <option value="gold">gold</option>
                <option value="silver">silver</option>
                <option value="bronze">bronze</option>
                <option value="none">none</option>
              </select>
              <button type="submit" className="cms-btn cms-btn--primary">
                Add medal
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-4 max-w-3xl">
          <div className="cms-card space-y-3">
            <h3 className="font-semibold m-0">Career record metadata</h3>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.careerRecordPartial}
                onChange={(e) =>
                  setValues((v) => ({ ...v, careerRecordPartial: e.target.checked }))
                }
              />
              <span className="text-sm text-zinc-400">Career record is partial</span>
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Career record notes</span>
              <textarea
                className="cms-input w-full mt-1"
                rows={2}
                value={values.careerRecordNotes}
                onChange={(e) => setValues((v) => ({ ...v, careerRecordNotes: e.target.value }))}
              />
            </label>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={statsBusy === "career-meta"}
              onClick={() => saveCareerMeta()}
            >
              {statsBusy === "career-meta" ? "Saving…" : "Save career metadata"}
            </button>
            {values.lastVerifiedAt ? (
              <p className="text-sm text-zinc-500 m-0">Last verified: {values.lastVerifiedAt}</p>
            ) : (
              <p className="text-sm text-zinc-500 m-0">Not verified yet.</p>
            )}
            <button
              type="button"
              className="cms-btn cms-btn--secondary"
              disabled={statsBusy === "verify"}
              onClick={() => runStatsAction("verify")}
            >
              {statsBusy === "verify" ? "Verifying…" : "Mark verified"}
            </button>
          </div>

          <div className="cms-card space-y-3">
            <h3 className="font-semibold m-0">Ratings & impact</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={statsBusy === "recalculate-ratings"}
                onClick={() => runStatsAction("recalculate-ratings")}
              >
                {statsBusy === "recalculate-ratings" ? "Recalculating…" : "Recalculate ratings"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={statsBusy === "recalculate-impact"}
                onClick={() => runStatsAction("recalculate-impact")}
              >
                {statsBusy === "recalculate-impact" ? "Loading…" : "Recalculate impact"}
              </button>
            </div>
            {careerRecord ? (
              <div>
                <h4 className="text-sm font-semibold m-0 mb-2">Career record</h4>
                <pre className="text-xs overflow-auto bg-zinc-950 p-3 rounded max-h-64 m-0">
                  {JSON.stringify(careerRecord, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 m-0">Career record not loaded yet.</p>
            )}
            {ratings ? (
              <div>
                <h4 className="text-sm font-semibold m-0 mb-2">Ratings snapshot</h4>
                <pre className="text-xs overflow-auto bg-zinc-950 p-3 rounded max-h-64 m-0">
                  {JSON.stringify(ratings, null, 2)}
                </pre>
              </div>
            ) : null}
            {impact ? (
              <div>
                <h4 className="text-sm font-semibold m-0 mb-2">Impact</h4>
                <pre className="text-xs overflow-auto bg-zinc-950 p-3 rounded max-h-64 m-0">
                  {JSON.stringify(impact, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
