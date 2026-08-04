export function CompetitionReadinessPanel({
  readiness,
}: {
  readiness: {
    teams: number;
    homeApproved: number;
    awayApproved: number;
    thirdApproved: number;
    readinessPct: number;
  };
}) {
  return (
    <section className="slp__panel">
      <h2 className="slp__section-title">Competition shirt readiness</h2>
      <div className="slp__readiness">
        <div>
          <strong>{readiness.teams}</strong>
          <span className="slp__card-country">Teams</span>
        </div>
        <div>
          <strong>{readiness.homeApproved}</strong>
          <span className="slp__card-country">Home approved</span>
        </div>
        <div>
          <strong>{readiness.awayApproved}</strong>
          <span className="slp__card-country">Away approved</span>
        </div>
        <div>
          <strong>{readiness.thirdApproved}</strong>
          <span className="slp__card-country">Third approved</span>
        </div>
        <div>
          <strong>{readiness.readinessPct}%</strong>
          <span className="slp__card-country">Overall readiness</span>
        </div>
      </div>
    </section>
  );
}
