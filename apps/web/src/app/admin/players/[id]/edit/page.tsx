"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { PlayerDataSection } from "@/components/admin/PlayerDataSection";
import { PlayerPlanetRugbyImagesPanel } from "@/components/admin/PlayerPlanetRugbyImagesPanel";
import { PlayerImageLearningPanel } from "@/components/admin/PlayerImageLearningPanel";
import { WikipediaCareerTables } from "@/components/admin/WikipediaCareerTables";
import { PlayerLegendSection } from "@/components/admin/PlayerLegendSection";
import { PlayerTransferConflictWarning } from "@/components/admin/PlayerTransferConflictWarning";
import { PlayerDevelopmentChartCmsPanel } from "@/components/admin/PlayerDevelopmentChartCmsPanel";
import { PlayerMatchRatingsPanel } from "@/components/admin/PlayerMatchRatingsPanel";
import { PlayerRadarCmsPanel } from "@/components/admin/PlayerRadarCmsPanel";
import type { PlayerSeasonStatsRow } from "@/lib/player-season-stats-service";
import { wikipediaCareerTotals } from "@/lib/player-career-stint-utils";
import type { LegendRow } from "@/lib/legend-admin-service";
import { PageHeader } from "@/components/shell/PageHeader";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";
import { groupRowsBySeason } from "@/lib/fixture-season-utils";
import { movementTypeLabel } from "@/lib/transfer-types";
import { cmsPlayerSlugToRugbyPassSlug, rugbyPassPlayerUrl } from "@rugby365/import-sdk";
import {
  PLAYER_CAREER_STATUSES,
  careerStatusLabel,
  type PlayerCareerStatus,
} from "@/lib/player-career-status";

const AiAssistPanel = dynamic(
  () => import("@/components/admin/AiAssistPanel").then((m) => ({ default: m.AiAssistPanel })),
  {
    ssr: false,
    loading: () => <p className="text-zinc-500 text-sm cms-card mb-4">Loading AI assist…</p>,
  },
);

const PlayerBioAutomationPanel = dynamic(
  () =>
    import("@/components/admin/PlayerBioAutomationPanel").then((m) => ({
      default: m.PlayerBioAutomationPanel,
    })),
  {
    ssr: false,
    loading: () => <p className="text-zinc-500 text-sm cms-card mb-4">Loading bio automation…</p>,
  },
);

