"use client";

import { useQuery } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { Cpu, DollarSign, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type UsageEntry = { timestamp: string; tokens_used: number; cost_usd: number };
type UsageData = {
  total_tokens_this_month: number;
  estimated_cost_usd: number;
  total_requests: number;
  entries: UsageEntry[];
  ai_configured: boolean;
};

export const AiCostCard = () => {
  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ["ai-usage"],
    queryFn: async () => (await aiApi.get("/usage")).data,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }

  const usage = data ?? { total_tokens_this_month: 0, estimated_cost_usd: 0, total_requests: 0, entries: [], ai_configured: false };

  // Group entries by day for chart
  const byDay: Record<string, number> = {};
  for (const e of usage.entries) {
    const day = e.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + e.tokens_used;
  }
  const chartData = Object.entries(byDay).map(([day, tokens]) => ({ day: day.slice(5), tokens }));

  const cards = [
    { label: "Tokens This Month", value: usage.total_tokens_this_month.toLocaleString(), icon: Zap, color: "text-violet-500" },
    { label: "Est. Cost (USD)", value: `$${usage.estimated_cost_usd.toFixed(4)}`, icon: DollarSign, color: "text-emerald-500" },
    { label: "AI Requests", value: usage.total_requests.toString(), icon: Cpu, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">AI Cost Monitoring</h3>
      {!usage.ai_configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          AI provider not configured — showing tracked usage only.
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{c.value}</p>
          </div>
        ))}
      </div>
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="mb-3 text-xs font-medium text-slate-500">Daily Token Usage</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="tokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
