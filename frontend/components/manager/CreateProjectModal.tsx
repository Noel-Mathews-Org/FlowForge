"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectApi } from "@/lib/api";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const CreateProjectModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const client = useQueryClient();

  const submit = async () => {
    if (name.trim().length < 2) return;
    setLoading(true);
    try {
      await projectApi.post("/api/projects/", { name, description });
      await client.invalidateQueries({ queryKey: ["projects"] });
      setName("");
      setDescription("");
      onOpenChange(false);
      toast.success("Project created");
    } catch {
      toast.error("Could not create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Project">
      <div className="mb-3 flex items-center gap-2 text-slate-500"><FolderPlus className="h-4 w-4 text-indigo-600" /> Create a new project workspace</div>
      <div className="space-y-3">
        <div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" minLength={2} />
          <p className="mt-1 text-right text-xs text-slate-400">{name.length} chars</p>
        </div>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} />
        <Button onClick={submit} disabled={loading || name.length < 2} className="w-full">{loading ? "Creating..." : "Create Project"}</Button>
      </div>
    </Modal>
  );
};
