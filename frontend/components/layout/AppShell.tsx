"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";

export const AppShell = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Responsive handling for tablet (automatic collapse)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768 && width < 1024) {
        setCollapsed(true);
      } else if (width >= 1024) {
        setCollapsed(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      
      <div
        className={cn(
          "min-h-screen transition-all duration-200 ease-in-out",
          // On mobile, no margin. On tablet/desktop, adjust for sidebar
          collapsed ? "md:ml-[60px]" : "md:ml-[240px]"
        )}
      >
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
