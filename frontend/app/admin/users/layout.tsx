import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
      <AppShell title="User Management">{children}</AppShell>
    </AuthGuard>
  );
}
