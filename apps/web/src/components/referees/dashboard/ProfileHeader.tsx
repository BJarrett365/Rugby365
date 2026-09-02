import type { ReactNode } from "react";
import { RatingBadge } from "./RatingBadge";
import { StatCard } from "./StatCard";
import type { RefereeDashboardModel } from "@/lib/referee-dashboard-types";

function BioRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="rdash-bio__row">
      <span className="rdash-bio__icon" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="rdash-bio__label">{label}</span>
        <span className="rdash-bio__value">{value}</span>
      </span>
    </li>
  );
}

const ICONS = {
  flag: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M5 3h2v18H5zm3 1 10 4.5L8 13V4z" />
    </svg>
  ),
  cake: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path
        fill="currentColor"
        d="M12 2c.8 0 1.5.7 1.5 1.5S12.8 5 12 5s-1.5-.7-1.5-1.5S11.2 2 12 2zm-7 9h14v10H5V11zm2 2v6h10v-6H7z"
      />
    </svg>
  ),
  whistle: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M9 8h8a4 4 0 1 1-3.5 6H9a4 4 0 1 1 0-8zm0 2a2 2 0 1 0 0 4h5.1A2 2 0 0 0 21 12a2 2 0 0 0-2-2H9z" />
    </svg>
  ),
  style: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 3 4 9v12h6v-6h4v6h6V9l-8-6z" />
    </svg>
  ),
  role: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.2 6.5 3.6v7.4L12 19.8 5.5 15.2V7.8L12 4.2z" />
    </svg>
  ),
  union: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M4 4h16v4H4V4zm0 6h7v10H4V10zm9 0h7v10h-7V10z" />
    </svg>
  ),
  job: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M9 3h6l1 2h4v16H4V5h4l1-2zm1.5 2-.5 1H6v12h12V6h-4l-.5-1h-3z" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c.7 2.4 1 5 1 8s-.3 5.6-1 8c-.7-2.4-1-5-1-8s.3-5.6 1-8zm-2 .4C8.4 6.7 7 9.2 7 12s1.4 5.3 3 7.6C8.4 17.3 7 14.8 7 12s1.4-5.3 3-7.6zm4 0c1.6 2.3 3 4.8 3 7.6s-1.4 5.3-3 7.6c1.6-2.3 3-4.8 3-7.6s-1.4-5.3-3-7.6z"
      />
    </svg>
  ),
};

export function ProfileHeader({ model }: { model: RefereeDashboardModel }) {
  return (
    <div className="rdash-hero">
      <div className="rdash-portrait-card">
        <div className="rdash-portrait">
          {model.portraitUrl ? (
            // Portrait URL lives on the dashboard model so it can be swapped without layout work.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.portraitUrl} alt={`${model.name} portrait`} />
          ) : (
            <span className="rdash-portrait__fallback">{model.name.slice(0, 2)}</span>
          )}
          <span className="rdash-portrait__badge">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
              <path
                fill="currentColor"
                d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"
              />
            </svg>
            {model.roleBadge}
          </span>
        </div>
        <div className="rdash-identity">
          <h1 className="rdash-name">
            {model.name}
            {model.flagUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rdash-flag" src={model.flagUrl} alt="" />
            ) : null}
            <span className="rdash-sr-only">{model.countryName}</span>
          </h1>
          <p className="rdash-role">{model.roleBadge}</p>
          <ul className="rdash-bio">
            <BioRow icon={ICONS.flag} label="Nationality" value={model.bio.nationality} />
            <BioRow icon={ICONS.cake} label="Date of birth" value={model.bio.dateOfBirth} />
            <BioRow icon={ICONS.whistle} label="World Rugby debut" value={model.bio.worldRugbyDebut} />
            <BioRow icon={ICONS.style} label="Referee style" value={model.bio.refereeStyle} />
            <BioRow icon={ICONS.role} label="Preferred position" value={model.bio.preferredRole} />
            <BioRow icon={ICONS.union} label="Union" value={model.bio.union} />
            <BioRow icon={ICONS.job} label="Profession" value={model.bio.profession} />
          </ul>
        </div>
      </div>

      <div className="rdash-hero-metrics">
        <RatingBadge rating={model.overallRating} worldRank={model.worldRank} />
        <div className="rdash-metric-row">
          <StatCard label="Matches" value={model.totalMatches} hint="Career appointments" icon={ICONS.whistle} />
          <StatCard
            label="International"
            value={model.internationalMatches}
            hint="Test and championship"
            icon={ICONS.globe}
          />
        </div>
        <div className="rdash-form">
          <p className="rdash-form__label">Form (last 10 matches)</p>
          <ol className="rdash-form__row">
            {model.formLast10.map((result, index) => (
              <li
                key={`${result}-${index}`}
                className={`rdash-form__cell is-${result}`}
                title={result === "positive" ? "Strong display" : "Below usual standard"}
              >
                <span aria-hidden>{result === "positive" ? "W" : "L"}</span>
                <span className="rdash-sr-only">
                  Match {index + 1}: {result === "positive" ? "strong display" : "below usual standard"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
