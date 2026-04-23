"use client";

import { Draggable } from "@hello-pangea/dnd";
import { MessageSquare, Clock3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Task } from "@/types";

const priorityColor = { LOW: "border-l-slate-300", MEDIUM: "border-l-amber-400", HIGH: "border-l-rose-500" };

export const TaskCard = ({ task, index, onClick }: { task: Task; index: number; onClick: () => void }) => (
  <Draggable draggableId={task.id} index={index}>
    {(provided, snapshot) => (
      <article
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        onClick={onClick}
        className={`mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 border-l-4 ${priorityColor[task.priority]} ${snapshot.isDragging ? "rotate-[1deg] scale-[1.03] shadow-xl" : ""}`}
      >
        <h4 className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">{task.title}</h4>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{task.description}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] text-indigo-700">
              {task.assignee_name ? task.assignee_name.split(" ").map((n) => n[0]).join("") : "-"}
            </div>
            {task.comments_count > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {task.comments_count}</span>}
          </div>
          <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
        </div>
      </article>
    )}
  </Draggable>
);
