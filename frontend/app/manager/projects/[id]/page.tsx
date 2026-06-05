"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useProjectDetail, useArchiveProject, useUnarchiveProject } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { projectApi, authApi } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, Archive, ArchiveRestore, UserPlus, Users, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type TeamUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

export default function ManagerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const project = useProjectDetail(params.id);
  const tasks = useTasks(params.id);
  const archiveProject = useArchiveProject();
  const unarchiveProject = useUnarchiveProject();
  const router = useRouter();

  // Fetch team members when the add modal opens
  useEffect(() => {
    if (!addModalOpen) return;
    setLoadingTeam(true);
    authApi
      .get("/users/team")
      .then(({ data }) => {
        const members: TeamUser[] = Array.isArray(data) ? data : data.users ?? [];
        setTeamMembers(members.filter((m) => m.is_active));
      })
      .catch(() => {
        toast.error("Failed to load team members");
      })
      .finally(() => setLoadingTeam(false));
  }, [addModalOpen]);

  if (project.isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (project.isError || !project.data) return <div className="p-8 text-rose-500">Failed to load project details</div>;

  // Get IDs of users already in the project
  const existingMemberIds = new Set(
    (project.data.members ?? []).map((m: any) => m.user_id)
  );

  // Filter out users who are already members of this project
  const availableMembers = teamMembers.filter(
    (m) => !existingMemberIds.has(m.id)
  );

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setIsAdding(true);
    try {
      const selectedUser = teamMembers.find((m) => m.id === selectedUserId);
      const res = await projectApi.post(`/${params.id}/members`, {
        user_id: selectedUserId,
        email: selectedUser?.email,
      });
      toast.success(res.data.message || "Member added");
      setSelectedUserId("");
      setAddModalOpen(false);
      project.refetch();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail[0]?.msg : detail;
      toast.error(errorMsg || "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{project.data.name}</h2>
            {project.data.is_archived && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Archived
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{project.data.description}</p>
        </div>
        <div className="flex gap-2">
          {project.data.is_archived ? (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await unarchiveProject.mutateAsync(params.id);
                  toast.success("Project unarchived");
                  project.refetch();
                } catch {
                  toast.error("Failed to unarchive project");
                }
              }}
              disabled={unarchiveProject.isPending}
            >
              <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
              onClick={async () => {
                if (confirm("Are you sure you want to archive this project?")) {
                  try {
                    await archiveProject.mutateAsync(params.id);
                    toast.success("Project archived");
                    router.push("/manager/projects");
                  } catch {
                    toast.error("Failed to archive project");
                  }
                }
              }}
              disabled={archiveProject.isPending}
            >
              <Archive className="mr-2 h-4 w-4" /> Archive
            </Button>
          )}
        </div>
      </div>

      <div>
        {tasks.isLoading ? (
          <Skeleton className="h-[560px]" />
        ) : tasks.isError || !tasks.data ? (
          <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
            Board failed to load. <button className="underline" onClick={() => tasks.refetch()}>Retry</button>
          </div>
        ) : (
          <KanbanBoard 
            initialBoard={tasks.data} 
            projectId={params.id} 
            projectMembers={project.data.members} 
          />
        )}
      </div>

      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Team Members</h3>
          <Button onClick={() => setAddModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Member
          </Button>
        </div>
        
        <div className="space-y-2">
          {(project.data.members ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">No members found for this project.</div>
          ) : (
            (project.data.members ?? []).map((member: any) => (
              <div key={member.user_id} className="flex items-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                  {member.user_email.split("@")[0].split(".").map((n: string) => n[0]?.toUpperCase()).join("")}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.user_email}</p>
                  <p className="text-xs text-slate-500">{member.member_role}</p>
                </div>
                <span className="mr-3 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{member.member_role}</span>
                {member.member_role !== "manager" && (
                  <Button variant="outline" size="icon" onClick={async () => {
                    if (confirm("Remove this member?")) {
                      try {
                        await projectApi.delete(`/${params.id}/members/${member.user_id}`);
                        project.refetch();
                        toast.success("Member removed");
                      } catch {
                        toast.error("Could not remove member");
                      }
                    }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Member Modal — Dropdown of existing team members */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Add Project Member
              </h3>
              <p className="mb-4 text-sm text-slate-500 mt-1">
                Select a team member to add to this project. Only members assigned to you by the Org Owner are shown.
              </p>

              <div className="space-y-4">
                {loadingTeam ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span className="ml-2 text-sm text-slate-500">Loading team…</span>
                  </div>
                ) : availableMembers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No available members</p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          All your team members are already in this project, or you don&apos;t have any team members assigned yet. Contact the Org Owner to assign members to you.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Select Team Member
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Choose a member…</option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => { setAddModalOpen(false); setSelectedUserId(""); }} disabled={isAdding}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddMember}
                    disabled={isAdding || !selectedUserId}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isAdding ? "Adding…" : "Add Member"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
