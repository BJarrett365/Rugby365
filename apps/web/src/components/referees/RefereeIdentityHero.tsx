import Link from "next/link";
import type { ReactNode } from "react";
import { PlayerIntelligenceBadges } from "@/components/players/PlayerIntelligenceBadges";
import {
  IconClub,
  IconCompetition,
  IconContract,
  IconClock,
  IconGlobe,
  IconPositions,
  IconSquad,
} from "@/components/players/PlayerFactIcons";
import type { RefereeDashboardModel } from "@/lib/referee-dashboard-types";
import type { PlayerProfileBadge } from "@/lib/player-badge-engine";

const NATION_FLAGS: Record<string, string> = {
  ireland: "🇮🇪",
  "south africa": "🇿🇦",
  "new zealand": "🇳🇿",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  france: "🇫🇷",
  australia: "🇦🇺",
  argentina: "🇦🇷",
  italy: "🇮🇹",
  belgium: "🇧🇪",
};

function flagFor(nationName: string | null): string | null {
  if (!nationName) return null;
  return NATION_FLAGS[nationName.trim().toLowerCase()] ?? null;
}

function nameLines(displayName: string): { line1: string; line2: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { line1: displayName, line2: "" };
  if (parts.length === 2) return { line1: parts[0]!, line2: parts[1]! };
  return { line1: parts.slice(0, -1).join(" "), line2: parts[parts.length - 1]! };
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

export function refereeIdentityBadges(model: RefereeDashboardModel): PlayerProfileBadge[] {
  const badges: PlayerProfileBadge[] = [
    { key: "international_star", label: model.roleBadge, tone: "gold" },
  ];
  if (model.overallRating >= 80) {
    badges.push({ key: "game_manager", label: "Game Manager", tone: "blue" });
  }
  if (model.formLast10.filter((r) => r === "positive").length >= 7) {
    badges.push({ key: "in_form", label: "In Form", tone: "green" });
  }
  return badges.slice(0, 3);
}

export function RefereeIdentityHero({ model }: { model: RefereeDashboardModel }) {
  const flag = flagFor(model.countryName);
  const names = nameLines(model.name);
  const ovr = model.overallRating;
  const badges = refereeIdentityBadges(model);

  return (
    <section className="pr-pih" aria-label={`${model.name} identity`}>
      <div className="pr-pih__visual">
        <div className="pr-pih__photo" aria-hidden={!!model.portraitUrl}>
          {model.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.portraitUrl} alt="" decoding="async" fetchPriority="high" />
          ) : (
            <span className="pr-pih__silhouette">{model.name.slice(0, 1)}</span>
          )}
        </div>
        <div className="pr-pih__vignette" aria-hidden />

        <div className="pr-pih__overlays">
          <div className="pr-pih__ovr" title="Referee overall rating / 100">
            <strong>{ovr > 0 ? ovr.toFixed(1) : "—"}</strong>
            <span className="pr-pih__position">{model.bio.preferredRole}</span>
          </div>
        </div>

        <div className="pr-pih__affiliations">
          {model.countryName ? (
            <div className="pr-pih__aff">
              <span className="pr-pih__aff-icon-row" aria-hidden>
                <span className="pr-pih__aff-flag">{flag ?? "🏳️"}</span>
              </span>
              <span className="pr-pih__aff-text">{model.countryName}</span>
            </div>
          ) : null}
          <div className="pr-pih__aff">
            <span className="pr-pih__aff-icon-row" aria-hidden>
              <span className="pr-pih__crest-fallback" aria-hidden>
                ◆
              </span>
            </span>
            <span className="pr-pih__aff-text">{model.bio.union}</span>
          </div>
        </div>

        <div className="pr-pih__footer">
          <h1 className="pr-pih__name">
            <span className="pr-pih__name-first">{names.line1}</span>
            {names.line2 ? <span className="pr-pih__name-last">{names.line2}</span> : null}
          </h1>
          <PlayerIntelligenceBadges badges={badges} />
        </div>
      </div>

      <div className="pr-pih__facts">
        <dl>
          <FactRow icon={<IconGlobe />} label="Nationality">
            {model.bio.nationality ? (
              <>
                {flag ? (
                  <span className="pr-pih__flag" aria-hidden>
                    {flag}
                  </span>
                ) : null}
                {model.bio.nationality}
              </>
            ) : (
              "—"
            )}
          </FactRow>
          <FactRow icon={<IconClock />} label="Date of birth">
            {model.bio.dateOfBirth}
          </FactRow>
          <FactRow icon={<IconCompetition />} label="World Rugby debut">
            {model.bio.worldRugbyDebut}
          </FactRow>
          <FactRow icon={<IconPositions />} label="Referee style">
            {model.bio.refereeStyle}
          </FactRow>
          <FactRow icon={<IconSquad />} label="Preferred position">
            {model.bio.preferredRole}
          </FactRow>
          <FactRow icon={<IconClub />} label="Union">
            {model.bio.union}
          </FactRow>
          <FactRow icon={<IconContract />} label="Profession">
            {model.bio.profession}
          </FactRow>
          <FactRow icon={<IconCompetition />} label="Panel">
            {model.roleBadge}
          </FactRow>
          <FactRow icon={<IconSquad />} label="Career matches">
            {String(model.totalMatches)}
          </FactRow>
        </dl>
        <Link className="pr-pih__full-link" href={`/referees/${model.slug}/career`}>
          View full profile &gt;
        </Link>
      </div>
    </section>
  );
}
