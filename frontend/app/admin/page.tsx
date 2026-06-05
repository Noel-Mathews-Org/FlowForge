"use client";

import { format } from "date-fns";
import { SystemMetricsCards } from "@/components/admin/SystemMetricsCards";
import { PlatformHealthChart } from "@/components/admin/PlatformHealthChart";
import { AiCostCard } from "@/components/admin/AiCostCard";
import { AuditTable } from "@/components/admin/AuditTable";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformHealth, useAudit } from "@/hooks/useAnalytics";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

export default function AdminPage() {
  const user = getUser();
  const health = usePlatformHealth();
  const audit = useAudit();

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System Intelligence
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Real-time analytics and audit monitoring for FlowForge.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden flex-col items-end text-right md:flex">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{format(new Date(), "EEEE")}</span>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{format(new Date(), "MMMM d, yyyy")}</span>
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => window.location.reload()}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <section>
        {health.isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : health.isError || !health.data ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10">
            <p className="text-sm font-semibold">Intelligence core failed to respond.</p>
            <Button variant="outline" size="sm" className="mt-4 border-rose-200" onClick={() => health.refetch()}>Re-initialize</Button>
          </div>
        ) : (
          <SystemMetricsCards healthData={health.data} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Latency Chart */}
        <section className="lg:col-span-12">
          {health.isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : health.isError || !health.data ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10">
              <p className="text-sm font-semibold">Health metrics are temporarily unavailable.</p>
              <Button variant="outline" size="sm" className="mt-4 border-rose-200" onClick={() => health.refetch()}>Retry Sync</Button>
            </div>
          ) : (
            <PlatformHealthChart healthData={health.data} />
          )}
        </section>
      </div>

      {/* AI Cost Monitoring */}
      <section>
        <AiCostCard />
      </section>

      {/* Audit Table */}
      <section>
        <div className="mb-4 flex items-center justify-between px-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Security Audit Log</h3>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        {audit.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : audit.isError || !audit.data ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10">
            <p className="text-sm font-semibold">Audit stream interrupted.</p>
            <Button variant="outline" size="sm" className="mt-4 border-rose-200" onClick={() => audit.refetch()}>Re-connect</Button>
          </div>
        ) : (
          <AuditTable rows={audit.data} />
        )}
      </section>
    </div>
  );
}
