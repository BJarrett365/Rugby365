import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { PlayerIntelligenceBadges } from "@/components/players/PlayerIntelligenceBadges";
import { SouthAfricaShirtIcon } from "@/components/shirts/SouthAfricaShirtIcon";
import {
  IconClub,
  IconCompetition,
  IconContract,
  IconClock,
  IconFoot,
  IconGlobe,
  IconHeight,
  IconPositions,
  IconSquad,
  IconWeight,
} from "@/components/players/PlayerFactIcons";

const NATION_FLAGS: Record<string, string> = {
  "south africa": "🇿🇦",
  "new zealand": "🇳🇿",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  ireland: "🇮🇪",
  wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  france: "🇫🇷",
  australia: "🇦🇺",
  argentina: "🇦🇷",
  italy: "🇮🇹",
  japan: "🇯🇵",
  fiji: "🇫🇯",
  samoa: "🇼🇸",
  tonga: "🇹🇴",
  georgia: "🇬🇪",
  usa: "🇺🇸",
  "united states": "🇺🇸",
  canada: "🇨🇦",
};

const INTL_NICKNAMES: Record<string, string> = {
  "south africa": "Springboks",
  "new zealand": "All Blacks",
  australia: "Wallabies",
  argentina: "Los Pumas",
  ireland: "Ireland",
  england: "England",
  wales: "Wales",
  scotland: "Scotland",
  france: "France",
  italy: "Italy",
  japan: "Brave Blossoms",
  fiji: "Flying Fijians",
};

function flagFor(nationName: string | null): string | null {
  if (!nationName) return null;
  return NATION_FLAGS[nationName.trim().toLowerCase()] ?? null;
}

function formatDob(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Split display name into presentation lines — uppercase is CSS only. */
function nameLines(displayName: string): { line1: string; line2: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { line1: displayName, line2: "" };
  if (parts.length === 2) return { line1: parts[0]!, line2: parts[1]! };
  return { line1: parts.slice(0, -1).join(" "), line2: parts[parts.length - 1]! };
}

/**
 * Prefer proper nicknames (Springboks) over terse CMS short codes ("SA").
 * Not player-specific — keyed by nation/team name.
 */
function intlNickname(team: {
  name: string;
  shortName?: string | null;
} | null): string | null {
  if (!team) return null;
  const byName = INTL_NICKNAMES[team.name.trim().toLowerCase()];
  if (byName) return byName;
  const short = team.shortName?.trim();
  if (short && short.length > 3) return short;
  return team.name;
}

function FactValue({ children }: { children: ReactNode }) {
  const empty =
    children == null ||
    children === "" ||
    children === "—" ||
    (Array.isArray(children) && children.every((c) => c == null || c === "" || c === "—"));
  return <span className={empty ? "pr-pih__muted" : undefined}>{children ?? "—"}</span>;
}

function FactRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="pr-pih__fact">
      <span className="pr-pih__fact-icon" aria-hidden>
        {icon}
      </span>
      <dt>{label}</dt>
      <dd>
        <FactValue>{children}</FactValue>
      </dd>
    </div>
  );
}

export type PlayerIdentityHeroProps = {
  overview: PublicPlayerOverviewV2;
  /** Page context — club (default) vs international squad number preference. */
  context?: "club" | "international";
};

/**
 * Rugby365 Player Identity lead — target two-zone card (photo + facts).
 * Coach-parity polish; reusable for every player; never hardcodes player data.
 */
