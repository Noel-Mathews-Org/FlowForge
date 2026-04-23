"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ApprovalsPanel } from "@/components/manager/ApprovalsPanel";
import { useApprovals } from "@/hooks/useApprovals";

export default function ManagerApprovalsPage() {
  const approvals = useApprovals();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Access Requests
          <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-sm text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse-dot" />
            {approvals.data?.length ?? 0}
          </span>
        </h2>
        <p className="text-sm text-slate-500">Review and manage project access requests</p>
      </div>

      {approvals.isLoading ? (
        <Skeleton className="h-64" />
      ) : approvals.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
          Unable to load approvals.
          <Button variant="outline" className="ml-3" onClick={() => approvals.refetch()}>Retry</Button>
        </div>
      ) : (
        <ApprovalsPanel approvals={approvals.data ?? []} />
      )}
    </div>
  );
}
