import { AppShell } from "@/components/shell/AppShell";

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="tv">{children}</AppShell>;
}
