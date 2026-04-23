import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="member">
      <AppShell title="My Kanban Board">{children}</AppShell>
    </AuthGuard>
  );
}
