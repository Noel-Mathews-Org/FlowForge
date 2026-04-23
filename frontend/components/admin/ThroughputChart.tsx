"use client";

import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ThroughputDataPoint } from "@/types";

export const ThroughputChart = ({ data }: { data: ThroughputDataPoint[] }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
    <h3 className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-200">Task Throughput</h3>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="created" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} /><stop offset="100%" stopColor="#818cf8" stopOpacity={0.05} /></linearGradient>
            <linearGradient id="done" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "EEE")} stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
            labelFormatter={(v) => format(new Date(v), "MMM d")}
          />
          <Area type="monotone" dataKey="tasks_created" stroke="#818cf8" fill="url(#created)" strokeWidth={2} />
          <Area type="monotone" dataKey="tasks_completed" stroke="#22c55e" fill="url(#done)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);
