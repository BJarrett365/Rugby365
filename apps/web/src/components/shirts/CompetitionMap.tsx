import type { CompetitionMapLocation } from "@/lib/shirt-library-public-service";

export function CompetitionMap({ locations }: { locations: CompetitionMapLocation[] }) {
  if (!locations.length) {
    return (
      <section className="slp__section">
        <h2 className="slp__section-title">Competition map</h2>
        <div className="slp__map">
          <p className="slp__map-empty">Team location data is not yet complete.</p>
        </div>
      </section>
    );
  }

  const lats = locations.map((l) => l.latitude);
  const lngs = locations.map((l) => l.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = Math.max(0.8, (maxLat - minLat) * 0.2);
  const padLng = Math.max(0.8, (maxLng - minLng) * 0.2);
  const left = minLng - padLng;
  const right = maxLng + padLng;
  const bottom = minLat - padLat;
  const top = maxLat + padLat;
  const width = 640;
  const height = 360;

  const project = (lat: number, lng: number) => {
    const x = ((lng - left) / (right - left || 1)) * width;
    const y = ((top - lat) / (top - bottom || 1)) * height;
    return { x, y };
  };

  return (
    <section className="slp__section">
      <h2 className="slp__section-title">Competition map</h2>
      <div className="slp__map">
        <svg
          className="slp__map-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Team locations"
        >
          <rect width={width} height={height} fill="rgba(255,255,255,0.02)" rx="8" />
          {locations.map((loc) => {
            const { x, y } = project(loc.latitude, loc.longitude);
            return (
              <a key={loc.teamId} href={loc.clubHref}>
                <circle className="slp__map-pin" cx={x} cy={y} r={5} />
                <text className="slp__map-label" x={x + 8} y={y + 3}>
                  {loc.shortName || loc.teamName.slice(0, 3).toUpperCase()}
                </text>
              </a>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
