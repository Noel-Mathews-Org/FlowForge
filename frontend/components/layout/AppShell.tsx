"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApprovals } from "@/hooks/useApprovals";

export const AppShell = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const { data } = useApprovals();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar pendingApprovals={data?.length ?? 0} />
      <div className="ml-60">
        <TopBar title={title} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
};
