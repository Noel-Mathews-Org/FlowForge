"use client";

import { useState } from "react";
import { FolderKanban, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useAllProjects } from "@/hooks/useProjects";

export default function OrgProjectsPage() {
  const { data, isLoading: loading } = useAllProjects();
  const [query, setQuery] = useState("");

  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const allProjects = [...active, ...archived];

  const filtered = allProjects.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.manager_email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">All Projects</h2>
          <p className="text-sm text-slate-500 mt-1">{active.length} active · {archived.length} archived</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects…"
            className="rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <FolderKanban className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-500">No projects found</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                {["Project", "Manager", "Members", "Status"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <Link href={`/manager/projects/${p.id}`} className="font-medium text-violet-600 hover:underline dark:text-violet-400">{p.name}</Link>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.description}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs">{p.manager_email}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.member_count ?? 0}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.is_archived ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.is_archived ? "Archived" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
