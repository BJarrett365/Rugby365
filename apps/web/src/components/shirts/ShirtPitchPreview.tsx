"use client";

import { RugbyShirtSvg } from "@/components/shirts/RugbyShirtSvg";
import type { ShirtSvgConfig } from "@/lib/shirt-library-types";

export function ShirtPitchPreview({
  config,
  number = 10,
  variant = "dark",
  size = 40,
  label,
}: {
  config: ShirtSvgConfig;
  number?: number | string;
  variant?: "dark" | "light";
  size?: number;
  label?: string;
}) {
  const bg =
    variant === "dark"
      ? "linear-gradient(180deg, #1a4d2e 0%, #0f3320 100%)"
      : "linear-gradient(180deg, #8fbc8f 0%, #6b9b6b 100%)";

  return (
    <div
      className="shirt-pitch-preview"
      style={{ background: bg }}
      title={label ?? "Pitch preview"}
    >
      <RugbyShirtSvg {...config} number={number} size={size} />
    </div>
  );
}
