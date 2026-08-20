"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CoachCmsFieldLabel } from "@/components/admin/CoachCmsFieldLabel";
import { CoachCmsDataCoveragePanel } from "@/components/admin/CoachCmsDataCoveragePanel";
import { CoachCmsIntelligencePanel } from "@/components/admin/CoachCmsIntelligencePanel";
import { CoachCmsPowerIndexPanel } from "@/components/admin/CoachCmsPowerIndexPanel";
import { CoachCmsRatingPanel } from "@/components/admin/CoachCmsRatingPanel";
import { CoachCmsOpenAiProfileCheckPanel } from "@/components/admin/CoachCmsOpenAiProfileCheckPanel";
import {
  CoachCmsSourceReviewPanel,
  type CoachSourceReviewRow,
} from "@/components/admin/CoachCmsSourceReviewPanel";
import { CoachCmsWorkflowHeader } from "@/components/admin/CoachCmsWorkflowHeader";
import { PersonIntelligencePanel } from "@/components/admin/PersonIntelligencePanel";
import { CoachTeamAssignmentSection } from "@/components/admin/CoachTeamAssignmentSection";
import { CoachImagesPanel } from "@/components/admin/CoachImagesPanel";
import { CoachCmsAchievementsPanel } from "@/components/admin/CoachCmsAchievementsPanel";
import type { CoachingStaffRow } from "@/lib/coach-admin-service";
import { computeCoachCmsCompleteness } from "@/lib/coach-cms-completeness";
import type { CoachDataCoverage } from "@/lib/coach-recalc-service";
import type {
  CoachProfileCheckReport,
  CoachProfileCheckScope,
  CoachProfileFinding,
} from "@/lib/coach-openai-profile-check-service";
import { rugbyPassCoachUrl } from "@rugby365/import-sdk";

type TabId =
  | "overview"
  | "playing"
  | "coaching"
  | "history"
  | "matches"
  | "stats"
  | "honours"
  | "tactics"
  | "selection"
  | "players"
  | "ratings"
  | "rankings"
  | "images"
  | "sources"
  | "ai"
  | "audit";

type HonourSubTab = "coach" | "player" | "awards" | "medals";

type PlayingStint = {
  id: string;
  yearsLabel: string;
  teamName: string;
  teamDisplayName?: string | null;
  teamType: string;
  careerType?: string | null;
  competitionLevel?: string | null;
  teamId?: string | null;
  apps: number | null;
  starts?: number | null;
  points: number | null;
  position: string | null;
  showOnOverview?: boolean;
  recordStatus?: string | null;
  sourceUrl?: string | null;
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
  { id: "playing", label: "Playing Career" },
  { id: "coaching", label: "Coaching Career" },
  { id: "history", label: "History" },
  { id: "matches", label: "Matches" },
  { id: "stats", label: "Stats" },
  { id: "honours", label: "Honours & Awards" },
  { id: "tactics", label: "Tactics" },
  { id: "selection", label: "Selection" },
  { id: "players", label: "Players" },
  { id: "ratings", label: "Ratings" },
  { id: "rankings", label: "Rankings" },
  { id: "images", label: "Images" },
  { id: "sources", label: "Sources" },
  { id: "ai", label: "AI & Data" },
  { id: "audit", label: "Audit History" },
];

