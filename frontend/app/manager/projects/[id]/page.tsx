"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useProjectDetail, useArchiveProject, useUnarchiveProject } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectApi } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, Archive, ArchiveRestore } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function ManagerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const project = useProjectDetail(params.id);
  const tasks = useTasks(params.id);
  const archiveProject = useArchiveProject();
  const unarchiveProject = useUnarchiveProject();
  const router = useRouter();

  if (project.isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (project.isError || !project.data) return <div className="p-8 text-rose-500">Failed to load project details</div>;

  const handleAddMember = async () => {
    if (!inviteEmail.trim()) return;
    setIsAdding(true);
    try {
      const res = await projectApi.post(`/${params.id}/members`, { email: inviteEmail });
      toast.success(res.data.message || "Member added");
      setInviteEmail("");
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
          <Button onClick={() => setAddModalOpen(true)}>Add Member</Button>
        </div>
        
        <div className="space-y-2">
          {(project.data.members ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">No members found for this project.</div>
          ) : (
            (project.data.members ?? []).map((member) => (
              <div key={member.user_id} className="flex items-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                  {member.user_email.split("@")[0].split(".").map((n) => n[0]?.toUpperCase()).join("")}
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

      <AnimatePresence>
        {addModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Project Member</h3>
              <p className="mb-4 text-sm text-slate-500">Enter the email address of the person you want to invite. If they do not have an account, one will be created and they will receive an email.</p>
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={isAdding}>Cancel</Button>
                  <Button onClick={handleAddMember} disabled={isAdding || !inviteEmail.trim()}>
                    {isAdding ? "Adding..." : "Add Member"}
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
