import { Suspense } from "react";
import { ImportPlanetRugbyClient } from "./ImportPlanetRugbyClient";

export default function ImportPlanetRugbyPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 p-4">Loading Planet Rugby import…</p>
      }
    >
      <ImportPlanetRugbyClient />
    </Suspense>
  );
}
