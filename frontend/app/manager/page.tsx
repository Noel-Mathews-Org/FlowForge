"use client";

import { useMemo, useState } from "react";
import { Plus, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGrid } from "@/components/manager/ProjectGrid";
import { CreateProjectModal } from "@/components/manager/CreateProjectModal";
import { useProjects } from "@/hooks/useProjects";

export default function ManagerPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const projects = useProjects();

  const filtered = useMemo(() => {
    const list = projects.data ?? [];
    if (tab === "ALL") return list;
    if (tab === "ACTIVE") return list.filter((p) => !p.is_archived);
    return list.filter((p) => p.is_archived);
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
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Task Approvals
          </h3>
          <Link href="/manager/approvals">
            <Button variant="outline" size="sm">View All Approvals</Button>
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">Tasks pending your review from team members.</p>
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Go to the <Link href="/manager/approvals" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Approvals page</Link> to review pending tasks.</p>
        </div>
      </section>
      <CreateProjectModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
