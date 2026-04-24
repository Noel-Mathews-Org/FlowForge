"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ArrowRight, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";
import { useTaskApprovals, useApproveTask, useRejectTask } from "@/hooks/useApprovals";
import { toast } from "sonner";
import type { Task } from "@/types";

function ProjectApprovals({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { data: tasks, isLoading, isError, refetch } = useTaskApprovals(projectId);
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();

  if (isLoading) return <Skeleton className="h-24" />;
  if (isError) return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
      Unable to load approvals for {projectName}.
      <Button variant="outline" className="ml-3" onClick={() => refetch()}>Retry</Button>
    </div>
  );
  if (!tasks || tasks.length === 0) return null;

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
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{projectName}</h3>
      {tasks.map((task) => (
        <div key={task.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{task.title}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>By: {task.created_by_email || "Unknown"}</span>
              <span>•</span>
              <span>Current: <span className="font-semibold text-slate-700 dark:text-slate-300">{task.status}</span></span>
              {task.proposed_status && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    Proposed: <ArrowRight className="h-3 w-3" />
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{task.proposed_status}</span>
                  </span>
                </>
              )}
            </div>
            <div className="mt-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${task.proposed_status ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                {task.proposed_status ? "Status Change Request" : "New Task (Pending Activation)"}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleApprove(task)}
              disabled={approveTask.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
              onClick={() => handleReject(task)}
              disabled={rejectTask.isPending}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ManagerApprovalsPage() {
  const projects = useProjects();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Task Approvals
        </h2>
        <p className="text-sm text-slate-500">Review pending tasks and status change requests from team members</p>
      </div>

      {projects.isLoading ? (
        <Skeleton className="h-64" />
      ) : projects.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
          Unable to load projects.
          <Button variant="outline" className="ml-3" onClick={() => projects.refetch()}>Retry</Button>
        </div>
      ) : !projects.data || projects.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-700 dark:text-slate-200">No projects found</p>
          <p className="text-sm text-slate-500">Create a project first to see approvals.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {projects.data.map((project) => (
            <ProjectApprovals key={project.id} projectId={project.id} projectName={project.name} />
          ))}
          {/* Show empty state if rendered but no approvals found in any project */}
        </div>
      )}
    </div>
  );
}
