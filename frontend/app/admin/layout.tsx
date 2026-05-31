import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="platform_admin">
      <AppShell title="System Analytics">{children}</AppShell>
    </AuthGuard>
  );
}
