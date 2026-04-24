"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { taskApi } from "@/lib/api";
import { generateId, cn } from "@/lib/utils";
import type { KanbanBoard as Board, Task } from "@/types";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const KanbanBoard = ({ 
  initialBoard, 
  projectId,
  projectMembers = []
}: { 
  initialBoard: Board; 
  projectId?: string;
  projectMembers?: import("@/types").ProjectMember[];
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [board, setBoard] = useState(initialBoard);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  
  const isManager = user?.role === "manager" || user?.role === "admin";

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const src = result.source.droppableId as keyof Board;
    const dest = result.destination.droppableId as keyof Board;
    
    // Validate transition
    if (src === "TODO" && dest === "DONE") {
      return toast.error("TODO → DONE transition is not allowed. Must go through IN_PROGRESS.");
    }
    
    const allowed = ["TODO", "IN_PROGRESS", "DONE"];
    if (!allowed.includes(src) || !allowed.includes(dest)) return;

    const cloned = structuredClone(board);
    const [moved] = cloned[src].splice(result.source.index, 1);
    moved.status = dest as any;
    cloned[dest].splice(result.destination.index, 0, moved);
    
    const prev = board;
    setBoard(cloned);

    try {
      await taskApi.put(`/${moved.id}`, { status: dest });
    } catch {
      setBoard(prev);
      toast.error("Failed to update status");
    }
  };

  const handleAction = async (task: Task, action: "propose-move" | "approve-move" | "reject-move" | "activate", payload: any = {}) => {
    try {
      await taskApi.post(`/${task.id}/${action}`, payload);
      toast.success(`Task ${action.replace("-", " ")} successfully`);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    } catch {
      toast.error(`Failed to ${action}`);
    }
  };

  const pendingTasks = [
    ...(board.PENDING_REVIEW || []),
    ...(board.PENDING_PROGRESS || []),
    ...(board.PENDING_DONE || [])
  ];

  return (
    <div className="space-y-8">
      {pendingTasks.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/30 dark:bg-amber-900/10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-500">
              {isManager ? "Tasks Needing Review" : "Your Pending Requests"} ({pendingTasks.length})
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pendingTasks.map(task => (
              <div key={task.id} className="group flex flex-col rounded-xl border border-amber-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-amber-800 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">{task.status}</span>
                  <span className={cn("h-2 w-2 rounded-full bg-amber-400", "animate-pulse")} />
                </div>
                <p className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isManager && task.status === "PENDING_REVIEW" && (
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => handleAction(task, "activate")}>Activate</Button>
                  )}
                  {isManager && ["PENDING_PROGRESS", "PENDING_DONE"].includes(task.status) && (
                    <>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => handleAction(task, "approve-move")}>Approve</Button>
                      <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => handleAction(task, "reject-move")}>Reject</Button>
                    </>
                  )}
                  {!isManager && (
                    <span className="text-xs font-medium italic text-amber-600 dark:text-amber-400">Awaiting manager review...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Responsive Kanban Container: Horizontal scroll on mobile, side-by-side on desktop */}
        <div className="overflow-x-auto pb-6 md:overflow-x-visible">
          <motion.div 
            initial="hidden" 
            animate="show" 
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} 
            className="flex flex-col gap-6 md:flex-row min-w-full"
          >
            {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => (
              <div key={status} className="w-full md:flex-1 md:min-w-[320px]">
                <KanbanColumn
                  title={status}
                  tasks={board[status] ?? []}
                  onOpenTask={setOpenTask}
                  isDragDisabled={!isManager}
                  isManager={isManager}
                  members={projectMembers}
                  onAddTask={async (title, priority, col, assigneeId, assigneeEmail) => {
                    if (!projectId) {
                      toast.error("No project selected");
                      return;
                    }
                    
                    const optimisticTask = {
                      id: generateId(),
                      title,
                      priority,
                      status: "PENDING_REVIEW" as any,
                      description: "",
                      project_id: projectId,
                      assignee_id: assigneeId,
                      assignee_email: assigneeEmail,
                      comments_count: 0,
                      created_at: new Date().toISOString()
                    };
                    
                    setBoard((b) => ({ ...b, PENDING_REVIEW: [optimisticTask, ...(b.PENDING_REVIEW || [])] }));
                    
                    try {
                      await taskApi.post("/", { 
                        title, 
                        priority, 
                        status: col, 
                        project_id: projectId,
                        assignee_id: assigneeId,
                        assignee_email: assigneeEmail
                      });
                      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
                      toast.success("Task submitted for approval");
                    } catch {
                      setBoard((b) => ({ ...b, PENDING_REVIEW: (b.PENDING_REVIEW || []).filter((task) => task.id !== optimisticTask.id) }));
                      toast.error("Failed to create task");
                    }
                  }}
                />
              </div>
            ))}
          </motion.div>
        </div>
      </DragDropContext>

      <TaskDetailModal 
        task={openTask} 
        open={Boolean(openTask)} 
        onClose={() => setOpenTask(null)} 
        onProposeMove={!isManager ? (target) => handleAction(openTask!, "propose-move", { target_status: target }) : undefined}
      />
    </div>
  );
};
