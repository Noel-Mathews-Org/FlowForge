"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { projectApi } from "@/lib/api";
import { toast } from "sonner";

export const AddMemberModal = ({
  projectId,
  open,
  onClose,
  onSuccess
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleAdd = async () => {
    if (!email.trim()) return;
    setLoading(true);
    
    try {
      const res = await projectApi.post(`/${projectId}/members`, { email });
      toast.success(res.data?.message || "Member added successfully");
      setEmail("");
      onSuccess();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail[0]?.msg : detail;
      toast.error(errorMsg || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Project Member</h3>
          <p className="mb-4 text-sm text-slate-500">Enter the email address of the person you want to invite.</p>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button onClick={handleAdd} disabled={loading || !email.trim()}>
                {loading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
