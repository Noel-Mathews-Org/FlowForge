"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield, ShieldAlert, Key, Users } from "lucide-react";
import { authApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AdminUsersPage() {
  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await authApi.get("/users")).data,
  });

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">User Directory</h2>
          <p className="text-sm font-medium text-slate-500">Overview of all registered platform users.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">User Profile</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Status</th>
                <th className="hidden px-6 py-4 font-bold uppercase tracking-wider lg:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={4} className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={4} className="py-20 text-center text-rose-500 font-medium">Failed to establish connection with User Service.</td></tr>
              ) : !users || users.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-slate-400 font-medium">No records found in the directory.</td></tr>
              ) : (
                (Array.isArray(users) ? users : users.users ?? []).map((user: any) => (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {user.full_name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{user.full_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {user.role === "admin" || user.role === "platform_admin" ? <ShieldAlert className="h-3 w-3 text-rose-500" /> : user.role === "manager" ? <Shield className="h-3 w-3 text-indigo-500" /> : <Key className="h-3 w-3 text-emerald-500" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          user.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-700"
                        )} />
                        <span className={cn(
                          "text-xs font-semibold",
                          user.is_active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                        )}>
                          {user.is_active ? "Active" : "Revoked"}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 lg:table-cell">
                      {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
