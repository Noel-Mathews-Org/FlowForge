import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ManagerApprovalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="manager">
      <AppShell title="Approvals">{children}</AppShell>
    </AuthGuard>
  );
}
