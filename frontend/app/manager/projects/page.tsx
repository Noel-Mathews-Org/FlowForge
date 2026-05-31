"use client";

import { useEffect, useState } from "react";
import { Plus, FolderKanban, Archive, Loader2 } from "lucide-react";
import { projectApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Link from "next/link";

type Project = { id: string; name: string; description: string; is_archived: boolean; member_count?: number };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const user = getUser();

  useEffect(() => {
    projectApi.get("/").then(({ data }) => setProjects(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const active   = projects.filter(p => !p.is_archived);
  const archived = projects.filter(p => p.is_archived);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Projects</h2>
          <p className="text-sm text-slate-500 mt-1">{active.length} active · {archived.length} archived</p>
        </div>
        {(user?.role === "manager" || user?.role === "platform_admin") && (
          <Link href="/manager/projects/create"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            <Plus className="h-4 w-4" /> New Project
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 dark:border-slate-700">
          <FolderKanban className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">No projects assigned</p>
          <p className="text-sm text-slate-400 mt-1">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map(p => (
            <Link key={p.id} href={`/manager/projects/${p.id}`}
              className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-700">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                  <FolderKanban className="h-5 w-5 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 group-hover:text-violet-700 dark:text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description || "No description"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>
                {p.member_count !== undefined && (
                  <span className="text-xs text-slate-400">{p.member_count} member(s)</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Archive className="h-4 w-4" /> Archived ({archived.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
            {archived.map(p => (
              <Link key={p.id} href={`/manager/projects/${p.id}`}
                className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mt-1">Archived</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
