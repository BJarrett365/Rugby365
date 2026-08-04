type Facts = {
  competitionType: string | null;
  season: string;
  teams: number;
  countries: string[];
  region: string | null;
  level: string | null;
  format: string | null;
  wikipediaUrl: string | null;
};

export function CompetitionFactsPanel({ facts }: { facts: Facts }) {
  const rows: Array<[string, string]> = [];
  if (facts.competitionType) rows.push(["Competition type", facts.competitionType]);
  rows.push(["Season", facts.season]);
  rows.push(["Teams", String(facts.teams)]);
  if (facts.countries.length) rows.push(["Countries", facts.countries.join(", ")]);
  if (facts.region) rows.push(["Region", facts.region]);
  if (facts.level) rows.push(["Level", facts.level]);
  if (facts.format) rows.push(["Format", facts.format]);

  return (
    <section className="slp__panel">
      <h2 className="slp__section-title">Competition facts</h2>
      <dl className="slp__facts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {facts.wikipediaUrl ? (
        <p style={{ marginTop: "0.75rem" }}>
          <a href={facts.wikipediaUrl} target="_blank" rel="noreferrer">
            Official / Wikipedia page
          </a>
        </p>
      ) : null}
    </section>
  );
}
