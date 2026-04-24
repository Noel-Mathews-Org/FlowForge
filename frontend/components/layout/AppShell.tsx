"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApprovals } from "@/hooks/useApprovals";
import { cn } from "@/lib/utils";

export const AppShell = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const { data } = useApprovals();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar
        pendingApprovals={data?.length ?? 0}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "md:ml-16" : "md:ml-60"
        )}
      >
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
