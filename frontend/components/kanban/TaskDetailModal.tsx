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
import { generateId } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
  const [content, setContent] = useState("");
  const [assigning, setAssigning] = useState(false);

  const { data: members } = useQuery({
    queryKey: ["project-members", task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      const res = await projectApi.get(`/${task.project_id}/members`);
      return res.data;
    },
    enabled: !!task?.project_id && (user?.role === "manager" || user?.role === "admin")
  });

  if (!task) return null;

  const handleAssign = async (val: string) => {
    if (val === "unassigned") return;
    const selected = members?.find((m: any) => m.user_id === val);
    if (!selected) return;

    setAssigning(true);
    try {
      await taskApi.patch(`/${task.id}/assign`, {
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
        <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="fixed right-0 top-0 z-50 h-screen w-[600px] overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-lift dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <button onClick={onClose} className="text-slate-500">Close</button>
          </div>
          <div className="space-y-4">
            <Input defaultValue={task.title} />
            <Textarea defaultValue={task.description} rows={4} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {task.status}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Priority</label>
                <SelectField value={task.priority} onValueChange={() => {}} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }]} />
              </div>
            </div>

            {onProposeMove && task.status === "TODO" && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <p className="mb-2 text-sm text-indigo-800 dark:text-indigo-300">Request to move this task to In Progress?</p>
                <Button size="sm" onClick={() => onProposeMove("IN_PROGRESS")}>Request Progress</Button>
              </div>
            )}

            {onProposeMove && task.status === "IN_PROGRESS" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                <p className="mb-2 text-sm text-emerald-800 dark:text-emerald-300">Request to mark this task as Done?</p>
                <Button size="sm" onClick={() => onProposeMove("DONE")} className="bg-emerald-600 hover:bg-emerald-700">Request Done</Button>
              </div>
            )}

            {(user?.role === "manager" || user?.role === "admin") && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Assign To</label>
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
                {assigning && <p className="mt-1 text-xs text-slate-500">Assigning...</p>}
              </div>
            )}

            {!["manager", "admin"].includes(user?.role || "") && task.assignee_email && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Assigned To</label>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {task.assignee_email}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-4">
              <h4 className="font-medium">Comments</h4>
              {comments.map((comment) => <div key={comment.id} className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{comment.content}</div>)}
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a comment" />
              <Button
                onClick={async () => {
                  if (!content.trim()) return;
                  const optimistic = { id: generateId(), author: "You", author_email: "you@company.com", content, created_at: new Date().toISOString() };
                  setComments((v) => [...v, optimistic]);
                  setContent("");
                  try {
                    await taskApi.post(`/${task.id}/comments`, { content: optimistic.content });
                  } catch {
                    setComments((v) => v.filter((c) => c.id !== optimistic.id));
                    toast.error("Could not add comment");
                  }
                }}
              >
                Post Comment
              </Button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
