"use client";

import { useEffect, useState } from "react";
import { Users, Briefcase, CheckCircle, TrendingUp, Loader2, Zap } from "lucide-react";
import { analyticsApi, aiApi, authApi } from "@/lib/api";
import { getUser, logout } from "@/lib/auth";
import { useAllProjects } from "@/hooks/useProjects";
import { ThroughputChart } from "@/components/admin/ThroughputChart";
import { RolePieChart } from "@/components/admin/RolePieChart";
import { useThroughput } from "@/hooks/useAnalytics";

export default function OrgOwnerPage() {
  const [overview, setOverview]   = useState<any>(null);
  const [summary, setSummary]     = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const user = getUser();
  const throughput = useThroughput(7);
  const { data: allProjectsData } = useAllProjects();
  const projectsData = [...(allProjectsData?.active ?? []), ...(allProjectsData?.archived ?? [])];

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
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="lg:col-span-8">
            {throughput.isLoading ? (
              <div className="h-[400px] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : throughput.isError || !throughput.data ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10">
                <p className="text-sm font-semibold">Throughput metrics are temporarily unavailable.</p>
              </div>
            ) : (
              <ThroughputChart data={throughput.data} />
            )}
          </section>

          <section className="lg:col-span-4">
            {overview?.tasks_by_status ? (
              <RolePieChart tasksByStatus={overview.tasks_by_status} />
            ) : (
              <div className="h-[300px] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            )}
          </section>
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
