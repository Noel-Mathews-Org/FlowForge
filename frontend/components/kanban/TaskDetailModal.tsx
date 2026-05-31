"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import type { Comment, Task } from "@/types";
import { taskApi, projectApi } from "@/lib/api";
import { generateId, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";

export const TaskDetailModal = ({
  task,
  open,
  onClose,
  onProposeMove
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onProposeMove?: (target: "IN_PROGRESS" | "DONE") => void;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [assigning, setAssigning] = useState(false);

  const { data: members } = useQuery({
    queryKey: ["project-members", task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      const res = await projectApi.get(`/${task.project_id}/members`);
      return res.data;
    },
    enabled: !!task?.project_id && (user?.role === "manager" || user?.role === "platform_admin" || user?.role === "org_owner")
  });

  if (!task) return null;

  const handleAssign = async (val: string) => {
    if (val === "unassigned") return;
    const selected = members?.find((m: any) => m.user_id === val);
    if (!selected) return;

    setAssigning(true);
    try {
      await taskApi.put(`/${task.id}`, {
        assignee_id: selected.user_id,
        assignee_email: selected.user_email
      });
      toast.success(`Assigned to ${selected.user_email}`);
      queryClient.invalidateQueries({ queryKey: ["tasks", task.project_id] });
    } catch {
      toast.error("Failed to assign task");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-full border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:w-[540px] md:w-[600px]"
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{task.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">Task details and activity</p>
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Title</label>
                      <Input defaultValue={task.title} className="font-semibold" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                      <Textarea defaultValue={task.description} rows={4} placeholder="No description provided..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Status</label>
                      <div className="flex h-10 items-center rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                        {task.status}
                        {task.needs_approval && <span className="ml-2 text-[10px] font-bold text-amber-600">⏳ Pending</span>}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Priority</label>
                      <SelectField
                        value={task.priority}
                        onValueChange={() => {}}
                        options={[
                          { value: "LOW", label: "Low" },
                          { value: "MEDIUM", label: "Medium" },
                          { value: "HIGH", label: "High" }
                        ]}
                      />
                    </div>
                  </div>

                  {task.proposed_status && (
                    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900/30 dark:bg-violet-900/10">
                      <p className="text-sm font-medium text-violet-900 dark:text-violet-300">
                        Proposed status change: <strong>{task.status} → {task.proposed_status}</strong>
                      </p>
                      <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">Awaiting manager review</p>
                    </div>
                  )}

                  {onProposeMove && task.status === "TODO" && !task.needs_approval && (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                      <p className="mb-3 text-sm font-medium text-indigo-900 dark:text-indigo-300">Ready to start working on this?</p>
                      <Button size="sm" onClick={() => onProposeMove("IN_PROGRESS")}>Request to start Progress</Button>
                    </div>
                  )}

                  {onProposeMove && task.status === "IN_PROGRESS" && !task.needs_approval && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                      <p className="mb-3 text-sm font-medium text-emerald-900 dark:text-emerald-300">Finished with this task?</p>
                      <Button size="sm" onClick={() => onProposeMove("DONE")} className="bg-emerald-600 hover:bg-emerald-700">Request to mark as Done</Button>
                    </div>
                  )}

                  {(user?.role === "manager" || user?.role === "platform_admin" || user?.role === "org_owner") && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Assign To</label>
                      <SelectField
                        value={task.assignee_id || "unassigned"}
                        onValueChange={handleAssign}
                        options={[
                          { value: "unassigned", label: "Unassigned" },
                          ...(members?.map((m: any) => ({
                            value: m.user_id,
                            label: m.user_email
                          })) || [])
                        ]}
                      />
                      {assigning && <p className="mt-1.5 text-[10px] font-bold animate-pulse text-indigo-500">SYNCING...</p>}
                    </div>
                  )}

                  {/* Comments section */}
                  <div className="space-y-4 pt-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Activity & Comments</h4>
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
                          <p className="text-slate-700 dark:text-slate-300">{comment.body}</p>
                          <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">{comment.author_email || "You"} • Just now</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write a message..."
                        className="border-none bg-transparent focus-visible:ring-0"
                        rows={3}
                      />
                      <div className="flex justify-end p-2">
                        <Button
                          size="sm"
                          disabled={!body.trim()}
                          onClick={async () => {
                            if (!body.trim()) return;
                            const optimistic: Comment = { id: generateId(), author_email: user?.email || "you@company.com", body, created_at: new Date().toISOString() };
                            setComments((v) => [...v, optimistic]);
                            setBody("");
                            try {
                              await taskApi.post(`/${task.id}/comments`, { body: optimistic.body });
                            } catch {
                              setComments((v) => v.filter((c) => c.id !== optimistic.id));
                              toast.error("Could not add comment");
                            }
                          }}
                        >
                          Send Message
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
