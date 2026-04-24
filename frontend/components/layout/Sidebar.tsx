"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { getUser, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navByRole = {
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  ],
  manager: [
    { href: "/manager", label: "Projects", icon: FolderKanban },
    { href: "/manager/approvals", label: "Approvals", icon: CheckCircle },
    { href: "/manager/team", label: "Team", icon: Users },
  ],
  member: [
    { href: "/dashboard", label: "My Board", icon: Kanban },
  ],
} as const;

interface SidebarProps {
  pendingApprovals?: number;
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = ({
  pendingApprovals = 0,
  open = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) => {
  const pathname = usePathname();
  const user = getUser();
  const nav = user ? navByRole[user.role] : [];

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900",
          "transform transition-all duration-300 ease-in-out",
          // Mobile: drawer behavior
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: collapsible width
          collapsed ? "w-16 px-2" : "w-60"
        )}
      >
        {/* Header */}
        <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              FF
            </div>
            {!collapsed && (
              <span className="font-medium text-slate-800 dark:text-slate-100">FlowForge</span>
            )}
          </div>
          {!collapsed && (
            <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 md:inline">
              v1.0
            </span>
          )}
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!collapsed && <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Main</p>}
        <nav className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  active && "border-l-2 border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/10 dark:text-indigo-300",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
                {!collapsed && item.label === "Approvals" && pendingApprovals > 0 && (
                  <motion.span
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] text-white"
                  >
                    {pendingApprovals}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="mb-3 hidden w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:flex"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}

          {!collapsed ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
                  {user?.full_name?.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user?.full_name}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-800">
                    {user?.role}
                  </span>
                </div>
                <Settings className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </>
          ) : (
            <button
              onClick={logout}
              title="Logout"
              className="flex w-full items-center justify-center rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
