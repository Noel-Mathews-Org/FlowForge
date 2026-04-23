"use client";

import { useMemo, useState } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { SelectField } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";

export default function DashboardPage() {
  const projects = useProjects();
  const [selected, setSelected] = useState<string>("");
  const selectedProject = selected || projects.data?.[0]?.id;
  const tasks = useTasks(selectedProject);

  const options = useMemo(() => (projects.data ?? []).map((project) => ({ value: project.id, label: project.name })), [projects.data]);
  if (projects.isLoading) return <Skeleton className="h-12 w-72" />;
  if (projects.isError || !options.length) return <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Could not load projects. <button onClick={() => projects.refetch()} className="underline">Retry</button></div>;

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SelectField value={selectedProject!} onValueChange={setSelected} options={options} />
      </div>
      {tasks.isLoading ? <Skeleton className="h-[560px]" /> : tasks.isError || !tasks.data ? <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Board failed to load. <button className="underline" onClick={() => tasks.refetch()}>Retry</button></div> : <KanbanBoard initialBoard={tasks.data} />}
    </div>
  );
}
