import Link from "next/link";
import type { PublicScoutIntelligence } from "@/lib/player-scout-intelligence-service";

type Props = {
  scout: PublicScoutIntelligence;
  playerName: string;
  compareHref?: string | null;
};

function starsLabel(stars: number): string {
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return `${"★".repeat(full)}${half ? "½" : ""}${"☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}`;
}

function riskTone(level: string): string {
  if (level === "excellent" || level === "low") return "is-good";
  if (level === "medium") return "is-mid";
  return "is-bad";
}

function DnaBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="pr-scout-dna">
      <div className="pr-scout-dna__row">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="pr-scout-dna__track" aria-hidden>
        <span className="pr-scout-dna__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export function ScoutIntelligencePanel({ scout, playerName, compareHref }: Props) {
  const dna = scout.playerDna;
  const phys = scout.physicalIntelligence;
  const market = scout.marketIntelligence;
  const proj = scout.careerProjection;
  const sc = scout.scorecard;

  return (
    <div className="pr-scout">
      <header className="pr-scout-enhance-head">
        <h2 id="rri-section-heading">Recruitment Index</h2>
        <p>
          Adds a club-facing scorecard to this scouting report — it does not replace the editorial
          scouting summary, radar or player snapshot above.
        </p>
      </header>

      <section className="pr-scout-hero" aria-labelledby="rri-heading">
        <div className="pr-scout-hero__score">
          <p className="pr-scout-hero__label">RRI score</p>
          <p className="pr-scout-hero__value" id="rri-heading">
            {scout.rriScore}
          </p>
          <p className="pr-scout-hero__band">
            {scout.rriGrade} · {scout.rriBand}
          </p>
          <p className="pr-scout-hero__stars" aria-label={`${scout.stars} stars`}>
            {starsLabel(scout.stars)}
          </p>
        </div>
        <div className="pr-scout-hero__rec">
          <p className="pr-scout-hero__label">AI Recommendation</p>
          <p className="pr-scout-hero__rec-title">{scout.recommendationLabel}</p>
          <p className="pr-scout-hero__conf">Confidence {scout.recommendationConfidence}%</p>
          <p className="pr-scout-hero__summary">{scout.aiSummary}</p>
        </div>
      </section>

      <section className="pr-player-card pr-player-card--wide" aria-labelledby="scorecard-heading">
        <h3 id="scorecard-heading">Scout dashboard</h3>
        <div className="pr-scout-scorecard">
          {[
            ["Overall", sc.overallRating],
            ["Potential", sc.potential],
            ["Physical", sc.physical],
            ["Attack", sc.attack],
            ["Defence", sc.defence],
            ["Set piece", sc.setPiece],
            ["Discipline", sc.discipline],
            ["Leadership", sc.leadership],
            ["Availability", sc.availability],
          ].map(([label, value]) => (
            <div key={String(label)} className="pr-scout-scorecard__cell">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="pr-scout-scorecard__cell">
            <span>Market value</span>
            <strong>{scout.marketValueLabel ?? "—"}</strong>
          </div>
          <div className="pr-scout-scorecard__cell pr-scout-scorecard__cell--wide">
            <span>Recommendation</span>
            <strong>
              {starsLabel(sc.stars)} · {scout.recommendationLabel}
            </strong>
          </div>
        </div>
      </section>

      <div className="pr-player-grid">
        <section className="pr-player-card" aria-labelledby="risk-heading">
          <h3 id="risk-heading">Recruitment risk</h3>
          <ul className="pr-scout-risks">
            {[
              ["Injury", scout.riskInjury],
              ["Contract", scout.riskContract],
              ["Adaptation", scout.riskAdaptation],
              ["Discipline", scout.riskDiscipline],
              ["Availability", scout.availabilityScore >= 90 ? "excellent" : scout.riskInjury],
            ].map(([label, level]) => (
              <li key={String(label)} className={`pr-scout-risk ${riskTone(String(level))}`}>
                <span>{label}</span>
                <strong>{String(level)}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="pr-player-card" aria-labelledby="scout-rating-heading">
          <h3 id="scout-rating-heading">Scout rating</h3>
          <dl className="pr-player-info-list">
            <Fact label="Current ability" value={scout.currentAbility} />
            <Fact label="Potential" value={scout.potential} />
            <Fact label="Ceiling" value={scout.ceiling} />
            <Fact
              label="Ready for first team"
              value={scout.scoutRating.readyForFirstTeam ? "Yes" : "Not yet"}
            />
            <Fact label="Development time" value={scout.scoutRating.developmentTimeLabel} />
            <Fact label="Risk level" value={scout.scoutRating.riskLevel} />
          </dl>
        </section>
      </div>

      <section className="pr-player-card pr-player-card--wide" aria-labelledby="dna-heading">
        <h3 id="dna-heading">Player DNA</h3>
        <div className="pr-scout-dna-grid">
          <DnaBar label="Leadership" value={dna.leadership} />
          <DnaBar label="Professionalism" value={dna.professionalism} />
          <DnaBar label="Competitiveness" value={dna.competitiveness} />
          <DnaBar label="Aggression" value={dna.aggression} />
          <DnaBar label="Coachability" value={dna.coachability} />
          <DnaBar label="Work rate" value={dna.workRate} />
          <DnaBar label="Big-match mentality" value={dna.bigMatchMentality} />
          <DnaBar label="Communication" value={dna.communication} />
          <DnaBar label="Decision making" value={dna.decisionMaking} />
          <DnaBar label="Resilience" value={dna.resilience} />
        </div>
      </section>

      <div className="pr-player-grid">
        <section className="pr-player-card" aria-labelledby="phys-heading">
          <h3 id="phys-heading">Physical intelligence</h3>
          <dl className="pr-player-info-list">
            <Fact
              label="Height"
              value={phys.heightPercentile != null ? `${phys.heightPercentile}th percentile` : null}
            />
            <Fact
              label="Weight"
              value={phys.weightPercentile != null ? `${phys.weightPercentile}th percentile` : null}
            />
            <Fact
              label="Acceleration"
              value={
                phys.accelerationPercentile != null
                  ? `${phys.accelerationPercentile}th percentile`
                  : null
              }
            />
            <Fact
              label="Top speed"
              value={
                phys.topSpeedPercentile != null ? `${phys.topSpeedPercentile}th percentile` : null
              }
            />
            <Fact
              label="Strength"
              value={
                phys.strengthPercentile != null ? `${phys.strengthPercentile}th percentile` : null
              }
            />
            <Fact
              label="Fitness"
              value={
                phys.fitnessPercentile != null ? `${phys.fitnessPercentile}th percentile` : null
              }
            />
          </dl>
        </section>

        <section className="pr-player-card" aria-labelledby="market-heading">
          <h3 id="market-heading">Market intelligence</h3>
          <dl className="pr-player-info-list">
            <Fact label="Estimated value" value={market.estimatedValueLabel} />
            <Fact label="Likely transfer fee" value={market.likelyTransferFeeLabel} />
            <Fact
              label="Estimated salary"
              value={market.estimatedSalaryLabel ? `${market.estimatedSalaryLabel}/yr` : null}
            />
            <Fact
              label="Contract remaining"
              value={
                market.contractMonthsRemaining != null
                  ? `${market.contractMonthsRemaining} months`
                  : null
              }
            />
            <Fact
              label="Free transfer"
              value={
                market.freeTransfer == null ? null : market.freeTransfer ? "Yes" : "No"
              }
            />
            <Fact label="Agent" value={market.agentLabel} />
          </dl>
        </section>
      </div>

      <div className="pr-player-grid">
        <section className="pr-player-card" aria-labelledby="proj-heading">
          <h3 id="proj-heading">Career projection</h3>
          <dl className="pr-player-info-list">
            <Fact label="Next season" value={proj.nextSeasonLabel} />
            <Fact label="Next 3 years" value={proj.nextThreeYearsLabel} />
            <Fact label="Peak age" value={proj.peakAge} />
            <Fact label="Retirement window" value={proj.retirementWindow} />
            <Fact label="Intl caps probability" value={`${proj.internationalCapsProbability}%`} />
            <Fact label="Lions probability" value={`${proj.lionsProbability}%`} />
            <Fact label="World Cup squad" value={`${proj.worldCupSquadProbability}%`} />
          </dl>
        </section>

        <section className="pr-player-card" aria-labelledby="factors-heading">
          <h3 id="factors-heading">RRI factors</h3>
          <ul className="pr-scout-factors">
            {scout.factors.map((f) => (
              <li key={f.key}>
                <span>
                  {f.label}{" "}
                  <em>({(f.weight * 100).toFixed(0)}%)</em>
                </span>
                <strong>{f.score}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {scout.notes.length > 0 ? (
        <section className="pr-player-card pr-player-card--wide" aria-labelledby="notes-heading">
          <h3 id="notes-heading">Scout notes</h3>
          <ul className="pr-scout-notes">
            {scout.notes.map((n) => (
              <li key={n.id}>
                <p className="pr-scout-notes__meta">
                  {[n.observedOn, n.venue, n.matchContext, n.confidence]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="pr-scout-notes__body">{n.notes}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="pr-player-footnote">
        RRI for {playerName} (model {scout.modelVersion}) enhances the scouting view with a
        recruitment score from ability, form, contract, availability and character. Not a transfer
        fee guarantee.
        {compareHref ? (
          <>
            {" "}
            <Link href={compareHref}>Compare players</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
