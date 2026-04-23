"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";

export const AddTaskForm = ({ onSubmit }: { onSubmit: (title: string, priority: "LOW" | "MEDIUM" | "HIGH") => Promise<void> }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="space-y-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
      <SelectField value={priority} onValueChange={setPriority} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }]} />
      <Button
        disabled={loading || !title.trim()}
        className="w-full"
        onClick={async () => {
          setLoading(true);
          await onSubmit(title, priority as "LOW" | "MEDIUM" | "HIGH");
          setTitle("");
          setPriority("MEDIUM");
          setLoading(false);
        }}
      >
        {loading ? "Adding..." : "Add Task"}
      </Button>
    </motion.div>
  );
};
