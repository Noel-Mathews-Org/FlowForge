import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ManagerApprovalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="manager">
      {children}
    </AuthGuard>
  );
}
