"use client";

import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";
import type { UserActivityStat } from "@/types";
import { Button } from "@/components/ui/button";

const color = {
  task_created: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  task_moved: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  task_deleted: "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
  comment_added: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
};

export const AuditTable = ({ rows }: { rows: UserActivityStat[] }) => {
  const [page, setPage] = useState(1);
  const paged = useMemo(() => rows.slice((page - 1) * 10, page * 10), [page, rows]);
  const maxPage = Math.max(1, Math.ceil(rows.length / 10));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr><th>Event</th><th>User</th><th>Project</th><th>Time</th></tr>
        </thead>
        <tbody>
          {paged.map((r, idx) => (
            <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-3"><span className={`rounded-full px-2 py-1 text-xs ${color[r.event_type]}`}>{r.event_type}</span></td>
              <td>{r.user}</td>
              <td>{r.project}</td>
              <td className="text-slate-500">{formatDistanceToNow(new Date(r.time), { addSuffix: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span className="text-xs text-slate-500">{page}/{maxPage}</span>
        <Button variant="outline" disabled={page === maxPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
};
