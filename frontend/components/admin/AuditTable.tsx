"use client";

import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";
import type { AuditEvent } from "@/types";
import { Button } from "@/components/ui/button";

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
  const safe = rows ?? [];
  const paged = useMemo(() => safe.slice((page - 1) * 10, page * 10), [page, safe]);
  const maxPage = Math.max(1, Math.ceil(safe.length / 10));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr><th className="pb-2">Event</th><th className="pb-2">User</th><th className="pb-2">Project</th><th className="pb-2">Time</th></tr>
        </thead>
        <tbody>
          {paged.map((r, idx) => (
            <tr key={r.id ?? idx} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-3"><span className={`rounded-full px-2 py-1 text-xs ${color[r.event_type] ?? "bg-slate-100 text-slate-600"}`}>{r.event_type}</span></td>
              <td>{r.user_email}</td>
              <td className="max-w-[120px] truncate">{r.project_id ?? "—"}</td>
              <td className="text-slate-500">{formatDistanceToNow(new Date(r.occurred_at), { addSuffix: true })}</td>
            </tr>
          ))}
          {paged.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-slate-400">No audit events found</td></tr>
          )}
        </tbody>
      </table>
      {safe.length > 10 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-slate-500">{page}/{maxPage}</span>
          <Button variant="outline" disabled={page === maxPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};
