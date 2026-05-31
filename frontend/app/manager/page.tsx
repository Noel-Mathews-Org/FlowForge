"use client";

import { useMemo, useState } from "react";
import { Plus, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGrid } from "@/components/manager/ProjectGrid";
import { CreateProjectModal } from "@/components/manager/CreateProjectModal";
import { useAllProjects } from "@/hooks/useProjects";
import { analyticsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

export default function ManagerPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const { data: allProjectsData, isLoading, isError, refetch } = useAllProjects();
  const user = getUser();

  const velocity = useQuery({
    queryKey: ["manager-velocity"],
    queryFn: async () => {
      const res = await analyticsApi.get(`/manager/dashboard?manager_id=${user?.sub ?? ""}`);
      return res.data;
    },
  });

  const filtered = useMemo(() => {
    const active = allProjectsData?.active ?? [];
    const archived = allProjectsData?.archived ?? [];
    const all = [...active, ...archived];
    
    if (tab === "ALL") return all;
    if (tab === "ACTIVE") return active;
    return archived;
  }, [allProjectsData, tab]);

  const velocityData = velocity.data?.team_velocity_weekly ?? [];
  const totalProjectsCount = (allProjectsData?.active?.length ?? 0) + (allProjectsData?.archived?.length ?? 0);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Projects <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-sm text-slate-500 dark:bg-slate-800">{totalProjectsCount}</span></h2>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Project</Button>
        </div>
        <div className="mb-4 flex gap-6 border-b border-slate-200 dark:border-slate-800">
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm ${tab === t ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500"}`}>{t[0] + t.slice(1).toLowerCase()}</button>
          ))}
        </div>
        {isLoading ? <Skeleton className="h-64" /> : isError ? <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Unable to load projects. <button className="underline" onClick={() => refetch()}>Retry</button></div> : <ProjectGrid projects={filtered} />}
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Team Velocity Line Chart */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Team Velocity (Last 8 Weeks)</h3>
          </div>
          {velocity.isLoading ? (
            <Skeleton className="h-52" />
          ) : velocityData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">No velocity data yet. Complete tasks to see trends.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Line type="monotone" dataKey="tasks_completed" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Tasks Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Project Status Stacked Bar */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-200">Project Status Overview</h3>
          {(() => {
            const projectList = [...(allProjectsData?.active ?? []), ...(allProjectsData?.archived ?? [])];
            const barData = projectList.slice(0, 8).map(p => ({
              name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
              members: p.member_count ?? 0,
              status: p.is_archived ? 0 : 1,
            }));
            if (!barData.length) return <div className="flex h-52 items-center justify-center text-sm text-slate-400">No projects created yet.</div>;
            return (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="members" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Members" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </section>
      </div>

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
