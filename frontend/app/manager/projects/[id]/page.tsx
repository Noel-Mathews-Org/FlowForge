"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useProjectDetail } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";

export default function ManagerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<"BOARD" | "MEMBERS">("MEMBERS");
  const project = useProjectDetail(params.id);

  if (project.isLoading) return <div className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />;
  if (project.isError || !project.data) return <div className="rounded-xl bg-rose-50 p-4 text-rose-700">Could not load project. <button className="underline" onClick={() => project.refetch()}>Retry</button></div>;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Projects / {project.data.name}</p>
      <div className="mb-4 flex gap-5 border-b border-slate-200 dark:border-slate-800">
        <button className={`pb-2 ${tab === "BOARD" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500"}`} onClick={() => setTab("BOARD")}>Board</button>
        <button className={`pb-2 ${tab === "MEMBERS" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-slate-500"}`} onClick={() => setTab("MEMBERS")}>Members</button>
      </div>
      {tab === "BOARD" ? (
        <Link className="text-indigo-600 underline" href={`/dashboard?project=${project.data.id}`}>Open member board view</Link>
      ) : (
        <div className="space-y-2">
          {(project.data.members.length ? project.data.members : [{ id: "m1", user_id: "x", full_name: "Marcus Kim", email: "marcus.kim@flowforge.io", role: "MEMBER", joined_at: new Date().toISOString() }]).map((member) => (
            <div key={member.id} className="flex items-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">{member.full_name.split(" ").map((n) => n[0]).join("")}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.full_name}</p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
              <span className="mr-3 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{member.role}</span>
              {member.role !== "MANAGER" && <Button variant="outline"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
