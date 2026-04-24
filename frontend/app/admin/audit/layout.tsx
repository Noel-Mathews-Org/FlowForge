import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminAuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
      {children}
    </AuthGuard>
  );
}
