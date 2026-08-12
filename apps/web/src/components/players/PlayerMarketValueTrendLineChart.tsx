import type { MarketValueTimelinePoint } from "@/lib/player-market-value-trend-utils";
import { R365ValueTrendChart } from "@/components/charts/R365ValueTrendChart";

export type PlayerMarketValueTrendLineChartProps = {
  points: Array<MarketValueTimelinePoint>;
  rangeStartIso: string;
  rangeEndIso: string;
  state?: "OK" | "LIMITED" | "INSUFFICIENT";
  className?: string;
  placeholderText?: string;
  hideCaptionAndLegend?: boolean;
  limitedHistory?: boolean;
};

/** Player profile wrapper around the shared R365 value trend chart. */
export function PlayerMarketValueTrendLineChart({
  points,
  rangeStartIso,
  rangeEndIso,
  state,
  className,
  placeholderText,
  hideCaptionAndLegend = false,
  limitedHistory = false,
}: PlayerMarketValueTrendLineChartProps) {
  return (
    <R365ValueTrendChart
      points={points}
      rangeStartIso={rangeStartIso}
      rangeEndIso={rangeEndIso}
      state={state}
      className={className}
      emptyState={placeholderText}
      hideCaptionAndLegend={hideCaptionAndLegend}
      limitedHistory={limitedHistory}
      showArea
      showGrid
      showTooltip
    />
  );
}
