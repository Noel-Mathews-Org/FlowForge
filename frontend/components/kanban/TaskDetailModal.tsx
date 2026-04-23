"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import type { Comment, Task } from "@/types";
import { taskApi } from "@/lib/api";
import { toast } from "sonner";

export const TaskDetailModal = ({
  task,
  open,
  onClose
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  if (!task) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="fixed right-0 top-0 z-50 h-screen w-[600px] overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-lift dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <button onClick={onClose} className="text-slate-500">Close</button>
          </div>
          <div className="space-y-3">
            <Input defaultValue={task.title} />
            <Textarea defaultValue={task.description} rows={4} />
            <SelectField value={task.status} onValueChange={() => {}} options={[{ value: "TODO", label: "Todo" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "DONE", label: "Done" }]} />
            <SelectField value={task.priority} onValueChange={() => {}} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }]} />
            <div className="space-y-2">
              {comments.map((comment) => <div key={comment.id} className="rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">{comment.content}</div>)}
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a comment" />
              <Button
                onClick={async () => {
                  if (!content.trim()) return;
                  const optimistic = { id: crypto.randomUUID(), author: "You", author_email: "you@company.com", content, created_at: new Date().toISOString() };
                  setComments((v) => [...v, optimistic]);
                  setContent("");
                  try {
                    await taskApi.post(`/api/tasks/${task.id}/comments`, { content: optimistic.content });
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
