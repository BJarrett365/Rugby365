import Link from "next/link";
import { SeasonSelect } from "@/components/shirts/SeasonSelect";

export function CompetitionShirtHeader({
  competitionName,
  seasonLabel,
  regionLabel,
  title,
  subtitle,
  accentColour,
  seasons,
  currentSeasonSlug,
  competitionSlug,
}: {
  competitionName: string;
  seasonLabel: string;
  regionLabel: string | null;
  title: string;
  subtitle: string;
  accentColour: string;
  seasons: Array<{ slug: string; label: string }>;
  currentSeasonSlug: string;
  competitionSlug: string;
}) {
  return (
    <header className="slp__header" style={{ ["--slp-accent-dynamic" as string]: accentColour }}>
      <div className="slp__header-top">
        <div className="slp__brand">Rugby365 · Intelligence. Data. Insight.</div>
        <SeasonSelect
          competitionSlug={competitionSlug}
          currentSeasonSlug={currentSeasonSlug}
          seasons={seasons}
        />
      </div>
      <div>
        <h1 className="slp__title">{title}</h1>
        <p className="slp__subtitle">{subtitle}</p>
        <p className="slp__subtitle" style={{ fontSize: "0.9rem" }}>
          Approved for Rugby365 pitch graphics · Sponsor-free simplified designs
        </p>
        <div className="slp__meta">
          <span>{competitionName}</span>
          <span>{seasonLabel}</span>
          {regionLabel ? <span>{regionLabel}</span> : null}
          <Link href={`/competitions/${competitionSlug}/fixtures`}>Competition hub</Link>
        </div>
      </div>
    </header>
  );
}
