"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RefereeRatingPoint } from "@/lib/referee-dashboard-types";

export function LineChart({ data }: { data: RefereeRatingPoint[] }) {
  const latest = data[data.length - 1];
  return (
    <div className="rdash-chart">
      <ResponsiveContainer width="100%" height={240}>
        <RechartsLine data={data} margin={{ top: 28, right: 28, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            interval={3}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[78, 92]}
            ticks={[78, 82, 86, 90]}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "#0b141c",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#f8fafc",
            }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            name="Rating"
            stroke="#4ade80"
            strokeWidth={2.4}
            dot={(props) => {
              const { index, cx, cy, key } = props as {
                index?: number;
                cx?: number;
                cy?: number;
                key?: string;
              };
              if (index !== data.length - 1 || cx == null || cy == null) return <g key={key} />;
              return (
                <g key={key}>
                  <circle cx={cx} cy={cy} r={5} fill="#4ade80" stroke="#0b141c" strokeWidth={2} />
                  <text x={cx - 18} y={cy - 12} fill="#4ade80" fontSize={11} fontWeight={700}>
                    {latest?.rating.toFixed(1)}
                  </text>
                </g>
              );
            }}
            activeDot={{ r: 5, fill: "#4ade80" }}
          />
        </RechartsLine>
      </ResponsiveContainer>
      {latest ? (
        <p className="rdash-chart-callout">
          Latest <strong>{latest.rating.toFixed(1)}</strong> · {latest.month}
        </p>
      ) : null}
    </div>
  );
}
