import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="org_owner">
      <AppShell title="Organization Dashboard">{children}</AppShell>
    </AuthGuard>
  );
}
