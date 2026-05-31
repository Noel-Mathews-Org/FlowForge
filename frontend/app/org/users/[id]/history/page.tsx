"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

type HistoryEvent = {
  id: string;
  event_type: string;
  occurred_at: string;
  project_id?: string;
  metadata?: Record<string, unknown>;
};

export default function UserHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    if (user?.role !== "org_owner" && user?.role !== "platform_admin") {
      router.replace("/login"); return;
    }
    authApi.get(`/users/${id}/history`).then(({ data }) => {
      setEvents(Array.isArray(data) ? data : data.items ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const label = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const typeColor: Record<string, string> = {
    task_created:      "bg-blue-100 text-blue-700",
    task_moved:        "bg-amber-100 text-amber-700",
    approval_resolved: "bg-emerald-100 text-emerald-700",
    member_transferred:"bg-violet-100 text-violet-700",
    project_created:   "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">User Activity History</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Clock className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-500">No activity recorded for this user.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => (
            <div key={e.id}
              className="flex items-start gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Clock className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeColor[e.event_type] ?? "bg-slate-100 text-slate-600"}`}>
                    {label(e.event_type)}
                  </span>
                  {e.project_id && (
                    <span className="text-xs text-slate-400">Project: {e.project_id.slice(0, 8)}…</span>
                  )}
                </div>
                {e.metadata && Object.keys(e.metadata).length > 0 && (
                  <p className="mt-1 text-xs text-slate-500 truncate">
                    {Object.entries(e.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </p>
                )}
              </div>
              <time className="shrink-0 text-xs text-slate-400">
                {new Date(e.occurred_at).toLocaleString()}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
