"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { projectApi, authApi } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, UserPlus } from "lucide-react";

type TeamUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

export const AddMemberModal = ({
  projectId,
  open,
  onClose,
  onSuccess,
  existingMemberIds = [],
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingMemberIds?: string[];
}) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  if (!open) return null;

  const existingSet = new Set(existingMemberIds);
  const availableMembers = teamMembers.filter((m) => !existingSet.has(m.id));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setLoading(true);

    try {
      const selectedUser = teamMembers.find((m) => m.id === selectedUserId);
      const res = await projectApi.post(`/${projectId}/members`, {
        user_id: selectedUserId,
        email: selectedUser?.email,
      });
      toast.success(res.data?.message || "Member added successfully");
      setSelectedUserId("");
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
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            Add Project Member
          </h3>
          <p className="mb-4 text-sm text-slate-500 mt-1">Select a team member to add to this project.</p>
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
                      All your team members are already in this project, or you don&apos;t have any team members assigned yet.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Choose a member…</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { onClose(); setSelectedUserId(""); }} disabled={loading}>Cancel</Button>
              <Button onClick={handleAdd} disabled={loading || !selectedUserId}>
                {loading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
