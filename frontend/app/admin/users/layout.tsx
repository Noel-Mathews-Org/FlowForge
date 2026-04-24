import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
      {children}
    </AuthGuard>
  );
}
