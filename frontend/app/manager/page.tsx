"use client";

import { useMemo, useState } from "react";
import {
  Plus, Clock, TrendingUp, FolderKanban, Users, CheckCircle,
  ListTodo, BarChart3, Activity, ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGrid } from "@/components/manager/ProjectGrid";
import { CreateProjectModal } from "@/components/manager/CreateProjectModal";
import { useAllProjects } from "@/hooks/useProjects";
import { analyticsApi, authApi, projectApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444"];

export default function ManagerPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const { data: allProjectsData, isLoading, isError, refetch } = useAllProjects();
  const user = getUser();

  // Fetch team members for real count
  const team = useQuery({
    queryKey: ["manager-team"],
    queryFn: async () => {
      const res = await authApi.get("/users/team");
      const data = Array.isArray(res.data) ? res.data : res.data.users ?? [];
      // Exclude self
      return data.filter((m: any) => m.id !== user?.sub);
    },
  });

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

  const activeProjects = allProjectsData?.active ?? [];
  const archivedProjects = allProjectsData?.archived ?? [];
  const totalProjectsCount = activeProjects.length + archivedProjects.length;

  // Real team member count
  const teamMembers = team.data ?? [];
  const totalTeamMembers = teamMembers.length;
  const activeMembers = teamMembers.filter((m: any) => m.is_active).length;

  // Compute total members across projects (unique members involved in active projects)
  const totalProjectMembers = activeProjects.reduce((acc: number, p: any) => acc + (p.member_count ?? 0), 0);

  // Task status distribution from velocity data
  const totalTasksCompleted = velocityData.reduce((a: number, v: any) => a + (v.tasks_completed ?? 0), 0);

  // Project member distribution for pie chart
  const projectDistribution = activeProjects.slice(0, 6).map((p: any) => ({
    name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
    value: p.member_count ?? 0,
  }));

  // Weekly completion trend
  const weeklyCompletionData = velocityData.map((v: any) => ({
    week: v.week?.slice(5) || v.week,
    completed: v.tasks_completed ?? 0,
  }));

  return (
    <div className="space-y-8">
      {/* ── Metric Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
              <FolderKanban className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
              {activeProjects.length} active <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{totalProjectsCount}</p>
          <p className="text-xs font-medium text-slate-500">Total Projects</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/20">
              <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-bold text-violet-600">{activeMembers} active</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{totalTeamMembers}</p>
          <p className="text-xs font-medium text-slate-500">Team Members</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
              <Activity className="h-3 w-3" /> 8 weeks
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{totalTasksCompleted}</p>
          <p className="text-xs font-medium text-slate-500">Tasks Completed</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <ListTodo className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{totalProjectMembers}</p>
          <p className="text-xs font-medium text-slate-500">Project Assignments</p>
        </div>
      </div>

      {/* ── Analytics Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Team Velocity Line Chart */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Team Velocity (Last 8 Weeks)</h3>
          </div>
          {velocity.isLoading ? (
            <Skeleton className="h-52" />
          ) : weeklyCompletionData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">No velocity data yet. Complete tasks to see trends.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Line type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} name="Tasks Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Project Member Distribution Pie */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Member Distribution by Project</h3>
          </div>
          {(() => {
            if (!projectDistribution.length || projectDistribution.every((d: any) => d.value === 0)) {
              return <div className="flex h-52 items-center justify-center text-sm text-slate-400">No project data available.</div>;
            }
            return (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {projectDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </section>
      </div>

      {/* ── Project Status Bar Chart ──────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          Project Members Overview
        </h3>
        {(() => {
          const projectList = [...activeProjects, ...archivedProjects];
          const barData = projectList.slice(0, 8).map((p: any) => ({
            name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
            members: p.member_count ?? 0,
            archived: p.is_archived ? 1 : 0,
          }));
          if (!barData.length) return <div className="flex h-52 items-center justify-center text-sm text-slate-400">No projects created yet.</div>;
          return (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="members" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Members" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </section>

      {/* ── Projects Section ──────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Projects <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-sm text-slate-500 dark:bg-slate-800">{totalProjectsCount}</span>
          </h2>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Project</Button>
        </div>
        <div className="mb-4 flex gap-6 border-b border-slate-200 dark:border-slate-800">
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium transition-colors ${tab === t ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}>{t[0] + t.slice(1).toLowerCase()}</button>
          ))}
        </div>
        {isLoading ? <Skeleton className="h-64" /> : isError ? <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Unable to load projects. <button className="underline" onClick={() => refetch()}>Retry</button></div> : <ProjectGrid projects={filtered} />}
      </section>

      {/* ── Task Approvals Section ─────────────────────────────────────── */}
      <section>
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
