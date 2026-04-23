import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="manager">
      <AppShell title="Project Workspace">{children}</AppShell>
    </AuthGuard>
  );
}
