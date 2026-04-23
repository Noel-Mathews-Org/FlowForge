"use client";

import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectApi } from "@/lib/api";
import type { ApprovalRequest } from "@/types";
import { ApprovalRow } from "@/components/manager/ApprovalRow";

export const ApprovalsPanel = ({ approvals }: { approvals: ApprovalRequest[] }) => {
  const [optimistic, setOptimistic] = useState(approvals);
  const client = useQueryClient();

  const act = async (id: string, action: "APPROVED" | "REJECTED") => {
    const prev = optimistic;
    setOptimistic((v) => v.filter((a) => a.id !== id));
    try {
      await projectApi.patch(`/api/projects/approvals/${id}`, { action });
      await client.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(`Request ${action.toLowerCase()}`);
    } catch {
      setOptimistic(prev);
      toast.error("Action failed, please retry");
    }
  };

  if (!optimistic.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <svg className="mx-auto h-14 w-14" viewBox="0 0 80 80"><circle cx="40" cy="40" r="28" fill="#e2e8f0" /><path d="M27 40l9 9 17-17" stroke="#4f46e5" strokeWidth="4" fill="none" /></svg>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">No pending requests</p>
        <p className="text-sm text-slate-500">Team members can request access to projects</p>
      </div>
    );
  }

  return <div className="space-y-3"><AnimatePresence>{optimistic.map((approval) => <ApprovalRow key={approval.id} approval={approval} onApprove={(id) => act(id, "APPROVED")} onReject={(id) => act(id, "REJECTED")} />)}</AnimatePresence></div>;
};
