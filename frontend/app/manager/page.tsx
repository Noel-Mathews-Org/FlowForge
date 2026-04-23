"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGrid } from "@/components/manager/ProjectGrid";
import { CreateProjectModal } from "@/components/manager/CreateProjectModal";
import { ApprovalsPanel } from "@/components/manager/ApprovalsPanel";
import { useApprovals } from "@/hooks/useApprovals";
import { useProjects } from "@/hooks/useProjects";

export default function ManagerPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const projects = useProjects();
  const approvals = useApprovals();

  const filtered = useMemo(() => {
    if (!projects.data) return [];
    if (tab === "ALL") return projects.data;
    return projects.data.filter((p) => p.status === tab);
  }, [projects.data, tab]);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Projects <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-sm text-slate-500 dark:bg-slate-800">{projects.data?.length ?? 0}</span></h2>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Project</Button>
        </div>
        <div className="mb-4 flex gap-6 border-b border-slate-200 dark:border-slate-800">
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm ${tab === t ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500"}`}>{t[0] + t.slice(1).toLowerCase()}</button>
          ))}
        </div>
        {projects.isLoading ? <Skeleton className="h-64" /> : projects.isError ? <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Unable to load projects. <button className="underline" onClick={() => projects.refetch()}>Retry</button></div> : <ProjectGrid projects={filtered} />}
      </section>

      <section id="approvals">
        <h3 className="mb-3 text-xl font-semibold text-slate-900 dark:text-slate-100">Access Requests <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-600"><span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse-dot" />{approvals.data?.length ?? 0}</span></h3>
        {approvals.isLoading ? <Skeleton className="h-40" /> : approvals.isError ? <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Unable to load approvals. <button className="underline" onClick={() => approvals.refetch()}>Retry</button></div> : <ApprovalsPanel approvals={approvals.data ?? []} />}
      </section>
      <CreateProjectModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
