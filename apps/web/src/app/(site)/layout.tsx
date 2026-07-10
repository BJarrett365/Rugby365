import { AdminShell } from "@/components/shell/AdminShell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
