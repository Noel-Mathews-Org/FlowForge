"use client";

import { useEffect, useState } from "react";
import { Users, Briefcase, CheckCircle, TrendingUp, Loader2, Zap } from "lucide-react";
import { analyticsApi, aiApi, authApi } from "@/lib/api";
import { getUser, logout } from "@/lib/auth";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#7c3aed", "#a78bfa", "#e879f9", "#f472b6"];

export default function OrgOwnerPage() {
  const [overview, setOverview]   = useState<any>(null);
  const [summary, setSummary]     = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const user = getUser();

  useEffect(() => {
    if (user?.role !== "org_owner" && user?.role !== "platform_admin") {
      window.location.href = "/login"; return;
    }
    analyticsApi.get("/org/overview")
      .then(({ data }) => setOverview(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const generateSummary = async () => {
    if (!overview) return;
    setGenLoading(true);
    try {
      const { data } = await aiApi.post("/summarize-org", {
        projects: overview.project_throughput?.map((p: any) => ({
          name: p.project_id,
          total: p.tasks_created,
          completed: p.tasks_completed,
          in_progress: 0,
        })) ?? [],
        total_tasks: overview.total_tasks ?? 0,
        total_completed: overview.total_completed ?? 0,
      });
      setSummary(data.summary);
    } catch { setSummary("Unable to generate summary at this time."); }
    finally { setGenLoading(false); }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  const barData = overview?.project_throughput?.slice(0, 8).map((p: any) => ({
    name: p.project_id.slice(0, 8) + "…",
    completed: p.tasks_completed,
    created: p.tasks_created,
  })) ?? [];

  const pieData = [
    { name: "Completed", value: overview?.total_completed ?? 0 },
    { name: "Remaining", value: (overview?.total_tasks ?? 0) - (overview?.total_completed ?? 0) },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Tasks", value: overview?.total_tasks ?? 0, icon: Briefcase, color: "text-violet-600" },
            { label: "Completed", value: overview?.total_completed ?? 0, icon: CheckCircle, color: "text-emerald-600" },
            { label: "Completion Rate", value: `${overview?.overall_completion_rate ?? 0}%`, icon: TrendingUp, color: "text-blue-600" },
            { label: "Active Projects", value: overview?.project_throughput?.length ?? 0, icon: Users, color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <s.icon className={`h-5 w-5 ${s.color} mb-3`} />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="mt-1 text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Task Throughput by Project (30 days)</h2>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar dataKey="created" name="Created" fill="#e879f9" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400">No project data yet.</p>}
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Overall Completion</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">AI Organization Summary</h2>
            <button
              onClick={generateSummary}
              disabled={genLoading}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generate Summary
            </button>
          </div>
          {summary ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{summary}</p>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Click &ldquo;Generate Summary&rdquo; to get an AI analysis of your organization.</p>
          )}
        </div>
    </div>
  );
}
