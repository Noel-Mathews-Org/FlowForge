import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminAuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
      <AppShell title="Audit Log">{children}</AppShell>
    </AuthGuard>
  );
}
