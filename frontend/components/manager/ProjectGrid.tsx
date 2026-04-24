"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@/types";
import { ProjectCard } from "@/components/manager/ProjectCard";

export const ProjectGrid = ({ projects }: { projects: Project[] }) => {
  const router = useRouter();
  
  if (!projects.length) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-800">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No projects found</h3>
        <p className="mt-1 text-xs text-slate-500">Try adjusting your filters or create a new project.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard 
          key={project.id} 
          project={project} 
          onClick={() => router.push(`/manager/projects/${project.id}`)} 
        />
      ))}
    </div>
  );
};
