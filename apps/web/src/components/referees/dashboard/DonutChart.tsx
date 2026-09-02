"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RefereeDisciplinarySlice } from "@/lib/referee-dashboard-types";

const FILL: Record<RefereeDisciplinarySlice["key"], string> = {
  yellow: "#facc15",
  red: "#ef4444",
  sinbin: "#94a3b8",
};

export function DonutChart({ data }: { data: RefereeDisciplinarySlice[] }) {
  const chartData = data.map((row) => ({
    name: row.label,
    value: row.careerTotal,
    key: row.key,
  }));
  return (
    <div className="rdash-chart rdash-chart--donut">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={3}
            stroke="none"
          >
            {chartData.map((row) => (
              <Cell key={row.key} fill={FILL[row.key as RefereeDisciplinarySlice["key"]]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string) =>
              typeof value === "number" ? `${value.toLocaleString()} career` : value
            }
            contentStyle={{
              background: "#0b141c",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#f8fafc",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="rdash-donut-legend">
        {data.map((row) => (
          <li key={row.key}>
            <span className={`rdash-dot rdash-dot--${row.key}`} />
            <span>
              {row.label}
              <small>{row.perMatch.toFixed(2)} / match</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
