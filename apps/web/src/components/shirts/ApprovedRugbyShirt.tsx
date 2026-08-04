"use client";

import { RugbyShirtSvg } from "@/components/shirts/RugbyShirtSvg";
import type { ShirtSvgConfig } from "@/lib/shirt-library-types";

export function ApprovedRugbyShirt({
  config,
  size = 96,
  title,
  crestUrl,
}: {
  config: ShirtSvgConfig;
  size?: number;
  title?: string;
  crestUrl?: string | null;
}) {
  return (
    <RugbyShirtSvg
      {...config}
      size={size}
      title={title}
      showCrest={Boolean(crestUrl) && config.crestEnabled}
      crestUrl={crestUrl}
    />
  );
}
