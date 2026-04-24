"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AddTaskForm } from "@/components/kanban/AddTaskForm";
import { TaskCard } from "@/components/kanban/TaskCard";
import type { ProjectMember, Task } from "@/types";

const color = { TODO: "bg-slate-500", IN_PROGRESS: "bg-amber-500", DONE: "bg-emerald-500" };

export const KanbanColumn = ({
  title,
  tasks,
  onOpenTask,
  onAddTask,
  isDragDisabled,
  isManager,
  members
}: {
  title: "TODO" | "IN_PROGRESS" | "DONE";
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onAddTask: (title: string, priority: "LOW" | "MEDIUM" | "HIGH", status: "TODO" | "IN_PROGRESS" | "DONE", assigneeId?: string, assigneeEmail?: string) => Promise<void>;
  isDragDisabled: boolean;
  isManager?: boolean;
  members?: ProjectMember[];
}) => {
  const [adding, setAdding] = useState(false);
  
  return (
    <div className="flex h-full min-h-[520px] w-full flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs text-white ${color[title]}`}>{tasks.length}</span>
      </div>
      <Droppable droppableId={title} isDropDisabled={isDragDisabled}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 overflow-y-auto rounded-lg border border-dashed p-2 ${snapshot.isDraggingOver ? "border-indigo-400 bg-indigo-50/40 dark:bg-indigo-900/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"}`}>
            {tasks.map((task, idx) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                index={idx} 
                onClick={() => onOpenTask(task)} 
                isDragDisabled={isDragDisabled || task.status.startsWith("PENDING_")}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <div className="mt-2">
        {!adding ? (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><Plus className="h-4 w-4" /> Add a task...</button>
        ) : (
          <AddTaskForm 
            isManager={isManager}
            members={members}
            onSubmit={async (name, p, aId, aEmail) => { 
              await onAddTask(name, p, title, aId, aEmail); 
              setAdding(false); 
            }} 
          />
        )}
      </div>
    </div>
  );
};
