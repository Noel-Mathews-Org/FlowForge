"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskApprovals, useApproveTask, useRejectTask } from "@/hooks/useApprovals";
import { toast } from "sonner";
import type { Task } from "@/types";

export const ApprovalsPanel = ({ projectId }: { projectId: string }) => {
  const { data: tasks, isLoading, isError, refetch } = useTaskApprovals(projectId);
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
        Unable to load pending approvals.
        <Button variant="outline" className="ml-3" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <svg className="mx-auto h-14 w-14" viewBox="0 0 80 80"><circle cx="40" cy="40" r="28" fill="#e2e8f0" /><path d="M27 40l9 9 17-17" stroke="#4f46e5" strokeWidth="4" fill="none" /></svg>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">No pending approvals</p>
        <p className="text-sm text-slate-500">All tasks have been reviewed</p>
      </div>
    );
  }

  const handleApprove = async (task: Task) => {
    try {
      await approveTask.mutateAsync(task.id);
      toast.success(`Approved: ${task.title}`);
    } catch {
      toast.error("Failed to approve task");
    }
  };

  const handleReject = async (task: Task) => {
    try {
      await rejectTask.mutateAsync(task.id);
      toast.success(`Rejected: ${task.title}`);
    } catch {
      toast.error("Failed to reject task");
    }
  };

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800 dark:text-slate-200">{task.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-0.5">
                  <span>{task.created_by_email || "Unknown"}</span>
                  {task.proposed_status && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {task.status} <ArrowRight className="h-3 w-3" /> <span className="font-semibold text-indigo-600 dark:text-indigo-400">{task.proposed_status}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(task)} disabled={approveTask.isPending}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400" onClick={() => handleReject(task)} disabled={rejectTask.isPending}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
