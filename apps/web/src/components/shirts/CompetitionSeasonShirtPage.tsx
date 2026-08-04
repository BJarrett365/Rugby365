import Link from "next/link";
import { CompetitionAboutPanel } from "@/components/shirts/CompetitionAboutPanel";
import { CompetitionColourLegend } from "@/components/shirts/CompetitionColourLegend";
import { CompetitionFactsPanel } from "@/components/shirts/CompetitionFactsPanel";
import { CompetitionFlagList } from "@/components/shirts/CompetitionFlagList";
import { CompetitionMap } from "@/components/shirts/CompetitionMap";
import { CompetitionReadinessPanel } from "@/components/shirts/CompetitionReadinessPanel";
import { CompetitionShirtHeader } from "@/components/shirts/CompetitionShirtHeader";
import { CompetitionTeamShirtGrid } from "@/components/shirts/CompetitionTeamShirtGrid";
import { PreviousSeasonLinks } from "@/components/shirts/PreviousSeasonLinks";
import type { getCompetitionShirtLibraryPage } from "@/lib/shirt-library-public-service";

type PageData = Exclude<
  Awaited<ReturnType<typeof getCompetitionShirtLibraryPage>>,
  null | { blocked: true }
>;

export function CompetitionSeasonShirtPage({
  data,
  allSeasons,
}: {
  data: PageData;
  allSeasons: Array<{ slug: string; label: string }>;
}) {
  const regionLabel =
    data.competition.countryName ||
    data.competition.region ||
    data.competition.catalogGroup ||
    null;

  return (
    <div className="slp" style={{ ["--slp-accent-dynamic" as string]: data.accentColour }}>
      <nav className="slp__breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shirt-library">Shirt Library</Link>
        <span>/</span>
        <Link href={`/shirt-library/${data.competition.slug}`}>{data.competition.name}</Link>
        <span>/</span>
        <span>{data.season.label}</span>
      </nav>

      <CompetitionShirtHeader
        competitionName={data.competition.name}
        seasonLabel={data.season.label}
        regionLabel={regionLabel}
        title={data.page.title}
        subtitle={data.page.subtitle}
        accentColour={data.accentColour}
        seasons={allSeasons}
        currentSeasonSlug={data.season.slug}
        competitionSlug={data.competition.slug}
      />

      {data.page.flagsEnabled ? <CompetitionFlagList flags={data.flags} /> : null}
      {data.page.mapEnabled ? <CompetitionMap locations={data.mapLocations} /> : null}

      <CompetitionTeamShirtGrid teams={data.teams} />

      <div className="slp__panels">
        {data.page.aboutSectionEnabled ? (
          <CompetitionAboutPanel title="About the competition" about={data.about} />
        ) : null}
        <CompetitionFactsPanel facts={data.facts} />
        {data.page.colourLegendEnabled ? (
          <CompetitionColourLegend swatches={data.colourLegend} />
        ) : null}
        <CompetitionReadinessPanel readiness={data.readiness} />
        <section className="slp__panel">
          <h2 className="slp__section-title">About the shirts</h2>
          <p>
            Official team colours. Sponsor-free designs. Simplified for clarity on pitch
            graphics. Optimised for digital and print. Approved through the Rugby365 Shirt
            Library and stored by season and version — not full retail shirt replicas.
          </p>
        </section>
      </div>

      <PreviousSeasonLinks seasons={data.previousSeasons} />
    </div>
  );
}
