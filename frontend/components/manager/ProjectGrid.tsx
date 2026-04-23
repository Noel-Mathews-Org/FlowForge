"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@/types";
import { ProjectCard } from "@/components/manager/ProjectCard";

export const ProjectGrid = ({ projects }: { projects: Project[] }) => {
  const router = useRouter();
  if (!projects.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">No projects found for this filter.</div>;
  }
  return <div className="grid grid-cols-3 gap-4">{projects.map((project) => <ProjectCard key={project.id} project={project} onClick={() => router.push(`/manager/projects/${project.id}`)} />)}</div>;
};
