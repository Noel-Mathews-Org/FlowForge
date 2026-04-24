"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Mail, Trash2 } from "lucide-react";
import { projectApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import type { Project, ProjectMember } from "@/types";

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

  // Deduplicate by user_email for the unique member count
  const uniqueEmails = new Set(members.map((m) => m.user_email));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Team Members</h2>
          <p className="text-sm text-slate-500">
            {uniqueEmails.size} unique member{uniqueEmails.size !== 1 ? "s" : ""} across your projects
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
          <Users className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No team members yet</p>
          <p className="mt-1 text-sm text-slate-400">Add members to your projects to see them here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500 md:px-6">Member</th>
                  <th className="px-4 py-3 font-medium text-slate-500 md:px-6">Role</th>
                  <th className="hidden px-4 py-3 font-medium text-slate-500 sm:table-cell md:px-6">Project</th>
                  <th className="hidden px-4 py-3 font-medium text-slate-500 md:table-cell md:px-6">Joined</th>
                  <th className="px-4 py-3 font-medium text-right text-slate-500 md:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((member) => (
                  <tr
                    key={`${member.user_id}-${member.project_id}`}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-4 md:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                          {member.user_email
                            .split("@")[0]
                            .split(".")
                            .map((n) => n[0]?.toUpperCase())
                            .join("")}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {member.user_email.split("@")[0]}
                          </p>
                          <p className="text-xs text-slate-500">{member.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 md:px-6">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {member.member_role}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 sm:table-cell md:px-6">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {member.project_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 text-slate-500 md:table-cell md:px-6">
                      {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-4 text-right md:px-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => {
                            window.location.href = `mailto:${member.user_email}`;
                          }}
                        >
                          <Mail className="h-3 w-3" />
                          <span className="hidden sm:inline">Email</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-rose-200 text-xs text-rose-500 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                          onClick={() => setDeleteTarget(member)}
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Remove</span>
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

      {/* Remove Member Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
            >
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Remove Member
              </h3>
              <p className="mb-6 text-sm text-slate-500">
                Remove <strong>{deleteTarget.user_email}</strong> from{" "}
                <strong>{deleteTarget.project_name}</strong>?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-rose-600 text-white hover:bg-rose-700"
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
                      toast.success("Member removed");
                    } catch {
                      toast.error("Failed to remove member");
                    }
                    setDeleteTarget(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
