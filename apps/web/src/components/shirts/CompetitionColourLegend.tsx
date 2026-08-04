import type { ColourLegendSwatch } from "@/lib/shirt-library-public-service";

export function CompetitionColourLegend({ swatches }: { swatches: ColourLegendSwatch[] }) {
  if (!swatches.length) return null;
  return (
    <section className="slp__panel">
      <h2 className="slp__section-title">Colour legend</h2>
      <div className="slp__legend">
        {swatches.map((s) => (
          <span key={s.label} className="slp__swatch">
            <i style={{ background: s.hex }} />
            {s.label}
          </span>
        ))}
      </div>
    </section>
  );
}
