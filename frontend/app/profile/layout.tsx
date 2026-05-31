import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell title="Profile">
        {children}
      </AppShell>
    </AuthGuard>
  );
}
