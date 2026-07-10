"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { detectSurface, type SurfaceId } from "@/lib/surfaces";

type SurfaceContextValue = {
  surface: SurfaceId;
  setOverride: (surface: SurfaceId | null) => void;
};

const SurfaceContext = createContext<SurfaceContextValue>({
  surface: "desktop",
  setOverride: () => undefined,
});

export function useSurface() {
  return useContext(SurfaceContext);
}

export function SurfaceProvider({
  children,
  initialOverride,
}: {
  children: React.ReactNode;
  initialOverride?: SurfaceId | null;
}) {
  const [override, setOverride] = useState<SurfaceId | null>(initialOverride ?? null);
  const [surface, setSurface] = useState<SurfaceId>("desktop");

  useEffect(() => {
    const update = () => setSurface(detectSurface(override));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const mq = window.matchMedia("(print)");
    mq.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      mq.removeEventListener("change", update);
    };
  }, [override]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("surface");
    if (fromUrl) {
      const detected = detectSurface(fromUrl);
      setOverride(detected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for ?surface=
  }, []);

  useEffect(() => {
    document.documentElement.dataset.surface = surface;
    document.body.dataset.surface = surface;
  }, [surface]);

  const value = useMemo(() => ({ surface, setOverride }), [surface]);

  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}
