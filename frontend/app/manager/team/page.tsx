"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Mail, Trash2, Shield, UserPlus } from "lucide-react";
import { projectApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import type { Project, ProjectMember } from "@/types";
import { cn } from "@/lib/utils";

type TeamMember = ProjectMember & { project_name: string; project_id: string };

export default function ManagerTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await projectApi.get("/");
        const projects: Project[] = Array.isArray(res.data)
          ? res.data
          : res.data.projects ?? [];

        const allMembers: TeamMember[] = [];
        const seen = new Set<string>();

        for (const proj of projects) {
          try {
            const detail = (await projectApi.get(`/${proj.id}`)).data;
            for (const m of detail.members ?? []) {
              const key = `${m.user_id}-${proj.id}`;
              if (!seen.has(key)) {
                seen.add(key);
                allMembers.push({
                  ...m,
                  project_name: proj.name,
                  project_id: proj.id,
                });
              }
            }
          } catch {
            // skip failed project detail
          }
        }

        setMembers(allMembers);
      } catch {
        toast.error("Failed to load team members");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const uniqueEmails = new Set(members.map((m) => m.user_email));

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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Team Matrix</h2>
          <p className="text-sm font-medium text-slate-500">
            Overview of <span className="font-bold text-indigo-600 dark:text-indigo-400">{uniqueEmails.size} unique members</span> collaborating across your portfolio.
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700 bg-white dark:bg-slate-900/50">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-800">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">The matrix is empty</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Start by assigning members to your projects. Their consolidated profiles will appear here for management.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Identity</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Project Assignment</th>
                  <th className="hidden px-6 py-4 font-bold uppercase tracking-wider md:table-cell">Access Level</th>
                  <th className="hidden px-6 py-4 font-bold uppercase tracking-wider lg:table-cell">Since</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((member) => (
                  <tr
                    key={`${member.user_id}-${member.project_id}`}
                    className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {member.user_email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                            {member.user_email.split("@")[0]}
                          </p>
                          <p className="truncate text-xs text-slate-500">{member.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {member.project_name}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <Shield className="h-3 w-3" />
                        {member.member_role}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 text-xs font-medium text-slate-400 lg:table-cell">
                      {member.joined_at ? new Date(member.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-800 dark:hover:bg-slate-800"
                          onClick={() => {
                            window.location.href = `mailto:${member.user_email}`;
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl border border-slate-100 text-rose-500 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/30"
                          onClick={() => setDeleteTarget(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
                Revoke Membership
              </h3>
              <p className="mb-8 text-sm text-slate-500 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{deleteTarget.user_email}</span> from <span className="font-bold text-slate-900 dark:text-white">{deleteTarget.project_name}</span>? They will lose access to all tasks and project assets.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setDeleteTarget(null)}>
                  Keep Member
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                  onClick={async () => {
                    try {
                      await projectApi.delete(
                        `/${deleteTarget.project_id}/members/${deleteTarget.user_id}`
                      );
                      setMembers((prev) =>
                        prev.filter(
                          (m) =>
                            !(
                              m.user_id === deleteTarget.user_id &&
                              m.project_id === deleteTarget.project_id
                            )
                        )
                      );
                      toast.success("Membership revoked");
                    } catch {
                      toast.error("Operation failed");
                    }
                    setDeleteTarget(null);
                  }}
                >
                  Revoke Access
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