export function PlayerIdentityHero({
  overview,
  context = "club",
}: PlayerIdentityHeroProps) {
  const flag = flagFor(overview.nationName);
  const names = nameLines(overview.displayName);
  const intlLabel = intlNickname(overview.internationalTeam);
  const isSpringboks = intlLabel?.trim().toLowerCase() === "springboks";
  const ovr = overview.intelligence.overall ?? overview.rating.current;
  const squadNumber = overview.base.squadNumber;
  const positions = [overview.positionName, ...overview.otherPositions]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  const clubLabel = overview.club?.name ?? "—";
  const contractLabel =
    overview.contract.termLabel ?? overview.contract.expiresLabel ?? "—";

  const ratingTitle = [
    "Rugby365 Player Rating",
    ovr != null ? `${ovr} / 100` : "—",
    overview.intelligence.modelVersion
      ? `Model: ${overview.intelligence.modelVersion}`
      : null,
    overview.intelligence.coverage != null
      ? `Coverage: ${overview.intelligence.coverage}%`
      : null,
    overview.ratingState ? `Status: ${overview.ratingState}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const showProvisionalHint =
    overview.ratingState === "PROVISIONAL" ||
    overview.ratingState === "PARTIAL" ||
    overview.ratingState === "LOW_CONFIDENCE";

  return (
    <section className="pr-pih" aria-label={`${overview.displayName} identity`}>
      {/* LEFT — photo-dominant identity */}
      <div className="pr-pih__visual">
        {/* Full-bleed backdrop — all identity text overlays this layer */}
        <div className="pr-pih__photo" aria-hidden={!!overview.imageUrl}>
          {overview.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={overview.imageUrl} alt="" />
          ) : (
            <span className="pr-pih__silhouette">{overview.displayName.slice(0, 1)}</span>
          )}
        </div>
        <div className="pr-pih__vignette" aria-hidden />

        <div className="pr-pih__overlays">
          <div className="pr-pih__ovr" title={ratingTitle}>
            <strong>{ovr != null ? (Number.isInteger(ovr) ? ovr : ovr.toFixed(1)) : "—"}</strong>
            {overview.positionName ? (
              <span className="pr-pih__position">{overview.positionName}</span>
            ) : null}
            {showProvisionalHint ? (
              <span className="pr-pih__ovr-hint" aria-label={`Rating ${overview.ratingState}`}>
                *
              </span>
            ) : null}
          </div>
        </div>

        {/* Affiliations sit above the name in document order so mobile can stack
            without colliding; desktop CSS still parks them in the upper overlay zone. */}
        <div className="pr-pih__affiliations">
          {overview.nationName ? (
            <div className="pr-pih__aff">
              <span className="pr-pih__aff-icon-row" aria-hidden>
                <span className="pr-pih__aff-flag">{flag ?? "🏳️"}</span>
              </span>
              <span className="pr-pih__aff-text">{overview.nationName}</span>
            </div>
          ) : null}
          {overview.internationalTeam ? (
            <div className="pr-pih__aff">
              <span className="pr-pih__aff-icon-row" aria-hidden>
                {isSpringboks ? (
                  <SouthAfricaShirtIcon className="pr-pih__intl-shirt" />
                ) : overview.internationalTeam.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={overview.internationalTeam.imageUrl} alt="" className="pr-pih__crest" />
                ) : (
                  <span className="pr-pih__crest-fallback" aria-hidden>
                    ◆
                  </span>
                )}
              </span>
              <span className="pr-pih__aff-text">{intlLabel}</span>
              {squadNumber != null ? (
                <span className="pr-pih__squad-number" aria-label={`Jersey number ${squadNumber}`}>
                  {squadNumber}
                </span>
              ) : null}
            </div>
          ) : null}
          {context === "club" && squadNumber != null && !overview.internationalTeam ? (
            <div className="pr-pih__aff pr-pih__aff--shirt" aria-label={`Squad number ${squadNumber}`}>
              <span className="pr-pih__shirt" aria-hidden>
                {squadNumber}
              </span>
            </div>
          ) : null}
        </div>

        <div className="pr-pih__footer">
          <h1 className="pr-pih__name">
            <span className="pr-pih__name-first">{names.line1}</span>
            {names.line2 ? <span className="pr-pih__name-last">{names.line2}</span> : null}
          </h1>
          <PlayerIntelligenceBadges badges={overview.badges} />
        </div>
      </div>

      {/* RIGHT — facts */}
      <div className="pr-pih__facts">
        <dl>
          <FactRow icon={<IconGlobe />} label="Nationality">
            {overview.nationName ? (
              <>
                {flag ? (
                  <span className="pr-pih__flag" aria-hidden>
                    {flag}
                  </span>
                ) : null}
                {overview.nationName}
              </>
            ) : (
              "—"
            )}
          </FactRow>
          <FactRow icon={<IconClock />} label="Age">
            {overview.age != null
              ? `${overview.age}${overview.birthDate ? ` (${formatDob(overview.birthDate)})` : ""}`
              : "—"}
          </FactRow>
          <FactRow icon={<IconHeight />} label="Height">
            {overview.heightCm != null ? `${overview.heightCm} cm` : "—"}
          </FactRow>
          <FactRow icon={<IconWeight />} label="Weight">
            {overview.weightKg != null ? `${overview.weightKg} kg` : "—"}
          </FactRow>
          <FactRow icon={<IconFoot />} label="Preferred Foot">
            {overview.preferredFoot ?? "—"}
          </FactRow>
          <FactRow icon={<IconClub />} label="Club">
            {overview.club ? (
              <>
                {overview.club.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={overview.club.imageUrl} alt="" className="pr-pih__mini-crest" />
                ) : null}
                <span title={!overview.clubVerified ? "Current club needs verification" : undefined}>
                  {clubLabel}
                </span>
              </>
            ) : (
              "—"
            )}
          </FactRow>
          <FactRow icon={<IconCompetition />} label="Competition">
            {overview.competitionName ?? "—"}
          </FactRow>
          <FactRow icon={<IconContract />} label="Contract">
            {contractLabel}
          </FactRow>
          <FactRow icon={<IconSquad />} label="Squad Number">
            {squadNumber != null ? String(squadNumber) : "—"}
          </FactRow>
          <FactRow icon={<IconPositions />} label="Position(s)">
            {positions || "—"}
          </FactRow>
        </dl>
        <Link className="pr-pih__full-link" href={`/players/${overview.slug}/career`}>
          View full profile &gt;
        </Link>
      </div>
    </section>
  );
}
