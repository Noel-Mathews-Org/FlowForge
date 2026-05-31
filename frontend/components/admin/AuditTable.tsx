"use client";

import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";
import type { AuditEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";

const color: Record<string, string> = {
  task_created: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  task_moved: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  task_deleted: "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
  comment_added: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  project_created: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  approval_requested: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
  approval_resolved: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300",
};

export const AuditTable = ({ rows }: { rows: AuditEvent[] }) => {
  const [page, setPage] = useState(1);
  const projectsQuery = useProjects();
  const safe = rows ?? [];
  const paged = useMemo(() => safe.slice((page - 1) * 10, page * 10), [page, safe]);
  const maxPage = Math.max(1, Math.ceil(safe.length / 10));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 font-semibold uppercase tracking-wider">Event</th>
              <th className="px-6 py-4 font-semibold uppercase tracking-wider">User</th>
              <th className="px-6 py-4 font-semibold uppercase tracking-wider">Project</th>
              <th className="px-6 py-4 font-semibold uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paged.map((r, idx) => (
              <tr key={r.id ?? idx} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight ${color[r.event_type] ?? "bg-slate-100 text-slate-600"}`}>
                    {r.event_type.replace("_", " ")}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{r.user_email}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                    {r.project_id 
                      ? (projectsQuery.data?.find(p => p.id === r.project_id)?.name || r.project_id.slice(0, 8))
                      : "SYSTEM"}
                  </code>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  {formatDistanceToNow(new Date(r.occurred_at), { addSuffix: true })}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>No audit events found</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {safe.length > 10 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{(page - 1) * 10 + 1}</span> to <span className="font-semibold text-slate-900 dark:text-slate-100">{Math.min(page * 10, safe.length)}</span> of <span className="font-semibold text-slate-900 dark:text-slate-100">{safe.length}</span> entries
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1} 
              onClick={() => setPage((p) => p - 1)}
              className="h-8 rounded-lg text-xs"
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === maxPage} 
              onClick={() => setPage((p) => p + 1)}
              className="h-8 rounded-lg text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
