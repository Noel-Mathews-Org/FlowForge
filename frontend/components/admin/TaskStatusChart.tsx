"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { KanbanBoard } from "@/types";

const colors = ["#94a3b8", "#f59e0b", "#22c55e"];

export const TaskStatusChart = ({ board }: { board: KanbanBoard }) => {
  const data = [
    { name: "TODO", value: board.TODO.length },
    { name: "IN_PROGRESS", value: board.IN_PROGRESS.length },
    { name: "DONE", value: board.DONE.length }
  ];
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Task Status Breakdown</h3>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="-mt-4 text-center text-xs text-slate-500">{total} total tasks</p>
      <div className="mt-3 space-y-1 text-xs">
        {data.map((d, i) => (
          <p key={d.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[i] }} /> {d.name} ({d.value})
          </p>
        ))}
      </div>
    </div>
  );
};
