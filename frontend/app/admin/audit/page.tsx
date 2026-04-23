"use client";

import { useAudit } from "@/hooks/useAnalytics";
import { AuditTable } from "@/components/admin/AuditTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function AdminAuditPage() {
  const audit = useAudit();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Audit Log</h2>
        <p className="text-sm text-slate-500">Track all events across your workspace</p>
      </div>

      {audit.isLoading ? (
        <Skeleton className="h-96" />
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
