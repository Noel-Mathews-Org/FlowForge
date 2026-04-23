"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckSquare, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { Project } from "@/types";

export const ProjectCard = ({ project, onClick }: { project: Project; onClick: () => void }) => (
  <motion.article
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 28 }}
    onClick={onClick}
    className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
  >
    <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{project.name}</h3>
        {project.is_archived && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-800">Archived</span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {project.member_count} members</span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="max-w-[160px] truncate">{project.manager_email}</span>
        <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
      </div>
    </div>
  </motion.article>
);
