"use client";

import { useState } from "react";
import { PlayerBadge } from "@/components/players/PlayerBadge";
import type { PublicPlayerProfile } from "@/lib/public-player-profile-service";

type InfoCategory = "club" | "international" | "scout";

const CATEGORIES: Array<{ id: InfoCategory; label: string }> = [
  { id: "club", label: "Club" },
  { id: "international", label: "International" },
  { id: "scout", label: "Scout" },
];

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="pr-player-fact">
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Player profile information — three tabs: Club | International | Scout.
 */
export function PlayerProfileInformation({ profile }: { profile: PublicPlayerProfile }) {
  const defaultCategory: InfoCategory =
    profile.view === "international"
      ? "international"
      : profile.view === "scouting"
        ? "scout"
        : "club";
  const [category, setCategory] = useState<InfoCategory>(defaultCategory);

  const salary =
    profile.contract.reportedSalaryLabel
      ? `${profile.contract.reportedSalaryLabel}/yr (reported)`
      : profile.playerValue?.contractValueLabel
        ? `${profile.playerValue.contractValueLabel}/yr (estimate)`
        : null;

  const agent = profile.agent
    ? [profile.agent.name, profile.agent.agency].filter(Boolean).join(" · ")
    : null;

  const intlCaps =
    profile.internationalSummary.caps != null
      ? String(profile.internationalSummary.caps)
      : null;
  const intlTries =
    profile.internationalSummary.tries != null
      ? String(profile.internationalSummary.tries)
      : null;
  const intlPoints =
    profile.internationalSummary.points != null
      ? String(profile.internationalSummary.points)
      : null;

  return (
    <div className="pr-player-card pr-player-card--wide pr-player-profile-info">
      <div className="pr-player-profile-info__head">
        <h3>Player information</h3>
        <nav className="pr-player-info-cats" aria-label="Profile information categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`pr-player-info-cats__item${category === c.id ? " is-active" : ""}`}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </div>

      {category === "club" ? (
        <div className="pr-player-info-panel">
          <div className="pr-player-face-profile__body">
            <PlayerBadge
              name={profile.name}
              imageUrl={profile.badgeImageUrl ?? profile.imageUrl}
              cutout={Boolean(profile.badgeImageUrl)}
              rating={profile.rating.current}
              positionName={profile.positionName}
              nationName={profile.nationName}
              clubName={profile.club?.name}
              age={profile.age}
              marketValueLabel={profile.playerValue?.marketValueLabel}
              worldRank={profile.rankings?.overallRank ?? null}
              size="md"
            />
            <div className="pr-player-info-panel__cols">
              <div>
                <h4 className="pr-player-info-panel__sub">Identity</h4>
                <dl className="pr-player-info-list">
                  <Fact label="Full name" value={profile.fullName ?? profile.name} />
                  <Fact label="Known as" value={profile.name} />
                  <Fact label="Date of birth" value={formatDate(profile.birthDate)} />
                  <Fact label="Place of birth" value={profile.birthPlace} />
                  <Fact label="Age" value={profile.age != null ? `${profile.age}` : null} />
                  <Fact
                    label="Height"
                    value={profile.heightCm != null ? `${profile.heightCm} cm` : null}
                  />
                  <Fact
                    label="Weight"
                    value={profile.weightKg != null ? `${profile.weightKg} kg` : null}
                  />
                  <Fact label="Preferred foot" value={profile.preferredFoot} />
                  <Fact label="Main position" value={profile.positionName} />
                  <Fact
                    label="Other positions"
                    value={
                      profile.otherPositions.length
                        ? profile.otherPositions.join(", ")
                        : null
                    }
                  />
                  <Fact
                    label="Squad number"
                    value={
                      profile.squadNumber != null ? String(profile.squadNumber) : null
                    }
                  />
                </dl>
              </div>
              <div>
                <h4 className="pr-player-info-panel__sub">Club</h4>
                <dl className="pr-player-info-list">
                  <Fact label="Current club" value={profile.club?.name} />
                  <Fact label="Current competition" value={profile.competitionName} />
                  <Fact
                    label="Club debut"
                    value={profile.clubDebutOn ? formatDate(profile.clubDebutOn) : null}
                  />
                  <Fact label="Contract expires" value={profile.contract.expiresLabel} />
                  <Fact label="Salary" value={salary} />
                  <Fact label="Agent" value={agent} />
                  <Fact label="Career status" value={profile.careerStatus} />
                  <Fact label="Playing style" value={profile.playingStyle} />
                </dl>
              </div>
              <div>
                <h4 className="pr-player-info-panel__sub">School / University</h4>
                <dl className="pr-player-info-list">
                  <Fact label="School" value={profile.school} />
                  <Fact label="University" value={profile.university} />
                </dl>
              </div>
            </div>
          </div>
          {profile.biography?.currentSeasonSummary || profile.biography?.careerSummary ? (
            <div className="pr-player-info-panel__notes">
              {profile.biography.currentSeasonSummary ? (
                <p>
                  <strong>Season</strong> — {profile.biography.currentSeasonSummary}
                </p>
              ) : null}
              {profile.biography.careerSummary ? (
                <p>
                  <strong>Career</strong> — {profile.biography.careerSummary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {category === "international" ? (
        <div className="pr-player-info-panel">
          <h4 className="pr-player-info-panel__sub">International</h4>
          <dl className="pr-player-info-list">
            <Fact label="Nationality" value={profile.nationName} />
            <Fact label="International team" value={profile.internationalTeam?.name} />
            <Fact label="Caps" value={intlCaps} />
            <Fact label="Tries" value={intlTries} />
            <Fact label="Points" value={intlPoints} />
            <Fact
              label="Competitions"
              value={
                profile.internationalSummary.competitions.length
                  ? profile.internationalSummary.competitions.join(", ")
                  : null
              }
            />
            <Fact label="Place of birth" value={profile.birthPlace} />
            <Fact label="School" value={profile.school} />
            <Fact label="University" value={profile.university} />
          </dl>
          {profile.biography?.internationalSummary || profile.biography?.careerSummary ? (
            <div className="pr-player-info-panel__notes">
              {profile.biography.internationalSummary ? (
                <p>
                  <strong>International</strong> — {profile.biography.internationalSummary}
                </p>
              ) : null}
              {profile.biography.careerSummary ? (
                <p>
                  <strong>Career</strong> — {profile.biography.careerSummary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {category === "scout" ? (
        <div className="pr-player-info-panel">
          <h4 className="pr-player-info-panel__sub">Scout</h4>
          <dl className="pr-player-info-list">
            <Fact label="Career status" value={profile.careerStatus} />
            <Fact label="Main position" value={profile.positionName} />
            <Fact
              label="Other positions"
              value={
                profile.otherPositions.length ? profile.otherPositions.join(", ") : null
              }
            />
            <Fact label="Playing style" value={profile.playingStyle} />
            <Fact label="Strengths" value={profile.biography?.strengths ?? null} />
            <Fact
              label="Areas to improve"
              value={profile.biography?.areasToImprove ?? null}
            />
            <Fact
              label="Rugby365 rating"
              value={
                profile.rating.current != null ? String(profile.rating.current) : null
              }
            />
            <Fact
              label="Market value"
              value={profile.playerValue?.marketValueLabel ?? null}
            />
            <Fact label="School" value={profile.school} />
            <Fact label="University" value={profile.university} />
            <Fact
              label="Age"
              value={
                profile.age != null
                  ? `${profile.age}${profile.birthDate ? ` (${formatDate(profile.birthDate)})` : ""}`
                  : formatDate(profile.birthDate)
              }
            />
            <Fact
              label="Height / weight"
              value={
                profile.heightCm != null || profile.weightKg != null
                  ? [
                      profile.heightCm != null ? `${profile.heightCm} cm` : null,
                      profile.weightKg != null ? `${profile.weightKg} kg` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : null
              }
            />
          </dl>
          {profile.biography?.scoutingSummary || profile.biography?.ratingExplanation ? (
            <div className="pr-player-info-panel__notes">
              {profile.biography.scoutingSummary ? (
                <p>
                  <strong>Scouting</strong> — {profile.biography.scoutingSummary}
                </p>
              ) : null}
              {profile.biography.ratingExplanation ? (
                <p>
                  <strong>Rating</strong> — {profile.biography.ratingExplanation}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
