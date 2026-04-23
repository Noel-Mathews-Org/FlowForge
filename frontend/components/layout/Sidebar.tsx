"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle, FolderKanban, FolderOpen, Kanban, LayoutDashboard, LogOut, ScrollText, Settings, Users } from "lucide-react";
import { motion } from "framer-motion";
import { getUser, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navByRole = {
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText }
  ],
  manager: [
    { href: "/manager", label: "Projects", icon: FolderKanban },
    { href: "/manager/approvals", label: "Approvals", icon: CheckCircle },
  ],
  member: [
    { href: "/dashboard", label: "My Board", icon: Kanban },
  ]
} as const;

export const Sidebar = ({ pendingApprovals = 0 }: { pendingApprovals?: number }) => {
  const pathname = usePathname();
  const user = getUser();
  const nav = user ? navByRole[user.role] : [];
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-600 px-2 py-1 text-sm font-semibold text-white">FF</div>
          <span className="font-medium text-slate-800 dark:text-slate-100">FlowForge</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">v1.0</span>
      </div>

      <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Main</p>
      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                active && "border-l-2 border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/10 dark:text-indigo-300"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.label === "Approvals" && pendingApprovals > 0 && (
                <motion.span initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] text-white">
                  {pendingApprovals}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
            {user?.full_name?.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.full_name}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-800">{user?.role}</span>
          </div>
          <Settings className="ml-auto h-4 w-4 text-slate-400" />
        </div>
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </aside>
  );
};
