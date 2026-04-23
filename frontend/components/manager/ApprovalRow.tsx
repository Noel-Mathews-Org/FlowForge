"use client";

import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";
import { ApprovalRequest } from "@/types";
import { Button } from "@/components/ui/button";

export const ApprovalRow = ({
  approval,
  onApprove,
  onReject
}: {
  approval: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) => {
  const [confirmReject, setConfirmReject] = useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
        {approval.requester_name.split(" ").map((n) => n[0]).join("")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-700 dark:text-slate-200">
          <strong>{approval.requester_email}</strong> requested access to <strong>{approval.project_name}</strong>
        </p>
        <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}</p>
      </div>
      {!confirmReject ? (
        <div className="flex gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onApprove(approval.id)}>Approve</Button>
          <Button variant="danger" onClick={() => setConfirmReject(true)}>Reject</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <span>Are you sure?</span>
          <button className="text-rose-600" onClick={() => onReject(approval.id)}>Confirm</button>
          <button className="text-slate-500" onClick={() => setConfirmReject(false)}>Cancel</button>
        </div>
      )}
    </motion.div>
  );
};
