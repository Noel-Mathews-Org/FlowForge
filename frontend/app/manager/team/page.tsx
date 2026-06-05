"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Mail, Shield } from "lucide-react";
import { authApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at?: string;
};

export default function ManagerTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = getUser();

  useEffect(() => {
    (async () => {
      try {
        // Fetch team members from auth service — members under this manager
        const res = await authApi.get("/users/team");
        const teamData: TeamMember[] = Array.isArray(res.data) ? res.data : res.data.users ?? [];

        // Deduplicate by user id and filter out the manager themselves
        const seen = new Set<string>();
        const uniqueMembers: TeamMember[] = [];
        for (const m of teamData) {
          if (seen.has(m.id)) continue;
          // Exclude the manager from the team list
          if (currentUser && m.id === currentUser.sub) continue;
          seen.add(m.id);
          uniqueMembers.push(m);
        }

        setMembers(uniqueMembers);
      } catch {
        toast.error("Failed to load team members");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">My Team</h2>
          <p className="text-sm font-medium text-slate-500">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{members.length} members</span> assigned to you.
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700 bg-white dark:bg-slate-900/50">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-800">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No team members yet</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Members will appear here when the Org Owner assigns them to you.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Status</th>
                  <th className="hidden px-6 py-4 font-bold uppercase tracking-wider lg:table-cell">Since</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {member.full_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                            {member.full_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <Shield className="h-3 w-3" />
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          member.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-700"
                        )} />
                        <span className={cn(
                          "text-xs font-semibold",
                          member.is_active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                        )}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-xs font-medium text-slate-400 lg:table-cell">
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-800 dark:hover:bg-slate-800"
                        onClick={() => {
                          window.location.href = `mailto:${member.email}`;
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
