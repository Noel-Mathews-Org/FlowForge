"use client";

import { format } from "date-fns";
import { OverviewCards } from "@/components/admin/OverviewCards";
import { ThroughputChart } from "@/components/admin/ThroughputChart";
import { TaskStatusChart } from "@/components/admin/TaskStatusChart";
import { AuditTable } from "@/components/admin/AuditTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsOverview, useAudit, useThroughput } from "@/hooks/useAnalytics";
import { useTasks } from "@/hooks/useTasks";
import { mockProjects } from "@/lib/mock-data";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const user = getUser();
  const overview = useAnalyticsOverview();
  const throughput = useThroughput(7);
  const audit = useAudit();
  const board = useTasks(mockProjects[0].id);

  if (overview.isLoading || throughput.isLoading || audit.isLoading || board.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /><Skeleton className="h-64" /></div>;
  }

  if (overview.isError || throughput.isError || audit.isError || board.isError || !overview.data || !throughput.data || !audit.data || !board.data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
        Analytics failed to load.
        <Button className="ml-3" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Good morning, {user?.full_name?.split(" ")[0]}</h2>
        <p className="text-sm text-slate-500">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>
      <OverviewCards overview={overview.data} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8"><ThroughputChart data={throughput.data} /></div>
        <div className="col-span-4"><TaskStatusChart board={board.data} /></div>
      </div>
      <AuditTable rows={audit.data} />
    </div>
  );
}
