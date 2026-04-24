"use client";

import { Draggable } from "@hello-pangea/dnd";
import { MessageSquare, Clock3, AlertCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Task } from "@/types";

const priorityColor = { LOW: "border-l-slate-300", MEDIUM: "border-l-amber-400", HIGH: "border-l-rose-500" };

export const TaskCard = ({ task, index, onClick, isDragDisabled }: { task: Task; index: number; onClick: () => void; isDragDisabled?: boolean }) => {
  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 border-l-4 ${priorityColor[task.priority]} ${snapshot.isDragging ? "rotate-[1deg] scale-[1.03] shadow-xl" : ""} ${task.needs_approval ? "opacity-80" : ""}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            {task.needs_approval && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                ⏳ Pending Approval
              </span>
            )}
            {task.proposed_status && (
              <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                <ArrowRight className="h-3 w-3" />
                Proposed: {task.proposed_status}
              </span>
            )}
          </div>
          <h4 className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">{task.title}</h4>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{task.description}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] text-indigo-700">
                {task.assignee_email ? task.assignee_email.split("@")[0].split(".").map((n) => n[0]?.toUpperCase()).join("") : "-"}
              </div>
              {(task.comments_count ?? 0) > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {task.comments_count}</span>}
            </div>
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
          </div>
        </article>
      )}
    </Draggable>
  );
};