const PlayerPublicProfileDataPanel = dynamic(
  () =>
    import("@/components/admin/PlayerPublicProfileDataPanel").then((m) => ({
      default: m.PlayerPublicProfileDataPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-zinc-500 text-sm cms-card mb-4">Loading public profile data…</p>
    ),
  },
);

const PlayerScoutIntelligencePanel = dynamic(
  () =>
    import("@/components/admin/PlayerScoutIntelligencePanel").then((m) => ({
      default: m.PlayerScoutIntelligencePanel,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-zinc-500 text-sm cms-card mb-4">Loading Scout Intelligence…</p>
    ),
  },
);

type PlayerProfile = {
  age: number | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  positionName: string | null;
  clubName: string | null;
  countryName: string | null;
  squadNumber: number | null;
  socialAccounts: {
    twitter?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
    website?: string | null;
  };
  externalLinks: {
    wikipedia?: string | null;
    rugbypass?: string | null;
    wikidata?: string | null;
  };
  sourceStatus: {
    wikipediaSyncedAt?: string | null;
    rugbypassSyncedAt?: string | null;
    rugbypassSlug?: string | null;
    rugbypassPlayerId?: string | null;
  };
};

type ExternalMatchRow = {
  id: string;
  matchTitle: string | null;
  teamName: string | null;
  opponentName: string | null;
  competitionName: string | null;
  seasonLabel: string | null;
  kickoffAt: string | null;
  squadRole: string | null;
  minutesPlayed: number;
  tries: number;
  points: number;
  conversions: number;
  fixtureId: string | null;
  sourceProvider: string;
  syncedAt: string;
};

type CareerTimelineEntry = {
  id: string;
  fromClub: string | null;
  toClub: string | null;
  transferType: string;
  movementType: string;
  effectiveDate: string | null;
  seasonLabel: string | null;
  competitionName: string | null;
  positionName: string | null;
  notes: string | null;
  sourceProvider: string | null;
};

type Transfer = {
  id: string;
  fromClub: string | null;
  toClub: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  transferType: string;
  effectiveDate: string | null;
  notes: string | null;
};

type SquadAppearance = {
  id: string;
  fixtureId: string;
  fixtureSlug: string;
  teamName: string;
  jerseyNumber: number | null;
  squadRole: string;
  positionName: string | null;
  clubName: string | null;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
  kickoffAt: string | null;
  status: string;
  scoreline: string;
  opponentName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  competitionName: string | null;
  seasonLabel: string;
  matchRating: number | null;
  matchRatingStatus: string | null;
  matchMinutes: number | null;
  matchRatingChange: number | null;
  matchPerformanceTrend: string | null;
};

type MatchEventRow = {
  id: string;
  eventType: string;
  minute: number;
  fixtureId: string;
  fixtureSlug: string;
  kickoffAt: string | null;
  teamName: string | null;
  homeScore: number;
  awayScore: number;
  competitionName: string | null;
  seasonLabel: string;
};

type CareerStint = {
  id: string;
  careerType: string;
  yearsLabel: string;
  teamName: string;
  apps: number | null;
  points: number | null;
};

type ArchivePlayer = {
  fullName?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  school?: string | null;
  relatives?: string | null;
  positions?: string[] | null;
  bioSummary?: string | null;
  wikipediaUrl?: string | null;
  archiveSyncedAt?: string | null;
};

type Stats = {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
};

function stat(n: number) {
  return n > 0 ? String(n) : "—";
}

export default function EditPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);

  const clubTeamGroups = useMemo(
    () => teamGroups.filter((group) => !group.label.startsWith("Internationals")),
    [teamGroups],
  );
  const internationalTeamGroups = useMemo(
    () => teamGroups.filter((group) => group.label.startsWith("Internationals")),
    [teamGroups],
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [careerTimeline, setCareerTimeline] = useState<CareerTimelineEntry[]>([]);
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStatsRow[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [externalMatches, setExternalMatches] = useState<ExternalMatchRow[]>([]);
  const [squads, setSquads] = useState<SquadAppearance[]>([]);
  const [events, setEvents] = useState<MatchEventRow[]>([]);
  const [careerStints, setCareerStints] = useState<CareerStint[]>([]);
  const [legends, setLegends] = useState<LegendRow[]>([]);
  const [archive, setArchive] = useState<ArchivePlayer | null>(null);
  const [values, setValues] = useState({
    name: "",
    slug: "",
    positionName: "",
    clubName: "",
    countryName: "",
    nationCode: "",
    clubTeamId: "",
    internationalTeamId: "",
    externalProviderId: "",
    squadNumber: "",
    fullName: "",
    birthDate: "",
    birthPlace: "",
    heightCm: "",
    weightKg: "",
    socialTwitter: "",
    socialInstagram: "",
    socialFacebook: "",
    socialWebsite: "",
    careerStatus: "active" as PlayerCareerStatus,
    isPublic: true,
    publishStatus: "published",
    seoTitle: "",
    seoDescription: "",
    publicIntroOverride: "",
    preferredFoot: "",
    school: "",
    university: "",
    imageUrl: "",
  });
  const [transferForm, setTransferForm] = useState({
    transferType: "club" as "club" | "international",
    fromTeamId: "",
    toTeamId: "",
    notes: "",
  });
  const [rugbypassUrl, setRugbypassUrl] = useState("");
  const [rugbypassImporting, setRugbypassImporting] = useState(false);
  const [rugbypassImportError, setRugbypassImportError] = useState("");
  const [wikipediaUrl, setWikipediaUrl] = useState("");
  const [wikipediaImporting, setWikipediaImporting] = useState(false);
  const [wikipediaImportError, setWikipediaImportError] = useState("");
  const [profileCategory, setProfileCategory] = useState<
    "club" | "international" | "scout"
  >("club");

  const squadGroups = useMemo(
    () =>
      groupRowsBySeason(squads, (row) => ({
        competitionName: row.competitionName,
        seasonLabel: row.seasonLabel,
      })),
    [squads],
  );

  const eventGroups = useMemo(
    () =>
      groupRowsBySeason(events, (row) => ({
        competitionName: row.competitionName,
        seasonLabel: row.seasonLabel,
      })),
    [events],
  );

  function applyPlayerPayload(d: Record<string, unknown>) {
    const player = d.player as Record<string, unknown> | undefined;
    const profile = d.profile as Record<string, unknown> | undefined;
    if (player) {
      const socialAccounts = profile?.socialAccounts as Record<string, string | null> | undefined;
      setValues({
        name: String(player.name ?? ""),
        slug: String(player.slug ?? ""),
        positionName: String(player.positionName ?? ""),
        clubName: String(player.clubName ?? ""),
        countryName: String(player.countryName ?? ""),
        nationCode: String(player.nationCode ?? ""),
        clubTeamId: String(player.clubTeamId ?? ""),
        internationalTeamId: String(player.internationalTeamId ?? ""),
        externalProviderId: String(player.externalProviderId ?? ""),
        squadNumber: player.squadNumber != null ? String(player.squadNumber) : "",
        fullName: String(player.fullName ?? ""),
        birthDate: String(player.birthDate ?? ""),
        birthPlace: String(player.birthPlace ?? ""),
        heightCm: player.heightCm != null ? String(player.heightCm) : "",
        weightKg: player.weightKg != null ? String(player.weightKg) : "",
        socialTwitter: socialAccounts?.twitter ?? "",
        socialInstagram: socialAccounts?.instagram ?? "",
        socialFacebook: socialAccounts?.facebook ?? "",
        socialWebsite: socialAccounts?.website ?? "",
        careerStatus: (player.careerStatus ?? "active") as PlayerCareerStatus,
        isPublic: player.isPublic !== false,
        publishStatus: String(player.publishStatus ?? "published"),
        seoTitle: String(player.seoTitle ?? ""),
        seoDescription: String(player.seoDescription ?? ""),
        publicIntroOverride: String(player.publicIntroOverride ?? ""),
        preferredFoot: String(player.preferredFoot ?? ""),
        school: String(player.school ?? ""),
        university: String(player.university ?? ""),
        imageUrl: String(player.imageUrl ?? ""),
      });
    }
    setProfile((profile as PlayerProfile | null) ?? null);
    setExternalMatches((d.externalMatches as ExternalMatchRow[]) ?? []);
    const externalLinks = profile?.externalLinks as Record<string, string | null> | undefined;
    const sourceStatus = profile?.sourceStatus as Record<string, string | null> | undefined;
    setRugbypassUrl(
      externalLinks?.rugbypass ??
        (player?.rugbypassUrl ? String(player.rugbypassUrl) : undefined) ??
        (player?.slug
          ? rugbyPassPlayerUrl(
              cmsPlayerSlugToRugbyPassSlug(
                String(player.slug),
                player.externalProviderId ? String(player.externalProviderId) : undefined,
              ),
            )
          : ""),
    );
    setWikipediaUrl(
      externalLinks?.wikipedia ??
        (player?.wikipediaUrl ? String(player.wikipediaUrl) : "") ??
        "",
    );
    setTransfers((d.transfers as Transfer[]) ?? []);
    setCareerTimeline((d.careerTimeline as CareerTimelineEntry[]) ?? []);
    setStats((d.stats as Stats | null) ?? null);
    setSquads((d.squads as SquadAppearance[]) ?? []);
    setEvents((d.events as MatchEventRow[]) ?? []);
    setCareerStints((d.careerStints as CareerStint[]) ?? []);
    setLegends((d.legends as LegendRow[]) ?? []);
    setArchive((player as ArchivePlayer | null) ?? null);
  }

  function loadSeasonStats() {
    return fetch(`/api/admin/players/${id}/season-stats`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setSeasonStats(data.seasonStats ?? []))
      .catch(() => undefined);
  }

  function loadTeams() {
    return fetch("/api/admin/teams?grouped=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((teamsData) => setTeamGroups(teamsData.groups ?? []))
      .catch(() => undefined);
  }

  function load() {
    return fetch(`/api/admin/players/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(String(data.error ?? "Failed to load player"));
        return data;
      })
      .then((d) => {
        applyPlayerPayload(d);
        setLoading(false);
        void loadTeams();
        void loadSeasonStats();
      });
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load player");
      setLoading(false);
    });
    void loadTeams();
    void loadSeasonStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on id change only
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        clubTeamId: values.clubTeamId || null,
        internationalTeamId: values.internationalTeamId || null,
        heightCm: values.heightCm ? Number(values.heightCm) : null,
        weightKg: values.weightKg ? Number(values.weightKg) : null,
        squadNumber: values.squadNumber ? Number(values.squadNumber) : null,
        birthDate: values.birthDate || null,
        birthPlace: values.birthPlace || null,
        fullName: values.fullName || null,
        seoTitle: values.seoTitle || null,
        seoDescription: values.seoDescription || null,
        publicIntroOverride: values.publicIntroOverride || null,
        preferredFoot: values.preferredFoot || null,
        school: values.school || null,
        university: values.university || null,
        isPublic: values.isPublic,
        publishStatus: values.publishStatus,
        socialAccounts: {
          twitter: values.socialTwitter || null,
          instagram: values.socialInstagram || null,
          facebook: values.socialFacebook || null,
          website: values.socialWebsite || null,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Failed to save");
    else await load();
    setSaving(false);
  }

  async function importFromRugbyPass() {
    setRugbypassImporting(true);
    setRugbypassImportError("");
    const res = await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enrich-rugbypass",
        ...(rugbypassUrl.trim() ? { sourceUrl: rugbypassUrl.trim() } : {}),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await load();
    } else {
      setRugbypassImportError(data.reason ?? data.error ?? "RugbyPass import failed");
    }
    setRugbypassImporting(false);
  }

  async function importFromWikipedia() {
    setWikipediaImporting(true);
    setWikipediaImportError("");
    const res = await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enrich-wikipedia",
        ...(wikipediaUrl.trim() ? { sourceUrl: wikipediaUrl.trim() } : {}),
        ...(values.name.trim() ? { name: values.name.trim() } : {}),
      }),
    });
    const data = await res.json();
    // Always reload — pasted URL may have been saved even when archive pull failed.
    await load();
    if (!res.ok) {
      const reason = String(data.reason ?? data.error ?? "Wikipedia lookup failed");
      if (reason.startsWith("name_mismatch:")) {
        const wikiName = reason.slice("name_mismatch:".length);
        setWikipediaImportError(
          `Wikipedia page is for “${wikiName}”, which does not match this CMS player. Check the URL against RugbyPass.`,
        );
      } else if (reason === "no_matching_wikipedia_article") {
        setWikipediaImportError(
          "No matching Wikipedia article found. URL was saved if valid — verify it matches this player (and RugbyPass).",
        );
      } else if (reason === "invalid_wikipedia_url") {
        setWikipediaImportError(
          "Invalid Wikipedia URL. Use a full article link, e.g. https://en.wikipedia.org/wiki/Antoine_Dupont",
        );
      } else {
        setWikipediaImportError(reason);
      }
    }
    setWikipediaImporting(false);
  }

  async function addTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferForm.toTeamId) {
      alert("Select a destination team.");
      return;
    }
    const res = await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transfer: transferForm }),
    });
    const data = await res.json();
    if (res.ok) {
      setTransferForm({ transferType: "club", fromTeamId: "", toTeamId: "", notes: "" });
      await load();
    } else alert(data.error ?? "Transfer failed");
  }

  async function remove() {
    if (!confirm("Delete this player?")) return;
    const res = await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/players");
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="CMS" title="Edit player" />
        <p className="text-zinc-500 text-sm">Loading player data…</p>
      </>
    );
  }

  if (error && !values.name) {
    return (
      <>
        <PageHeader eyebrow="CMS" title="Edit player" />
        <p className="text-red-400 text-sm">{error}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Edit player"
        actions={
          values.slug ? (
            <Link
              href={`/players/${values.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null
        }
      />

      <AiAssistPanel entityType="player" entityId={id} onApplied={() => void load()} />

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-2">Player profile information</h3>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Three tabs — Club, International and Scout — matching the public profile.
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Profile information categories">
          {(
            [
              { id: "club", label: "Club" },
              { id: "international", label: "International" },
              { id: "scout", label: "Scout" },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cms-btn ${profileCategory === c.id ? "cms-btn--primary" : "cms-btn--secondary"}`}
              aria-pressed={profileCategory === c.id}
              onClick={() => setProfileCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </div>

      <PlayerBioAutomationPanel
        playerId={id}
        onApplied={() => void load()}
        preferredTab={
          profileCategory === "club"
            ? "domestic"
            : profileCategory === "international"
              ? "international"
              : "scouting"
        }
      />

      {profileCategory === "club" ? (
        <PlayerPublicProfileDataPanel playerId={id} onApplied={() => void load()} />
      ) : null}

      {profileCategory === "scout" ? (
        <PlayerScoutIntelligencePanel
          playerId={id}
          playerSlug={values.slug || null}
          onApplied={() => void load()}
        />
      ) : null}

      <div className="cms-card mb-4 border border-emerald-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold m-0">RugbyPass import</h3>
          {profile?.sourceStatus?.rugbypassSyncedAt ? (
            <span className="text-xs text-zinc-500">
              Last synced {new Date(profile.sourceStatus.rugbypassSyncedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Paste a RugbyPass player URL to enrich this profile (physical stats, club, nationality, recent
          matches). Example:{" "}
          <span className="text-zinc-400 font-mono text-xs">
            https://www.rugbypass.com/players/adam-brocklebank/
          </span>
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="cms-input flex-1"
            type="url"
            placeholder="https://www.rugbypass.com/players/player-slug/"
            value={rugbypassUrl}
            onChange={(e) => setRugbypassUrl(e.target.value)}
          />
          <button
            type="button"
            className="cms-btn cms-btn--primary shrink-0"
            disabled={rugbypassImporting}
            onClick={() => importFromRugbyPass()}
          >
            {rugbypassImporting ? "Importing…" : "Import from RugbyPass"}
          </button>
        </div>
        {rugbypassImportError ? (
          <p className="text-red-400 text-sm mt-2 m-0">{rugbypassImportError}</p>
        ) : null}
      </div>

      {stats && (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0">Career scoring</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-3">
            CMS fixture totals compared with Wikipedia archive career points.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-zinc-500">T</span>{" "}
              <span className="font-mono">{stats.tries}</span>
            </span>
            <span>
              <span className="text-zinc-500">C</span>{" "}
              <span className="font-mono">{stats.conversions}</span>
            </span>
            <span>
              <span className="text-zinc-500">P</span>{" "}
              <span className="font-mono">{stats.penalties}</span>
            </span>
            <span>
              <span className="text-zinc-500">DG</span>{" "}
              <span className="font-mono">{stats.dropGoals}</span>
            </span>
            <span>
              <span className="text-zinc-500">Pts</span>{" "}
              <span className="font-mono text-emerald-400">{stats.points}</span>
            </span>
          </div>
          {careerStints.length > 0 ? (
            <table className="w-full text-xs mt-4">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-800">
                  <th className="py-1 pr-2">Source</th>
                  <th className="py-1 pr-2">Club pts</th>
                  <th className="py-1 pr-2">Cup pts</th>
                  <th className="py-1 pr-2">Intl pts</th>
                  <th className="py-1">Total pts</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-1 pr-2 text-zinc-400">CMS fixtures</td>
                  <td className="py-1 pr-2 font-mono">—</td>
                  <td className="py-1 pr-2 font-mono">—</td>
                  <td className="py-1 pr-2 font-mono">—</td>
                  <td className="py-1 font-mono text-emerald-400">{stats.points}</td>
                </tr>
                {(() => {
                  const wiki = wikipediaCareerTotals(careerStints);
                  const wikiTotal = wiki.club.points + wiki.cup.points + wiki.international.points;
                  const delta = stats.points - wikiTotal;
                  return (
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-1 pr-2 text-zinc-400">Wikipedia archive</td>
                      <td className="py-1 pr-2 font-mono">{wiki.club.points}</td>
                      <td className="py-1 pr-2 font-mono">{wiki.cup.points}</td>
                      <td className="py-1 pr-2 font-mono">{wiki.international.points}</td>
                      <td className="py-1 font-mono">
                        {wikiTotal}
                        {delta !== 0 ? (
                          <span className={delta > 0 ? "text-amber-400 ml-2" : "text-sky-400 ml-2"}>
                            ({delta > 0 ? "+" : ""}
                            {delta} vs CMS)
                          </span>
                        ) : (
                          <span className="text-emerald-500 ml-2">(matches CMS)</span>
                        )}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          ) : null}
        </div>
      )}

      <div className="cms-card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold m-0">Wikipedia archive</h3>
          <div className="flex flex-wrap items-center gap-2">
            {profile?.sourceStatus?.wikipediaSyncedAt ? (
              <span className="text-xs text-zinc-500">
                Last synced {new Date(profile.sourceStatus.wikipediaSyncedAt).toLocaleString()}
              </span>
            ) : null}
            <Link
              href={`/admin/wikipedia/import?link=${id}`}
              className="cms-btn cms-btn--secondary text-xs"
            >
              Manual import
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Paste the Wikipedia player article URL to import archive data and confirm identity (cross-check
          with RugbyPass). Example:{" "}
          <span className="text-zinc-400 font-mono text-xs">
            https://en.wikipedia.org/wiki/Antoine_Dupont
          </span>
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="cms-input flex-1"
            type="url"
            placeholder="https://en.wikipedia.org/wiki/Player_Name"
            value={wikipediaUrl}
            onChange={(e) => setWikipediaUrl(e.target.value)}
          />
          <button
            type="button"
            className="cms-btn cms-btn--secondary shrink-0"
            disabled={wikipediaImporting}
            onClick={() => void importFromWikipedia()}
          >
            {wikipediaImporting ? "Refreshing…" : "Refresh from Wikipedia"}
          </button>
        </div>
        {(wikipediaUrl.trim() || rugbypassUrl.trim()) && (
          <p className="text-xs text-zinc-500 mt-2 mb-0 flex flex-wrap gap-x-3 gap-y-1">
            {wikipediaUrl.trim() ? (
              <a
                href={wikipediaUrl.trim()}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Open Wikipedia
              </a>
            ) : null}
            {rugbypassUrl.trim() ? (
              <a
                href={rugbypassUrl.trim()}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Cross-ref RugbyPass
              </a>
            ) : null}
          </p>
        )}
        {wikipediaImportError ? (
          <p className="text-amber-400 text-sm mt-2 m-0">{wikipediaImportError}</p>
        ) : null}
        {archive &&
        (archive.archiveSyncedAt || archive.fullName || archive.birthDate || careerStints.length > 0) ? (
          <div className="text-sm space-y-2 mt-4 pt-3 border-t border-zinc-800">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 m-0">
              {archive.fullName ? (
                <>
                  <dt className="text-zinc-500">Full name</dt>
                  <dd className="m-0">{archive.fullName}</dd>
                </>
              ) : null}
              {archive.birthDate ? (
                <>
                  <dt className="text-zinc-500">Born</dt>
                  <dd className="m-0">
                    {archive.birthDate}
                    {archive.birthPlace ? ` · ${archive.birthPlace}` : ""}
                  </dd>
                </>
              ) : null}
              {archive.heightCm ? (
                <>
                  <dt className="text-zinc-500">Height</dt>
                  <dd className="m-0">{archive.heightCm} cm</dd>
                </>
              ) : null}
              {archive.weightKg ? (
                <>
                  <dt className="text-zinc-500">Weight</dt>
                  <dd className="m-0">{archive.weightKg} kg</dd>
                </>
              ) : null}
              {archive.school ? (
                <>
                  <dt className="text-zinc-500">School</dt>
                  <dd className="m-0">{archive.school}</dd>
                </>
              ) : null}
            </dl>
            {careerStints.length > 0 ? <WikipediaCareerTables rows={careerStints} /> : null}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mt-3 mb-0">
            No archive data yet. Paste a Wikipedia URL and refresh to add biography, physical stats and
            career tables — or use this field to mark players with missing wiki pages.
          </p>
        )}
      </div>

      {profileCategory === "club" ? (
        <>
          <PlayerPlanetRugbyImagesPanel
            playerId={id}
            playerName={values.name || values.fullName || "Player"}
            playerRating={null}
            playerPosition={values.positionName || null}
            currentImageUrl={values.imageUrl || null}
            onPrimaryChanged={(imageUrl) =>
              setValues((v) => ({ ...v, imageUrl: imageUrl ?? "" }))
            }
          />
          <PlayerImageLearningPanel />
        </>
      ) : null}

      <PlayerDataSection playerId={id} seasonRows={seasonStats} />

      {profileCategory === "club" ? (
      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">Club · identity snapshot</h3>
        <p className="text-sm text-zinc-500 mt-1 mb-3">
          Physical identity, badge cutout and education shown under the public Club tab.
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm m-0">
          <dt className="text-zinc-500">Squad number</dt>
          <dd className="m-0">{profile?.squadNumber ?? "—"}</dd>
          <dt className="text-zinc-500">Age</dt>
          <dd className="m-0">{profile?.age != null ? `${profile.age} years` : "—"}</dd>
          <dt className="text-zinc-500">Date of birth</dt>
          <dd className="m-0">{profile?.birthDate ?? "—"}</dd>
          <dt className="text-zinc-500">Position</dt>
          <dd className="m-0">{profile?.positionName ?? "—"}</dd>
          <dt className="text-zinc-500">Height</dt>
          <dd className="m-0">{profile?.heightCm ? `${profile.heightCm} cm` : "—"}</dd>
          <dt className="text-zinc-500">Weight</dt>
          <dd className="m-0">{profile?.weightKg ? `${profile.weightKg} kg` : "—"}</dd>
          <dt className="text-zinc-500">Nationality</dt>
          <dd className="m-0">{profile?.countryName ?? "—"}</dd>
          <dt className="text-zinc-500">Current club</dt>
          <dd className="m-0">{profile?.clubName ?? "—"}</dd>
          <dt className="text-zinc-500">School</dt>
          <dd className="m-0">{values.school || "—"}</dd>
          <dt className="text-zinc-500">University</dt>
          <dd className="m-0">{values.university || "—"}</dd>
          <dt className="text-zinc-500">Wikipedia</dt>
          <dd className="m-0">
            {profile?.externalLinks?.wikipedia ? (
              <a href={profile.externalLinks.wikipedia} target="_blank" rel="noreferrer" className="text-emerald-400">
                Source
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-zinc-500">RugbyPass</dt>
          <dd className="m-0">
            {profile?.externalLinks?.rugbypass ? (
              <a href={profile.externalLinks.rugbypass} target="_blank" rel="noreferrer" className="text-emerald-400">
                Source
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-zinc-500">Social</dt>
          <dd className="m-0 text-xs space-x-2">
            {profile?.socialAccounts?.twitter ? (
              <a href={profile.socialAccounts.twitter} target="_blank" rel="noreferrer" className="text-emerald-400">
                Twitter
              </a>
            ) : null}
            {profile?.socialAccounts?.instagram ? (
              <a href={profile.socialAccounts.instagram} target="_blank" rel="noreferrer" className="text-emerald-400">
                Instagram
              </a>
            ) : null}
            {profile?.socialAccounts?.website ? (
              <a href={profile.socialAccounts.website} target="_blank" rel="noreferrer" className="text-emerald-400">
                Website
              </a>
            ) : null}
            {!profile?.socialAccounts?.twitter &&
            !profile?.socialAccounts?.instagram &&
            !profile?.socialAccounts?.website
              ? "—"
              : null}
          </dd>
          <dt className="text-zinc-500">Source status</dt>
          <dd className="m-0 text-xs text-zinc-400">
            {profile?.sourceStatus?.rugbypassSyncedAt
              ? `RugbyPass synced ${new Date(profile.sourceStatus.rugbypassSyncedAt).toLocaleString()}`
              : "RugbyPass not synced"}
            {profile?.sourceStatus?.wikipediaSyncedAt
              ? ` · Wikipedia synced ${new Date(profile.sourceStatus.wikipediaSyncedAt).toLocaleString()}`
              : ""}
          </dd>
        </dl>
      </div>
      ) : null}

      {externalMatches.length > 0 ? (
        <div className="cms-card mb-4 overflow-x-auto">
          <h3 className="font-semibold m-0">Match data (RugbyPass)</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-3">
            Recent appearances imported from RugbyPass. Linked fixtures are matched by date and team names.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3">Opposition</th>
                <th className="py-2 pr-3">Competition</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Mins</th>
                <th className="py-2 pr-3">T</th>
                <th className="py-2 pr-3">Pts</th>
                <th className="py-2 pr-3">Fixture</th>
              </tr>
            </thead>
            <tbody>
              {externalMatches.map((row) => (
                <tr key={row.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3 whitespace-nowrap text-zinc-400">
                    {row.kickoffAt ? new Date(row.kickoffAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-3">{row.matchTitle ?? "—"}</td>
                  <td className="py-2 pr-3">{row.teamName ?? "—"}</td>
                  <td className="py-2 pr-3">{row.opponentName ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-500">{row.competitionName ?? "—"}</td>
                  <td className="py-2 pr-3 capitalize text-zinc-500">{row.squadRole ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono">{row.minutesPlayed}</td>
                  <td className="py-2 pr-3 font-mono">{stat(row.tries)}</td>
                  <td className="py-2 pr-3 font-mono">{stat(row.points)}</td>
                  <td className="py-2 pr-3 text-xs">
                    {row.fixtureId ? (
                      <span className="text-emerald-400">Linked</span>
                    ) : (
                      <span className="text-zinc-600">Unlinked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form onSubmit={submit} className="cms-card space-y-4 max-w-lg mb-4">
        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        <p className="text-xs text-zinc-500 m-0 uppercase tracking-wide">
          Editing ·{" "}
          {profileCategory === "club"
            ? "Club"
            : profileCategory === "international"
              ? "International"
              : "Scout"}
        </p>

        {/* Identity always available so Save keeps required fields in the form */}
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

        {profileCategory === "club" ? (
          <>
            <h4 className="text-sm font-semibold text-zinc-300 m-0">Identity</h4>
            <label className="block">
              <span className="text-sm text-zinc-400">Full name</span>
              <input
                className="cms-input w-full mt-1"
                value={values.fullName}
                onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Squad number</span>
              <input
                className="cms-input w-full mt-1"
                type="number"
                min={0}
                max={99}
                value={values.squadNumber}
                onChange={(e) => setValues((v) => ({ ...v, squadNumber: e.target.value }))}
                placeholder="e.g. 3"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Position</span>
              <input
                className="cms-input w-full mt-1"
                value={values.positionName}
                onChange={(e) => setValues((v) => ({ ...v, positionName: e.target.value }))}
                placeholder="fly-half"
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
              <span className="text-sm text-zinc-400">Birth place</span>
              <input
                className="cms-input w-full mt-1"
                value={values.birthPlace}
                onChange={(e) => setValues((v) => ({ ...v, birthPlace: e.target.value }))}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <span className="text-sm text-zinc-400">Weight (kg)</span>
                <input
                  type="number"
                  className="cms-input w-full mt-1"
                  value={values.weightKg}
                  onChange={(e) => setValues((v) => ({ ...v, weightKg: e.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-zinc-400">Preferred foot</span>
              <input
                className="cms-input w-full mt-1"
                value={values.preferredFoot}
                onChange={(e) => setValues((v) => ({ ...v, preferredFoot: e.target.value }))}
                placeholder="Left / Right / Either"
              />
            </label>

            <h4 className="text-sm font-semibold text-zinc-300 m-0 pt-2">School / University</h4>
            <label className="block">
              <span className="text-sm text-zinc-400">School</span>
              <input
                className="cms-input w-full mt-1"
                value={values.school}
                onChange={(e) => setValues((v) => ({ ...v, school: e.target.value }))}
                placeholder="e.g. Grey College"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">University</span>
              <input
                className="cms-input w-full mt-1"
                value={values.university}
                onChange={(e) => setValues((v) => ({ ...v, university: e.target.value }))}
                placeholder="e.g. University of Stellenbosch"
              />
            </label>

            <h4 className="text-sm font-semibold text-zinc-300 m-0 pt-2">Club</h4>
            <label className="block">
              <span className="text-sm text-zinc-400">Club team</span>
              <GroupedTeamSelect
                value={values.clubTeamId}
                onChange={(value) => setValues((v) => ({ ...v, clubTeamId: value }))}
                groups={clubTeamGroups}
                placeholder="None"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Club (display name)</span>
              <input
                className="cms-input w-full mt-1"
                value={values.clubName}
                onChange={(e) => setValues((v) => ({ ...v, clubName: e.target.value }))}
                placeholder="Ospreys"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Career status</span>
              <select
                className="cms-select w-full mt-1"
                value={values.careerStatus}
                onChange={(e) =>
                  setValues((v) => ({ ...v, careerStatus: e.target.value as PlayerCareerStatus }))
                }
              >
                {PLAYER_CAREER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {careerStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Twitter / X</span>
              <input
                className="cms-input w-full mt-1"
                value={values.socialTwitter}
                onChange={(e) => setValues((v) => ({ ...v, socialTwitter: e.target.value }))}
                placeholder="https://x.com/…"
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
              <span className="text-sm text-zinc-400">Facebook</span>
              <input
                className="cms-input w-full mt-1"
                value={values.socialFacebook}
                onChange={(e) => setValues((v) => ({ ...v, socialFacebook: e.target.value }))}
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
            <label className="block">
              <span className="text-sm text-zinc-400">Sport365 player ID</span>
              <input
                className="cms-input w-full mt-1"
                value={values.externalProviderId}
                onChange={(e) => setValues((v) => ({ ...v, externalProviderId: e.target.value }))}
              />
            </label>
          </>
        ) : null}

        {profileCategory === "international" ? (
          <>
            <label className="block">
              <span className="text-sm text-zinc-400">International team</span>
              <GroupedTeamSelect
                value={values.internationalTeamId}
                onChange={(value) => setValues((v) => ({ ...v, internationalTeamId: value }))}
                groups={internationalTeamGroups}
                placeholder="None"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Country</span>
              <input
                className="cms-input w-full mt-1"
                value={values.countryName}
                onChange={(e) => setValues((v) => ({ ...v, countryName: e.target.value }))}
                placeholder="Wales"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Nation code</span>
              <input
                className="cms-input w-full mt-1 uppercase"
                value={values.nationCode}
                onChange={(e) =>
                  setValues((v) => ({ ...v, nationCode: e.target.value.toUpperCase() }))
                }
                placeholder="WAL"
                maxLength={3}
              />
            </label>
          </>
        ) : null}

        {profileCategory === "scout" || profileCategory === "club" ? (
          <div className="col-span-full border-t border-white/10 pt-4 mt-2">
            <h3 className="font-semibold m-0 mb-3">
              {profileCategory === "scout" ? "Scout · publish" : "Club · publish"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-zinc-400">Publish status</span>
                <select
                  className="cms-select w-full mt-1"
                  value={values.publishStatus}
                  onChange={(e) => setValues((v) => ({ ...v, publishStatus: e.target.value }))}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={values.isPublic}
                  onChange={(e) => setValues((v) => ({ ...v, isPublic: e.target.checked }))}
                />
                <span className="text-sm text-zinc-300">Visible on public site</span>
              </label>
              {profileCategory === "scout" ? (
                <label className="block">
                  <span className="text-sm text-zinc-400">Career status</span>
                  <select
                    className="cms-select w-full mt-1"
                    value={values.careerStatus}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        careerStatus: e.target.value as PlayerCareerStatus,
                      }))
                    }
                  >
                    {PLAYER_CAREER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {careerStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block sm:col-span-2">
                <span className="text-sm text-zinc-400">SEO title</span>
                <input
                  className="cms-input w-full mt-1"
                  value={values.seoTitle}
                  onChange={(e) => setValues((v) => ({ ...v, seoTitle: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-zinc-400">SEO description</span>
                <textarea
                  className="cms-input w-full mt-1 min-h-[4rem]"
                  value={values.seoDescription}
                  onChange={(e) => setValues((v) => ({ ...v, seoDescription: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-zinc-400">Public introduction override</span>
                <textarea
                  className="cms-input w-full mt-1 min-h-[5rem]"
                  value={values.publicIntroOverride}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, publicIntroOverride: e.target.value }))
                  }
                  placeholder="Leave blank to use the structured intro generated from profile data."
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="cms-btn cms-btn--primary">
            {saving ? "Saving…" : "Save"}
          </button>
          {values.slug ? (
            <Link
              href={`/players/${values.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="cms-btn cms-btn--secondary"
            >
              Preview public profile
            </Link>
          ) : null}
          <Link href="/admin/players" className="cms-btn cms-btn--secondary">
            Back
          </Link>
          <Link href="/admin/transfers" className="cms-btn cms-btn--secondary">
            Transfers
          </Link>
          <button type="button" onClick={remove} className="cms-btn cms-btn--secondary text-red-400">
            Delete
          </button>
        </div>
      </form>

      <div className="cms-card max-w-lg mb-4">
        <h3 className="font-semibold m-0">Record transfer</h3>
        <p className="text-sm text-zinc-500 mt-1 mb-3">
          Move this player to another club or international team.
        </p>
        <form onSubmit={addTransfer} className="space-y-3">
          <select
            className="cms-select w-full"
            value={transferForm.transferType}
            onChange={(e) =>
              setTransferForm((f) => ({
                ...f,
                transferType: e.target.value as "club" | "international",
              }))
            }
          >
            <option value="club">Club transfer</option>
            <option value="international">International</option>
          </select>
          <GroupedTeamSelect
            value={transferForm.fromTeamId}
            onChange={(value) => setTransferForm((f) => ({ ...f, fromTeamId: value }))}
            groups={teamGroups}
            placeholder="From team (auto if blank)"
            className="cms-select w-full"
          />
          <GroupedTeamSelect
            required
            value={transferForm.toTeamId}
            onChange={(value) => setTransferForm((f) => ({ ...f, toTeamId: value }))}
            groups={teamGroups}
            placeholder="To team…"
            className="cms-select w-full"
          />
          <input
            className="cms-input w-full"
            placeholder="Notes"
            value={transferForm.notes}
            onChange={(e) => setTransferForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <button type="submit" className="cms-btn cms-btn--secondary text-sm">
            Add transfer
          </button>
        </form>
        {transfers.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            {transfers.map((t) => (
              <li key={t.id}>
                <span className="capitalize text-zinc-600">{t.transferType}</span>:{" "}
                {t.fromClub ?? "?"} → {t.toClub ?? "?"}
                {t.effectiveDate ? ` (${new Date(t.effectiveDate).toLocaleDateString()})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <PlayerTransferConflictWarning transfers={transfers} />

      {(careerTimeline.length > 0 || transfers.length > 0) && (
        <div className="cms-card mb-4 overflow-x-auto">
          <h3 className="font-semibold m-0">Career timeline</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-3">
            Complete movement history — transfers, loans, releases, academy promotions and retirements.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Movement</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Season</th>
                <th className="py-2 pr-3">Competition</th>
                <th className="py-2 pr-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(careerTimeline.length > 0 ? careerTimeline : transfers).map((t) => (
                <tr key={t.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                    {t.effectiveDate ? new Date(t.effectiveDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {"movementType" in t ? movementTypeLabel(t.movementType) : t.transferType}
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">{t.fromClub ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-300">{t.toClub ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {"seasonLabel" in t ? (t.seasonLabel ?? "—") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {"competitionName" in t ? (t.competitionName ?? "—") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 text-xs">{t.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlayerMatchRatingsPanel
        playerId={id}
        playerSlug={values.slug || null}
        playerName={values.name || null}
      />
      <PlayerDevelopmentChartCmsPanel playerId={id} playerSlug={values.slug || null} />
      <PlayerRadarCmsPanel playerId={id} playerSlug={values.slug || null} />

      <PlayerLegendSection
        playerId={id}
        legends={legends}
        onUpdated={() => {
          fetch(`/api/admin/players/${id}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setLegends(d.legends ?? []))
            .catch(() => undefined);
        }}
      />

      {squads.length > 0 && (
        <div className="cms-card mb-4 overflow-x-auto">
          <h3 className="font-semibold m-0">Fixtures & squads</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Match appearances with per-fixture scoring and match ratings (1–10), grouped by
            competition season. Unused / zero-minute selections show as DNP.
          </p>
          <div className="space-y-6">
            {squadGroups.map((group) => (
              <section key={group.key}>
                <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">
                  {group.competitionName ? (
                    <>
                      {group.competitionName}
                      <span className="text-zinc-500 font-normal"> · {group.seasonLabel}</span>
                    </>
                  ) : (
                    group.seasonLabel
                  )}
                  <span className="text-zinc-600 font-normal ml-2">({group.items.length})</span>
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 pr-3">Fixture</th>
                      <th className="py-2 pr-3">Team</th>
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2 text-center">T</th>
                      <th className="py-2 pr-2 text-center">C</th>
                      <th className="py-2 pr-2 text-center">P</th>
                      <th className="py-2 pr-2 text-center">Pts</th>
                      <th className="py-2 pr-2 text-center">Rating</th>
                      <th className="py-2 pr-3">Result</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((s) => (
                      <tr
                        key={s.id}
                        className={`border-b border-zinc-800/60 ${s.points > 0 ? "bg-amber-950/20" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <span className="text-zinc-200">{s.fixtureSlug}</span>
                          {s.kickoffAt && (
                            <span className="block text-xs text-zinc-600">
                              {new Date(s.kickoffAt).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-zinc-400">
                          {s.teamName}
                          {s.positionName && (
                            <span className="block text-xs text-zinc-600">{s.positionName}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 font-mono">{s.jerseyNumber ?? "—"}</td>
                        <td className="py-2 pr-2 text-center font-mono">{stat(s.tries)}</td>
                        <td className="py-2 pr-2 text-center font-mono">{stat(s.conversions)}</td>
                        <td className="py-2 pr-2 text-center font-mono">{stat(s.penalties)}</td>
                        <td className="py-2 pr-2 text-center font-mono">{s.points > 0 ? s.points : "—"}</td>
                        <td
                          className={`py-2 pr-2 text-center font-mono ${
                            s.matchRating != null ? "text-emerald-400" : "text-zinc-500"
                          }`}
                          title={
                            s.matchRating != null
                              ? `Match rating ${s.matchRating.toFixed(1)}`
                              : "Did not play / unrated"
                          }
                        >
                          {s.matchRating != null
                            ? s.matchRating.toFixed(1)
                            : s.matchMinutes === 0 ||
                                (s.squadRole ?? "").toLowerCase().includes("bench")
                              ? "DNP"
                              : "—"}
                        </td>
                        <td className="py-2 pr-3 font-mono text-zinc-400">
                          {s.scoreline}
                          <span className="block text-xs text-zinc-600 font-sans">
                            vs {s.opponentName ?? "—"}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <Link href={`/admin/squads/${s.fixtureId}`} className="text-emerald-400 text-xs mr-2">
                            Squad
                          </Link>
                          <Link href={`/matches/${s.fixtureSlug}/commentary`} className="text-zinc-400 text-xs">
                            Commentary
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="cms-card overflow-x-auto">
          <h3 className="font-semibold m-0">Match events</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Tries, kicks and cards linked to this player, grouped by competition season.
          </p>
          <div className="space-y-6">
            {eventGroups.map((group) => (
              <section key={group.key}>
                <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">
                  {group.competitionName ? (
                    <>
                      {group.competitionName}
                      <span className="text-zinc-500 font-normal"> · {group.seasonLabel}</span>
                    </>
                  ) : (
                    group.seasonLabel
                  )}
                  <span className="text-zinc-600 font-normal ml-2">({group.items.length})</span>
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 pr-3">Fixture</th>
                      <th className="py-2 pr-3">Min</th>
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((e) => (
                      <tr key={e.id} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-3">
                          <Link href={`/matches/${e.fixtureSlug}/commentary`} className="text-emerald-400">
                            {e.fixtureSlug}
                          </Link>
                          {e.kickoffAt ? (
                            <span className="block text-xs text-zinc-600">
                              {new Date(e.kickoffAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 font-mono">{e.minute}&apos;</td>
                        <td className="py-2 pr-3 text-zinc-300">
                          {e.eventType.replace(/_/g, " ")}
                          {e.teamName && <span className="text-zinc-600"> · {e.teamName}</span>}
                        </td>
                        <td className="py-2 pr-3 font-mono text-zinc-400">
                          {e.homeScore}–{e.awayScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>
      )}

      {squads.length === 0 && events.length === 0 && (
        <div className="cms-card">
          <p className="text-sm text-zinc-500 m-0">
            No fixtures linked yet. Map from matches on the Players list or sync Sport365 squads.
          </p>
        </div>
      )}
    </>
  );
}
