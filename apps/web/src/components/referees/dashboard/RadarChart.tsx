"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RefereeRadarPoint } from "@/lib/referee-dashboard-types";

export function RadarChart({
  data,
  overallRating,
}: {
  data: RefereeRadarPoint[];
  overallRating: number;
}) {
  return (
    <div className="rdash-chart rdash-chart--radar">
      <div className="rdash-radar-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: "#c5d0da", fontSize: 11 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="This referee"
              dataKey="referee"
              stroke="#4ade80"
              fill="#4ade80"
              fillOpacity={0.28}
              strokeWidth={2}
            />
            <Radar
              name="Elite referee average"
              dataKey="eliteAverage"
              stroke="#94a3b8"
              fill="transparent"
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
            <Tooltip
              contentStyle={{
                background: "#0b141c",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#f8fafc",
              }}
            />
          </RechartsRadar>
        </ResponsiveContainer>
        <p className="rdash-radar-centre" aria-hidden>
          <strong>{overallRating.toFixed(1)}</strong>
          <span>Overall</span>
        </p>
      </div>
      <ul className="rdash-legend">
        <li>
          <span className="rdash-legend__swatch rdash-legend__swatch--solid" />
          This referee
        </li>
        <li>
          <span className="rdash-legend__swatch rdash-legend__swatch--dash" />
          Elite referee average
        </li>
      </ul>
      <table className="rdash-sr-only">
        <caption>Performance scores versus elite average</caption>
        <thead>
          <tr>
            <th>Category</th>
            <th>Referee</th>
            <th>Elite average</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.category}>
              <td>{row.category}</td>
              <td>{row.referee}</td>
              <td>{row.eliteAverage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
