"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { analyticsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

const PIE_COLORS = ["#6366f1", "#f59e0b", "#22c55e"];

export default function DashboardPage() {
  const projects = useProjects();
  const [selected, setSelected] = useState<string>("");
  const user = getUser();

  const projectList = projects.data ?? [];
  const selectedProject = selected || projectList[0]?.id;
  const tasks = useTasks(selectedProject);

  const memberStats = useQuery({
    queryKey: ["member-stats"],
    queryFn: async () => (await analyticsApi.get("/member/dashboard")).data,
  });

  const options = useMemo(
    () => projectList.map((p) => ({ value: p.id, label: p.name })),
    [projectList]
  );

  // Derive task status counts from current board data
  const statusData = useMemo(() => {
    if (!tasks.data) return [];
    const board = tasks.data;
    return [
      { name: "TODO", value: board.TODO?.length ?? 0 },
      { name: "In Progress", value: board.IN_PROGRESS?.length ?? 0 },
      { name: "Done", value: board.DONE?.length ?? 0 },
    ].filter(d => d.value > 0);
  }, [tasks.data]);

  const weeklyData = memberStats.data?.weekly_completion ?? [];

  if (projects.isLoading) return <Skeleton className="h-12 w-72" />;

  if (projects.isError) {
    return (
      <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
        Could not load projects.{" "}
        <button onClick={() => projects.refetch()} className="underline">Retry</button>
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
        No projects assigned yet. Contact your manager to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {memberStats.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Tasks Created", value: memberStats.data.tasks_created, color: "border-indigo-500" },
            { label: "Tasks Completed", value: memberStats.data.tasks_completed, color: "border-emerald-500" },
            { label: "Completion Rate", value: `${memberStats.data.completion_rate}%`, color: "border-amber-500" },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border-l-4 ${c.color} border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Completion Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Weekly Completions (Last 5 Weeks)</h3>
          {weeklyData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">All caught up! No tasks assigned. Great job!</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="completed" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status Pie */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Task Status Distribution</h3>
          {statusData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">No tasks to display.</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} strokeWidth={0}>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Project selector + Kanban */}
      <div className="max-w-sm">
        <select
          value={selectedProject ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {!selectedProject ? (
        <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          Select a project to view its board.
        </div>
      ) : tasks.isLoading ? (
        <Skeleton className="h-[560px]" />
      ) : tasks.isError || !tasks.data ? (
        <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
          Board failed to load.{" "}
          <button className="underline" onClick={() => tasks.refetch()}>Retry</button>
        </div>
      ) : (
        <KanbanBoard initialBoard={tasks.data} projectId={selectedProject} />
      )}
    </div>
  );
}