"use client";

import { useMemo, useState } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";

export default function DashboardPage() {
  const projects = useProjects();
  const [selected, setSelected] = useState<string>("");

  const projectList = projects.data ?? [];
  const selectedProject = selected || projectList[0]?.id;
  const tasks = useTasks(selectedProject);

  const options = useMemo(
    () => projectList.map((p) => ({ value: p.id, label: p.name })),
    [projectList]
  );

  if (projects.isLoading) return <Skeleton className="h-12 w-72" />;

  if (projects.isError) {
    return (
      <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
        Could not load projects.{" "}
        <button onClick={() => projects.refetch()} className="underline">Retry</button>
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
        No projects assigned yet. Ask your manager for access.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <select
          value={selectedProject ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {!selectedProject ? (
        <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          Select a project to view its board.
        </div>
      ) : tasks.isLoading ? (
        <Skeleton className="h-[560px]" />
      ) : tasks.isError || !tasks.data ? (
        <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
          Board failed to load.{" "}
          <button className="underline" onClick={() => tasks.refetch()}>Retry</button>
        </div>
      ) : (
        <KanbanBoard initialBoard={tasks.data} projectId={selectedProject} />
      )}
    </div>
  );
}