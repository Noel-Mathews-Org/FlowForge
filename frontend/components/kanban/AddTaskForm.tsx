"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

import type { ProjectMember } from "@/types";

export const AddTaskForm = ({ 
  onSubmit, 
  isManager, 
  members = [] 
}: { 
  onSubmit: (title: string, priority: "LOW" | "MEDIUM" | "HIGH", assigneeId?: string, assigneeEmail?: string) => Promise<void>;
  isManager?: boolean;
  members?: ProjectMember[];
}) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [loading, setLoading] = useState(false);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="space-y-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SelectField value={priority} onValueChange={setPriority} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }]} />
        {isManager && (
          <SelectField 
            value={assigneeId} 
            onValueChange={setAssigneeId} 
            options={[
              { value: "unassigned", label: "Unassigned" },
              ...members.map(m => ({ value: m.user_id, label: m.user_email }))
            ]} 
          />
        )}
      </div>
      <Button
        disabled={loading || !title.trim()}
        className="w-full"
        onClick={async () => {
          setLoading(true);
          const assignedUser = members.find(m => m.user_id === assigneeId);
          await onSubmit(
            title, 
            priority as "LOW" | "MEDIUM" | "HIGH", 
            assigneeId !== "unassigned" ? assigneeId : undefined,
            assigneeId !== "unassigned" ? assignedUser?.user_email : undefined
          );
          setTitle("");
          setPriority("MEDIUM");
          setAssigneeId("unassigned");
          setLoading(false);
        }}
      >
        {loading ? "Adding..." : "Add Task"}
      </Button>
    </motion.div>
  );
};
