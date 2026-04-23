"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authApi, projectApi } from "@/lib/api";
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
      let userId: string | null = null;
      try {
        const lookup = await authApi.get(`/lookup?email=${encodeURIComponent(email)}`);
        userId = lookup.data.id;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const inviteRes = await authApi.post("/invite-to-project", { email });
          userId = inviteRes.data.user_id;
          toast.success("User account created and invite sent");
        } else {
          throw err;
        }
      }

      if (userId) {
        await projectApi.post(`/${projectId}/members`, {
          user_id: userId,
          user_email: email
        });
        toast.success("Member added successfully");
        setEmail("");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add member");
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
