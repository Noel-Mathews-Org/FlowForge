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
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-200 bg-white px-4 py-5 transition-all duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900",
          // Mobile states
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop states
          collapsed ? "w-[60px] px-2" : "w-[240px]"
        )}
      >
        {/* Header */}
        <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
              FF
            </div>
            {!collapsed && (
              <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">FlowForge</span>
            )}
          </div>
          
          {/* Desktop Toggle Button */}
          {!open && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 md:flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
          )}

          {/* Mobile close button */}
          {open && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Main Navigation
          </p>
        )}
        
        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || ((item.href as string) !== "/" && pathname.startsWith(item.href));
            const isApprovals = item.label === "Approvals";
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active 
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100",
                  collapsed && "justify-center px-0 mx-auto w-10"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                
                {/* Badge Logic */}
                {isApprovals && pendingApprovals > 0 && (
                  <div className={cn(
                    "flex h-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900",
                    collapsed ? "absolute -right-1 -top-1 px-1 min-w-[1.25rem]" : "px-2"
                  )}>
                    {pendingApprovals}
                  </div>
                )}
                
                {active && !collapsed && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-indigo-600"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-3")}>
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              {user?.full_name?.split(" ").map((n) => n[0]).join("")}
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 dark:border-slate-900" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.full_name}</p>
                <p className="truncate text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">{user?.role}</p>
              </div>
            )}
          </div>
          
          <button
            onClick={logout}
            className={cn(
              "mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
