import { CompetitionTeamShirtCard } from "@/components/shirts/CompetitionTeamShirtCard";
import type { PublicShirtTeamCard } from "@/lib/shirt-library-public-service";

export function CompetitionTeamShirtGrid({ teams }: { teams: PublicShirtTeamCard[] }) {
  if (!teams.length) {
    return (
      <section className="slp__section">
        <h2 className="slp__section-title">Team shirts</h2>
        <p className="slp__map-empty">No teams are linked to this competition season yet.</p>
      </section>
    );
  }

  return (
    <section className="slp__section">
      <h2 className="slp__section-title">Official team colours</h2>
      <div className="slp__grid">
        {teams.map((team) => (
          <CompetitionTeamShirtCard key={team.teamId} team={team} />
        ))}
      </div>
    </section>
  );
}
