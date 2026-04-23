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
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{project.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {project.members.length || 5} members</span>
        <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> {project.task_count} tasks</span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="max-w-[160px] truncate">{project.manager_email}</span>
        <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
      </div>
    </div>
  </motion.article>
);
