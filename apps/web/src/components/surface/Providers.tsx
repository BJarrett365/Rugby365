import { SurfaceProvider } from "@/components/surface/SurfaceProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SurfaceProvider>{children}</SurfaceProvider>;
}