const HONOUR_SUBTABS: Array<{ id: HonourSubTab; label: string }> = [
  { id: "coach", label: "Coach Honours" },
  { id: "player", label: "Player Honours" },
  { id: "awards", label: "Awards" },
  { id: "medals", label: "Medals" },
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
  const [honourSubTab, setHonourSubTab] = useState<HonourSubTab>("coach");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<CoachingStaffRow[]>([]);
  const [values, setValues] = useState(emptyValues);
  const [playingStints, setPlayingStints] = useState<PlayingStint[]>([]);
  const [honours, setHonours] = useState<HonourRow[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [medals, setMedals] = useState<MedalRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastDataCheck, setLastDataCheck] = useState<string | null>(null);
  const [lastRatingAt, setLastRatingAt] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [reviewSummary, setReviewSummary] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<CoachSourceReviewRow[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [ratingDiff, setRatingDiff] = useState<{
    before: number | null;
    after: number | null;
    change: number | null;
  } | null>(null);
  const [dataCoverage, setDataCoverage] = useState<CoachDataCoverage | null>(null);
  const [coverageBusy, setCoverageBusy] = useState("");
  const [openaiReport, setOpenaiReport] = useState<CoachProfileCheckReport | null>(null);
  const [openaiLastChecked, setOpenaiLastChecked] = useState<string | null>(null);
  const [openaiBusy, setOpenaiBusy] = useState(false);
  const [stintForm, setStintForm] = useState({
    yearsLabel: "",
    teamName: "",
    teamDisplayName: "",
    teamType: "provincial",
    careerType: "provincial_player",
    competitionLevel: "provincial",
    teamId: "",
    apps: "",
    points: "",
    position: "",
    sourceUrl: "",
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
  const [careerChecking, setCareerChecking] = useState(false);
  const [careerCheckSummary, setCareerCheckSummary] = useState<string>("");
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

  const currentAssignment = useMemo(
    () => assignments.find((a) => a.isCurrent) ?? null,
    [assignments],
  );

  const completeness = useMemo(
    () =>
      computeCoachCmsCompleteness({
        publishStatus: values.publishStatus,
        isPublic: values.isPublic,
        name: values.name,
        knownAs: values.knownAs,
        birthDate: values.birthDate,
        placeOfBirth: values.placeOfBirth,
        nationality: values.nationality,
        heightCm: values.heightCm,
        imageUrl: values.imageUrl,
        bioSummary: values.bioSummary,
        wikipediaUrl: values.wikipediaUrl,
        appointedOn: values.appointedOn,
        contractExpiresOn: values.contractExpiresOn,
        preferredSystem: values.preferredSystem,
        coachingStyle: values.coachingStyle,
        lastVerifiedAt: values.lastVerifiedAt,
        playingStintCount: playingStints.length,
        assignmentCount: assignments.length,
        currentAssignment: Boolean(currentAssignment),
        overviewCareerCount:
          playingStints.filter((s) => s.showOnOverview).length +
          assignments.filter((a) => a.showOnOverview || a.isCurrent).length,
        needsReviewCareerCount:
          playingStints.filter((s) => s.recordStatus === "needs_review").length +
          assignments.filter((a) => a.recordStatus === "needs_review").length,
        missingCrestCount: assignments.filter((a) => a.missingCrest).length,
        honourCount: honours.length,
        awardCount: awards.length,
        hasCareerRecord: Boolean(careerRecord),
        hasRating: Boolean(ratings) || Boolean(impact),
      }),
    [
      values,
      playingStints,
      assignments,
      currentAssignment,
      honours.length,
      awards.length,
      careerRecord,
      ratings,
      impact,
    ],
  );

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (
      tab === "history" ||
      tab === "honours" ||
      tab === "playing" ||
      tab === "coaching"
    ) {
      loadNested().catch(() => undefined);
    }
    if (tab === "stats" || tab === "ratings" || tab === "matches" || tab === "rankings") {
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
      setLastUpdated(
        d.coach.updatedAt ? String(d.coach.updatedAt) : d.coach.lastVerifiedAt ? String(d.coach.lastVerifiedAt) : null,
      );
      if (!rugbypassUrl) {
        setRugbypassUrl(rugbyPassCoachUrl(String(d.coach.slug ?? "")));
      }
    }
    setAssignments(d.assignments ?? []);
    await loadNested().catch(() => undefined);
    await loadDataCoverage().catch(() => undefined);
    await loadOpenaiHistory().catch(() => undefined);
    setLoading(false);
  }

  async function loadDataCoverage() {
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "data-coverage" }),
    });
    const data = await res.json();
    if (res.ok) setDataCoverage(data.coverage ?? null);
  }

  async function loadOpenaiHistory() {
    const res = await fetch(`/api/admin/coaches/${id}/openai-profile-check`);
    const data = await res.json();
    if (!res.ok) return;
    setOpenaiLastChecked(data.lastChecked ?? null);
    const latest = data.history?.[0];
    if (latest?.report) setOpenaiReport(latest.report as CoachProfileCheckReport);
  }

  async function runOpenaiProfileCheck(scope: CoachProfileCheckScope = "full") {
    setOpenaiBusy(true);
    setBusyAction("openai");
    setError("");
    try {
      const res = await fetch(`/api/admin/coaches/${id}/openai-profile-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "OpenAI profile check failed");
        return;
      }
      setOpenaiReport(data.report ?? null);
      setOpenaiLastChecked(data.report?.checkedAt ?? new Date().toISOString());
    } finally {
      setOpenaiBusy(false);
      setBusyAction("");
    }
  }

  function dismissOpenaiFinding(finding: CoachProfileFinding) {
    setOpenaiReport((prev) =>
      prev
        ? { ...prev, findings: prev.findings.filter((f) => f.id !== finding.id) }
        : prev,
    );
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
    const [careerRes, impactRes, intelRes] = await Promise.all([
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
      fetch(`/api/admin/coaches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "coach-intelligence" }),
      }).then((r) => r.json()),
    ]);
    setCareerRecord(careerRes.careerRecord ?? null);
    setImpact(impactRes.impact ?? null);
    setRatings(intelRes.ratings ?? null);
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

  async function checkCareerData() {
    setCareerChecking(true);
    setBusyAction("check");
    setCareerCheckSummary("");
    setWikipediaImportError("");
    const [profileRes, careerRes] = await Promise.all([
      fetch(`/api/admin/coaches/${id}/profile-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full" }),
      }),
      fetch(`/api/admin/coaches/${id}/check-career`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "wikipedia" }),
      }),
    ]);
    const profileData = await profileRes.json();
    const careerData = await careerRes.json();
    setLastDataCheck(new Date().toISOString());

    if (!profileRes.ok && !careerRes.ok) {
      setWikipediaImportError(
        String(careerData.error ?? profileData.error ?? "Check data failed"),
      );
      setCareerChecking(false);
      setBusyAction("");
      return;
    }

    const careerRows: CoachSourceReviewRow[] = (careerData.rows ??
      []) as CoachSourceReviewRow[];
    const profileRows: CoachSourceReviewRow[] = (profileData.rows ?? []) as CoachSourceReviewRow[];
    const rows = [...careerRows, ...profileRows.filter((r) => r.status !== "complete")];
    setReviewRows(rows);

    const s = careerData.summary ?? {};
    const ps = profileData.summary ?? {};
    const summary = [
      careerRes.ok
        ? `Career: playing ${s.playingFound ?? 0} (missing ${s.playingMissing ?? 0}) · coaching ${s.coachingFound ?? 0} (missing ${s.coachingMissing ?? 0})`
        : `Career check skipped: ${careerData.error ?? "failed"}`,
      profileRes.ok
        ? `Profile inventory: ${ps.complete ?? 0} complete · ${ps.partial ?? 0} partial · ${ps.missing ?? 0} missing`
        : null,
      "Nothing auto-publishes — Accept to create needs_review rows.",
    ]
      .filter(Boolean)
      .join(" · ");
    setReviewSummary(summary);
    setCareerCheckSummary(summary);
    setCareerChecking(false);
    setBusyAction("");
  }

  async function findMissingData() {
    setBusyAction("missing");
    setWikipediaImportError("");
    const [profileRes, careerRes] = await Promise.all([
      fetch(`/api/admin/coaches/${id}/profile-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "missing" }),
      }),
      fetch(`/api/admin/coaches/${id}/check-career`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "wikipedia" }),
      }),
    ]);
    const profileData = await profileRes.json();
    const careerData = await careerRes.json();
    setLastDataCheck(new Date().toISOString());

    const missingCareer: CoachSourceReviewRow[] = (
      (careerData.rows ?? []) as CoachSourceReviewRow[]
    ).filter((r) => r.status === "missing");
    const profileRows = (profileData.rows ?? []) as CoachSourceReviewRow[];
    setReviewRows([...missingCareer, ...profileRows]);
    setReviewSummary(
      `Find missing: ${profileRows.length} incomplete profile fields · ${missingCareer.length} missing career rows from Wikipedia. Trusted complete fields were not re-queried.`,
    );
    setBusyAction("");
  }

  async function publishProfile() {
    setBusyAction("publish");
    setError("");
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPublic: true,
        publishStatus: "published",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Publish failed");
      setBusyAction("");
      return;
    }
    setValues((v) => ({ ...v, isPublic: true, publishStatus: "published" }));
    setBusyAction("");
  }

  async function refreshStatsFromHeader() {
    setBusyAction("stats");
    await loadStats();
    setBusyAction("");
    setTab("stats");
  }

  async function recalculateRatingFromHeader() {
    setBusyAction("rating");
    const before =
      typeof ratings?.coachRating === "number"
        ? (ratings.coachRating as number)
        : typeof impact?.coachRating === "number"
          ? (impact.coachRating as number)
          : null;
    const res = await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recalculate-ratings" }),
    });
    const data = await res.json();
    setBusyAction("");
    if (!res.ok) {
      alert(data.error ?? "Recalculate rating failed");
      return;
    }
    setRatings(data.ratings ?? null);
    const after =
      typeof data.ratings?.coachRating === "number"
        ? data.ratings.coachRating
        : typeof data.ratings?.overall === "number"
          ? data.ratings.overall
          : null;
    setRatingDiff({
      before,
      after,
      change: before != null && after != null ? Number((after - before).toFixed(1)) : null,
    });
    setLastRatingAt(new Date().toISOString());
    setTab("ratings");
  }

  async function acceptReviewRow(row: CoachSourceReviewRow) {
    if (row.kind !== "playing" && row.kind !== "coaching") {
      alert("Accept is available for career rows. Edit profile fields on Overview.");
      return;
    }
    setReviewBusy(true);
    const res = await fetch(`/api/admin/coaches/${id}/accept-career`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: row.kind,
        foundValue: row.foundValue,
        sourceUrl: row.source,
      }),
    });
    const data = await res.json();
    setReviewBusy(false);
    if (!res.ok) {
      alert(data.message ?? data.error ?? "Accept failed");
      return;
    }
    await reload();
    setReviewRows((rows) => rows.filter((r) => r !== row));
  }

  function dismissReviewRow(row: CoachSourceReviewRow, index: number) {
    setReviewRows((rows) => rows.filter((_, i) => i !== index));
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
        teamDisplayName: stintForm.teamDisplayName || null,
        teamType: stintForm.teamType,
        careerType: stintForm.careerType,
        competitionLevel: stintForm.competitionLevel || null,
        teamId: stintForm.teamId || null,
        apps: stintForm.apps || null,
        points: stintForm.points || null,
        position: stintForm.position || null,
        sourceUrl: stintForm.sourceUrl || null,
        showOnOverview: false,
        recordStatus: "needs_review",
      }),
    });
    if (res.ok) {
      setStintForm({
        yearsLabel: "",
        teamName: "",
        teamDisplayName: "",
        teamType: "provincial",
        careerType: "provincial_player",
        competitionLevel: "provincial",
        teamId: "",
        apps: "",
        points: "",
        position: "",
        sourceUrl: "",
      });
      await loadNested();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add stint");
    }
  }

  async function patchPlayingStint(stintId: string, patch: Record<string, unknown>) {
    await fetch(`/api/admin/coaches/${id}/playing-stints`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stintId, ...patch }),
    });
    await reload();
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
    const roleType = honourSubTab === "player" ? "player" : "coach";
    const res = await fetch(`/api/admin/coaches/${id}/honours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: honourForm.year || null,
        competitionName: honourForm.competitionName || null,
        teamName: honourForm.teamName || null,
        achievementType: honourForm.achievementType,
        honourLevel: honourForm.honourLevel,
        roleType,
      }),
    });
    if (res.ok) {
      setHonourForm({
        year: "",
        competitionName: "",
        teamName: "",
        achievementType: "winner",
        honourLevel: "secondary",
        roleType,
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

  function goTab(next: string) {
    if (TABS.some((t) => t.id === next)) setTab(next as TabId);
  }

  const coachHonours = honours.filter((h) => h.roleType === "coach");
  const playerHonours = honours.filter((h) => h.roleType === "player");

  return (
    <>
      <CoachCmsWorkflowHeader
        coachName={values.name}
        currentTeam={currentAssignment?.teamName ?? null}
        currentRole={currentAssignment?.roleLabel ?? null}
        slug={values.slug || null}
        publishStatus={values.publishStatus}
        completeness={completeness}
        lastUpdated={lastUpdated}
        lastVerifiedAt={values.lastVerifiedAt || null}
        lastDataCheck={lastDataCheck}
        lastRatingAt={lastRatingAt}
        saving={saving}
        busyAction={busyAction}
        onSave={() => {
          const form = document.getElementById("coach-cms-form") as HTMLFormElement | null;
          form?.requestSubmit();
        }}
        onPublish={() => void publishProfile()}
        onCheckData={() => void checkCareerData()}
        onFindMissing={() => void findMissingData()}
        onRefreshStats={() => void refreshStatsFromHeader()}
        onRecalculateRating={() => void recalculateRatingFromHeader()}
        onOpenAiProfileCheck={() => void runOpenaiProfileCheck("full")}
        onTab={goTab}
      />

      <CoachCmsOpenAiProfileCheckPanel
        coachId={id}
        lastChecked={openaiLastChecked}
        report={openaiReport}
        busy={openaiBusy}
        onRun={(scope) => void runOpenaiProfileCheck(scope)}
        onAcceptFinding={(finding) => {
          if (finding.field === "playingHistory" || finding.field.includes("career")) {
            setTab("playing");
            void findMissingData();
          } else if (finding.field === "honours" || finding.field === "awards") {
            setTab("honours");
          } else if (finding.recommendedAction === "RECALCULATE") {
            void recalculateRatingFromHeader();
          } else if (finding.recommendedAction === "LINK EXISTING CREST") {
            setTab("coaching");
          } else {
            setTab("overview");
          }
          dismissOpenaiFinding(finding);
        }}
        onDismissFinding={dismissOpenaiFinding}
        onSafeAction={(action) => {
          if (action === "recalculate") void recalculateRatingFromHeader();
          if (action === "refresh-links") {
            void (async () => {
              setCoverageBusy("links");
              await fetch(`/api/admin/coaches/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "refresh-match-links" }),
              });
              setCoverageBusy("");
              await loadDataCoverage();
            })();
          }
          if (action === "refresh-wikipedia") void importFromWikipedia();
          if (action === "refresh-rugbypass") void importFromRugbyPass();
        }}
      />

      <CoachCmsSourceReviewPanel
        title="Check data / source review"
        summary={reviewSummary}
        rows={reviewRows}
        busy={reviewBusy}
        onAccept={(row) => void acceptReviewRow(row)}
        onKeepCurrent={(row, index) => dismissReviewRow(row, index)}
        onIgnore={(row, index) => dismissReviewRow(row, index)}
        onFlag={(row, index) => {
          alert(`Flagged for later: ${row.kind} (${row.status})`);
          dismissReviewRow(row, index);
        }}
      />

      <CoachCmsDataCoveragePanel
        coachId={id}
        coverage={dataCoverage}
        busy={coverageBusy || busyAction}
        onReloadCoverage={() => void loadDataCoverage()}
        onRefreshLinks={async () => {
          setCoverageBusy("links");
          await fetch(`/api/admin/coaches/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refresh-match-links" }),
          });
          setCoverageBusy("");
          await loadDataCoverage();
        }}
        onRecalcStats={async () => {
          setCoverageBusy("stats");
          await loadStats();
          setCoverageBusy("");
          await loadDataCoverage();
          setTab("stats");
        }}
        onRecalcRating={() => void recalculateRatingFromHeader()}
        onRecalcAll={async () => {
          setCoverageBusy("all");
          const res = await fetch(`/api/admin/coaches/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "recalculate-all" }),
          });
          const data = await res.json();
          setCoverageBusy("");
          if (!res.ok) {
            alert(data.error ?? "Recalculate all failed");
            return;
          }
          if (data.coverage) setDataCoverage(data.coverage);
          else await loadDataCoverage();
          await reload();
        }}
      />

      {ratingDiff ? (
        <div className="cms-card mb-4 border border-zinc-700">
          <h3 className="font-semibold m-0 mb-2">Rating recalculation</h3>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-zinc-500 text-xs">Before</div>
              <div className="text-zinc-100">{ratingDiff.before ?? "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">New</div>
              <div className="text-zinc-100">{ratingDiff.after ?? "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Change</div>
              <div className="text-emerald-300">
                {ratingDiff.change == null
                  ? "—"
                  : `${ratingDiff.change > 0 ? "+" : ""}${ratingDiff.change}`}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
              <button
                type="button"
                className="cms-btn cms-btn--secondary shrink-0"
                disabled={careerChecking}
                onClick={() => void checkCareerData()}
              >
                {careerChecking ? "Checking…" : "Check career data"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary shrink-0"
                disabled={careerChecking}
                onClick={() => void checkCareerData()}
              >
                Check Wikipedia
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary shrink-0"
                disabled
                title="Coming next — Planet Rugby / SDMS role verification"
              >
                Check Planet Rugby
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary shrink-0"
                disabled
                title="Coming next — RugbyPass coach career verify"
              >
                Check RugbyPass
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-2 mb-0">
              Source review is read-only. Accept rows in History after review — verified data is never
              auto-overwritten.
            </p>
            {careerCheckSummary ? (
              <p className="text-emerald-400/90 text-sm mt-2 m-0">{careerCheckSummary}</p>
            ) : null}
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
          <form id="coach-cms-form" onSubmit={submit} className="cms-card space-y-4 max-w-3xl mb-4">
            {error && <p className="text-red-400 text-sm m-0">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <CoachCmsFieldLabel label="Name" kind="editorial" />
                <input
                  className="cms-input w-full mt-1"
                  value={values.name}
                  onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                  required
                />
              </label>
              <label className="block">
                <CoachCmsFieldLabel label="Slug" kind="editorial" />
                <input
                  className="cms-input w-full mt-1"
                  value={values.slug}
                  onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
                  required
                />
              </label>
              <label className="block">
                <CoachCmsFieldLabel label="Known as" kind="editorial" />
                <input
                  className="cms-input w-full mt-1"
                  value={values.knownAs}
                  onChange={(e) => setValues((v) => ({ ...v, knownAs: e.target.value }))}
                />
              </label>
              <label className="block">
                <CoachCmsFieldLabel
                  label="Full name"
                  kind="verified"
                  source={values.wikipediaUrl || values.sourceUrl || "cms"}
                  lastChecked={values.lastVerifiedAt || null}
                  confidence={values.fullName ? "high" : "low"}
                />
                <input
                  className="cms-input w-full mt-1"
                  value={values.fullName}
                  onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <CoachCmsFieldLabel
                  label="Nationality"
                  kind="verified"
                  source={values.wikipediaUrl || "cms"}
                  lastChecked={values.lastVerifiedAt || null}
                  confidence={values.nationality ? "high" : "low"}
                />
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
                <CoachCmsFieldLabel
                  label="Date of birth"
                  kind="verified"
                  source={values.wikipediaUrl || "cms"}
                  lastChecked={values.lastVerifiedAt || null}
                  confidence={values.birthDate ? "high" : "low"}
                />
                <input
                  type="date"
                  className="cms-input w-full mt-1"
                  value={values.birthDate}
                  onChange={(e) => setValues((v) => ({ ...v, birthDate: e.target.value }))}
                />
              </label>
              <label className="block">
                <CoachCmsFieldLabel
                  label="Height (cm)"
                  kind="verified"
                  source={values.wikipediaUrl || "cms"}
                  lastChecked={values.lastVerifiedAt || null}
                  confidence={values.heightCm ? "medium" : "low"}
                />
                <input
                  type="number"
                  className="cms-input w-full mt-1"
                  value={values.heightCm}
                  onChange={(e) => setValues((v) => ({ ...v, heightCm: e.target.value }))}
                />
              </label>
              <label className="block">
                <CoachCmsFieldLabel
                  label="Place of birth"
                  kind="verified"
                  source={values.wikipediaUrl || "cms"}
                  lastChecked={values.lastVerifiedAt || null}
                  confidence={values.placeOfBirth ? "medium" : "low"}
                />
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
                <CoachCmsFieldLabel label="Preferred system" kind="editorial" />
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
                <CoachCmsFieldLabel label="Coaching style" kind="editorial" />
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
              <CoachCmsFieldLabel label="Bio summary" kind="editorial" />
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
        </>
      )}

      {(tab === "history" || tab === "playing" || tab === "coaching") && (
        <div className="space-y-4 max-w-3xl">
          {(tab === "history" || tab === "playing") && (
          <div className="cms-card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold m-0">Playing career</h3>
                <p className="text-xs text-zinc-500 m-0 mt-1">
                  Structured stints drive the public Playing Career card. Timeline summary rows use
                  competition level <code>timeline_summary</code> and stay out of the table.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs"
                  disabled={Boolean(busyAction) || openaiBusy}
                  onClick={() => void runOpenaiProfileCheck("career")}
                >
                  {openaiBusy ? "Checking…" : "Check playing career with OpenAI"}
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs"
                  disabled={Boolean(busyAction)}
                  onClick={() => void findMissingData()}
                >
                  Find missing career
                </button>
              </div>
            </div>
            {playingStints.length === 0 ? (
              <p className="text-sm text-zinc-500">No playing stints yet.</p>
            ) : (
              <ul className="space-y-2 mb-4 list-none p-0 m-0">
                {playingStints.map((s) => {
                  const intl = s.teamType === "international";
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-start justify-between gap-2 text-sm border-b border-zinc-800 pb-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div>
                          <span className="font-medium text-zinc-100">
                            {s.yearsLabel} · {s.teamDisplayName || s.teamName}
                          </span>
                          <span className="ml-2 text-[10px] uppercase text-zinc-500">
                            {s.teamType}
                            {s.competitionLevel ? ` · ${s.competitionLevel}` : ""}
                          </span>
                          {s.recordStatus ? (
                            <span className="ml-2 text-[10px] uppercase text-zinc-500">
                              {s.recordStatus}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-zinc-400">
                          Apps {s.apps ?? "—"} · Points {s.points ?? "—"}
                          {s.position ? ` · ${s.position}` : ""}
                          {!s.teamId ? (
                            <span className="text-amber-400"> · missing team link</span>
                          ) : null}
                          {intl && s.apps != null ? (
                            <span className="block mt-1 text-zinc-500">
                              VERIFIED CAREER TOTAL {s.apps}
                              {" · "}
                              DATABASE COVERAGE — / {s.apps} (historic match backfill)
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={Boolean(s.showOnOverview)}
                            onChange={(e) =>
                              void patchPlayingStint(s.id, { showOnOverview: e.target.checked })
                            }
                          />
                          Timeline
                        </label>
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs"
                          onClick={() =>
                            void patchPlayingStint(s.id, { recordStatus: "verified" })
                          }
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs"
                          onClick={() => {
                            const teamId = window.prompt("Link team UUID", s.teamId ?? "");
                            if (teamId != null) void patchPlayingStint(s.id, { teamId: teamId || null });
                          }}
                        >
                          Link team
                        </button>
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs"
                          onClick={() => {
                            const url = window.prompt("Source URL", s.sourceUrl ?? "");
                            if (url != null) void patchPlayingStint(s.id, { sourceUrl: url || null });
                          }}
                        >
                          Source
                        </button>
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs text-red-400"
                          onClick={() => deleteNested("playing-stints", s.id)}
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  );
                })}
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
              <input
                className="cms-input"
                placeholder="Display name (e.g. Free State (SR))"
                value={stintForm.teamDisplayName}
                onChange={(e) => setStintForm((f) => ({ ...f, teamDisplayName: e.target.value }))}
              />
              <select
                className="cms-input"
                value={stintForm.teamType}
                onChange={(e) => {
                  const teamType = e.target.value;
                  setStintForm((f) => ({
                    ...f,
                    teamType,
                    careerType:
                      teamType === "franchise"
                        ? "super_rugby_player"
                        : teamType === "international"
                          ? "international_player"
                          : teamType === "club"
                            ? "club_player"
                            : "provincial_player",
                    competitionLevel:
                      teamType === "franchise"
                        ? "super_rugby"
                        : teamType === "international"
                          ? "international"
                          : teamType,
                  }));
                }}
              >
                <option value="provincial">PROVINCIAL</option>
                <option value="franchise">SUPER RUGBY</option>
                <option value="club">CLUB</option>
                <option value="international">INTERNATIONAL</option>
              </select>
              <input
                className="cms-input"
                placeholder="Team ID (UUID)"
                value={stintForm.teamId}
                onChange={(e) => setStintForm((f) => ({ ...f, teamId: e.target.value }))}
              />
              <input
                className="cms-input"
                placeholder="Source URL"
                value={stintForm.sourceUrl}
                onChange={(e) => setStintForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              />
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
                Add career record
              </button>
            </form>
          </div>
          )}

          {(tab === "history" || tab === "coaching") && (
          <div className="cms-card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold m-0">Coaching career</h3>
              <button
                type="button"
                className="cms-btn cms-btn--secondary text-xs"
                disabled={Boolean(busyAction)}
                onClick={() => void findMissingData()}
              >
                Find missing career
              </button>
            </div>
            <CoachTeamAssignmentSection
              coachId={id}
              assignments={assignments}
              onChanged={() => reload()}
            />
          </div>
          )}
        </div>
      )}

      {tab === "honours" && (
        <div className="space-y-4 max-w-3xl">
          <CoachCmsAchievementsPanel coachId={id} />
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

          <div className="flex flex-wrap gap-2">
            {HONOUR_SUBTABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`cms-btn ${honourSubTab === item.id ? "cms-btn--primary" : "cms-btn--secondary"}`}
                onClick={() => setHonourSubTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(honourSubTab === "coach" || honourSubTab === "player") && (
          <div className="cms-card">
            <h3 className="font-semibold m-0 mb-3">
              {honourSubTab === "coach" ? "Coach honours" : "Player honours"}
            </h3>
            {(honourSubTab === "coach" ? coachHonours : playerHonours).length === 0 ? (
              <p className="text-sm text-zinc-500">No honours yet.</p>
            ) : (
              <ul className="space-y-2 mb-4 list-none p-0 m-0">
                {(honourSubTab === "coach" ? coachHonours : playerHonours).map((h) => (
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
              <button type="submit" className="cms-btn cms-btn--primary sm:col-span-3">
                Add honour
              </button>
            </form>
          </div>
          )}

          {honourSubTab === "awards" && (
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
          )}

          {honourSubTab === "medals" && (
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
          )}
        </div>
      )}

      {tab === "stats" || tab === "ratings" || tab === "matches" || tab === "rankings" ? (
        <div className="space-y-4 max-w-3xl">
          {tab === "matches" ? (
            <p className="text-sm text-zinc-500 cms-card">
              Match list is derived from Rugby365 fixtures and lineups. Use Refresh stats after
              completed matches — editors do not maintain match rows manually.
            </p>
          ) : null}
          {tab === "rankings" ? (
            <p className="text-sm text-zinc-500 cms-card">
              Rankings update when ratings are recalculated. Use Recalculate rating in the header.
            </p>
          ) : null}
          <div className="cms-card space-y-3">
            <h3 className="font-semibold m-0 flex items-center gap-2">
              {tab === "ratings" ? "Ratings" : "Career record / stats"}
              <CoachCmsFieldLabel label="Auto calculated" kind="auto" />
            </h3>
            <p className="text-sm text-zinc-500 m-0">
              Stats are refreshed from matches, scores, and lineups — not edited by hand.
            </p>
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
            <CoachCmsIntelligencePanel
              metrics={
                Array.isArray((ratings as { intelligence?: unknown } | null)?.intelligence)
                  ? ((ratings as { intelligence: import("@/lib/coach-intelligence-engine").CoachIntelligenceMetric[] })
                      .intelligence)
                  : null
              }
              modelVersion={
                typeof (ratings as { intelligenceModelVersion?: unknown } | null)
                  ?.intelligenceModelVersion === "string"
                  ? String(
                      (ratings as { intelligenceModelVersion: string }).intelligenceModelVersion,
                    )
                  : "coach-intelligence-v1"
              }
              busy={statsBusy === "recalculate-ratings"}
              onRecalculate={() => void runStatsAction("recalculate-ratings")}
            />
            <CoachCmsPowerIndexPanel
              publicSlug={values.slug || null}
              powerIndex={
                typeof (ratings as { powerIndex?: unknown } | null)?.powerIndex === "number"
                  ? (ratings as { powerIndex: number }).powerIndex
                  : null
              }
              previousPowerIndex={
                typeof (ratings as { previousPowerIndex?: unknown } | null)?.previousPowerIndex ===
                "number"
                  ? (ratings as { previousPowerIndex: number }).previousPowerIndex
                  : null
              }
              powerIndexChange={
                typeof (ratings as { powerIndexChange?: unknown } | null)?.powerIndexChange ===
                "number"
                  ? (ratings as { powerIndexChange: number }).powerIndexChange
                  : null
              }
              detail={
                (ratings as { powerIndexDetail?: import("@/lib/coach-power-index-engine").CoachPowerIndexResult | null } | null)
                  ?.powerIndexDetail ?? null
              }
              mismatches={
                Array.isArray(
                  (ratings as { powerIndexMismatches?: unknown } | null)?.powerIndexMismatches,
                )
                  ? (ratings as {
                      powerIndexMismatches: Array<{
                        key: string;
                        intelligenceScore: number;
                        powerIndexScore: number;
                      }>;
                    }).powerIndexMismatches
                  : null
              }
              modelVersion={
                typeof (ratings as { powerIndexVersion?: unknown } | null)?.powerIndexVersion ===
                "string"
                  ? String((ratings as { powerIndexVersion: string }).powerIndexVersion)
                  : "coach-power-v1"
              }
              lastCalculated={
                typeof (ratings as { powerIndexDetail?: { calculatedAt?: string } } | null)
                  ?.powerIndexDetail?.calculatedAt === "string"
                  ? (ratings as { powerIndexDetail: { calculatedAt: string } }).powerIndexDetail
                      .calculatedAt
                  : null
              }
              busy={statsBusy === "recalculate-ratings"}
              onRecalculate={() => void runStatsAction("recalculate-ratings")}
            />
            <CoachCmsRatingPanel
              publicSlug={values.slug || null}
              overallRating={
                typeof (ratings as { overallRating?: unknown } | null)?.overallRating === "number"
                  ? (ratings as { overallRating: number }).overallRating
                  : null
              }
              previousOverallRating={
                typeof (ratings as { previousOverallRating?: unknown } | null)
                  ?.previousOverallRating === "number"
                  ? (ratings as { previousOverallRating: number }).previousOverallRating
                  : null
              }
              overallRatingChange={
                typeof (ratings as { overallRatingChange?: unknown } | null)
                  ?.overallRatingChange === "number"
                  ? (ratings as { overallRatingChange: number }).overallRatingChange
                  : null
              }
              detail={
                (ratings as {
                  coachRatingDetail?: import("@/lib/coach-rating-engine").CoachRatingResult | null;
                } | null)?.coachRatingDetail ?? null
              }
              worldRank={
                typeof (ratings as { worldRank?: unknown } | null)?.worldRank === "number"
                  ? (ratings as { worldRank: number }).worldRank
                  : null
              }
              previousWorldRank={
                typeof (ratings as { previousWorldRank?: unknown } | null)?.previousWorldRank ===
                "number"
                  ? (ratings as { previousWorldRank: number }).previousWorldRank
                  : null
              }
              worldRankChange={
                typeof (ratings as { worldRankChange?: unknown } | null)?.worldRankChange ===
                "number"
                  ? (ratings as { worldRankChange: number }).worldRankChange
                  : null
              }
              rankedOutOf={
                typeof (ratings as { rankedOutOf?: unknown } | null)?.rankedOutOf === "number"
                  ? (ratings as { rankedOutOf: number }).rankedOutOf
                  : null
              }
              modelVersion={
                typeof (ratings as { modelVersion?: unknown } | null)?.modelVersion === "string"
                  ? String((ratings as { modelVersion: string }).modelVersion)
                  : "coach-rating-v1"
              }
              lastCalculated={
                typeof (ratings as { coachRatingDetail?: { calculatedAt?: string } } | null)
                  ?.coachRatingDetail?.calculatedAt === "string"
                  ? (ratings as { coachRatingDetail: { calculatedAt: string } }).coachRatingDetail
                      .calculatedAt
                  : null
              }
              busy={statsBusy === "recalculate-ratings"}
              onRecalculate={() => void runStatsAction("recalculate-ratings")}
            />
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
      ) : null}

      {tab === "images" ? (
        <div className="max-w-3xl">
          <CoachImagesPanel
            coachId={id}
            coachName={values.name || undefined}
            currentImageUrl={values.imageUrl || null}
            onPrimaryChanged={(imageUrl) =>
              setValues((v) => ({ ...v, imageUrl: imageUrl ?? "" }))
            }
          />
        </div>
      ) : null}

      {tab === "tactics" ? (
        <div className="cms-card max-w-3xl space-y-3">
          <h3 className="font-semibold m-0">Tactics</h3>
          <label className="block">
            <CoachCmsFieldLabel label="Preferred system" kind="editorial" />
            <input
              className="cms-input w-full mt-1"
              value={values.preferredSystem}
              onChange={(e) => setValues((v) => ({ ...v, preferredSystem: e.target.value }))}
            />
          </label>
          <label className="block">
            <CoachCmsFieldLabel label="Coaching style" kind="editorial" />
            <input
              className="cms-input w-full mt-1"
              value={values.coachingStyle}
              onChange={(e) => setValues((v) => ({ ...v, coachingStyle: e.target.value }))}
            />
          </label>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            onClick={() => {
              const form = document.getElementById("coach-cms-form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            Save tactics
          </button>
        </div>
      ) : null}

      {tab === "sources" ? (
        <div className="cms-card max-w-3xl space-y-3">
          <h3 className="font-semibold m-0">Sources</h3>
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
          <label className="block">
            <span className="text-sm text-zinc-400">Source URL</span>
            <input
              className="cms-input w-full mt-1"
              value={values.sourceUrl}
              onChange={(e) => setValues((v) => ({ ...v, sourceUrl: e.target.value }))}
            />
          </label>
          <p className="text-sm text-zinc-500 m-0">
            Use Check data / Find missing data in the header. External research never auto-publishes.
          </p>
        </div>
      ) : null}

      {tab === "ai" ? (
        <div className="max-w-3xl">
          <PersonIntelligencePanel
            roleType="coach"
            roleEntityId={id}
            intelligenceUrl={`/api/admin/coaches/${id}/intelligence`}
            onApplied={() => void reload()}
          />
        </div>
      ) : null}

      {tab === "selection" || tab === "players" || tab === "audit" ? (
        <div className="cms-card max-w-3xl">
          <h3 className="font-semibold m-0 mb-2">
            {tab === "selection"
              ? "Selection"
              : tab === "players"
                ? "Players"
                : "Audit history"}
          </h3>
          <p className="text-sm text-zinc-500 m-0">
            {tab === "audit"
              ? "Field-level audit (old/new value, editor, date, source, reason) will appear here. Career, appointments, honours, images, and rating overrides are priority."
              : "Auto-calculated from lineups and match data. No manual maintenance — refreshes after completed matches."}
          </p>
        </div>
      ) : null}
    </>
  );
}
