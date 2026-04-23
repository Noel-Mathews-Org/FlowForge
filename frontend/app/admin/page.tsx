"use client";

import { format } from "date-fns";
import { OverviewCards } from "@/components/admin/OverviewCards";
import { ThroughputChart } from "@/components/admin/ThroughputChart";
import { AuditTable } from "@/components/admin/AuditTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsOverview, useAudit, useThroughput } from "@/hooks/useAnalytics";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const user = getUser();
  const overview = useAnalyticsOverview();
  const throughput = useThroughput(7);
  const audit = useAudit();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Good morning, {user?.full_name?.split(" ")[0]}</h2>
        <p className="text-sm text-slate-500">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      {/* Overview Cards — independent error boundary */}
      {overview.isLoading ? (
        <Skeleton className="h-28" />
      ) : overview.isError || !overview.data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
          Overview metrics failed to load.
          <Button variant="outline" className="ml-3" onClick={() => overview.refetch()}>Retry</Button>
        </div>
      ) : (
        <OverviewCards overview={overview.data} />
      )}

      {/* Charts — independent */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          {throughput.isLoading ? (
            <Skeleton className="h-72" />
          ) : throughput.isError || !throughput.data ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
              Throughput chart failed to load.
              <Button variant="outline" className="ml-3" onClick={() => throughput.refetch()}>Retry</Button>
            </div>
          ) : (
            <ThroughputChart data={throughput.data} />
          )}
        </div>
      </div>

      {/* Audit Table — independent */}
      {audit.isLoading ? (
        <Skeleton className="h-64" />
      ) : audit.isError || !audit.data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20">
          Audit events failed to load.
          <Button variant="outline" className="ml-3" onClick={() => audit.refetch()}>Retry</Button>
        </div>
      ) : (
        <AuditTable rows={audit.data} />
      )}
    </div>
  );
}
