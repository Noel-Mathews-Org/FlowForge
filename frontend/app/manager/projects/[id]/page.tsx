"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useProjectDetail } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function ManagerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<"BOARD" | "MEMBERS">("BOARD");
  const project = useProjectDetail(params.id);
  const tasks = useTasks(params.id);

  if (project.isLoading) return <div className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />;
  if (project.isError || !project.data) return <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Could not load project. <button className="underline" onClick={() => project.refetch()}>Retry</button></div>;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        <Link href="/manager" className="hover:text-indigo-600">Projects</Link> / {project.data.name}
      </p>
      <div className="mb-4 flex gap-5 border-b border-slate-200 dark:border-slate-800">
        <button className={`pb-2 ${tab === "BOARD" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500"}`} onClick={() => setTab("BOARD")}>Board</button>
        <button className={`pb-2 ${tab === "MEMBERS" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500"}`} onClick={() => setTab("MEMBERS")}>Members</button>
      </div>
      {tab === "BOARD" ? (
        <div>
          {tasks.isLoading ? (
            <Skeleton className="h-[560px]" />
          ) : tasks.isError || !tasks.data ? (
            <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
              Board failed to load. <button className="underline" onClick={() => tasks.refetch()}>Retry</button>
            </div>
          ) : (
            <KanbanBoard initialBoard={tasks.data} projectId={params.id} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {(project.data.members ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">No members found for this project.</div>
          ) : (
            (project.data.members ?? []).map((member) => (
              <div key={member.user_id} className="flex items-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                  {member.user_email.split("@")[0].split(".").map((n) => n[0]?.toUpperCase()).join("")}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.user_email}</p>
                  <p className="text-xs text-slate-500">{member.member_role}</p>
                </div>
                <span className="mr-3 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{member.member_role}</span>
                {member.member_role !== "manager" && <Button variant="outline"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
