"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { taskApi } from "@/lib/api";
import { generateId } from "@/lib/utils";
import type { KanbanBoard as Board, Task } from "@/types";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const KanbanBoard = ({ initialBoard, projectId }: { initialBoard: Board; projectId?: string }) => {
  const { user } = useAuth();
  const [board, setBoard] = useState(initialBoard);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  
  const isManager = user?.role === "manager" || user?.role === "admin";

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const src = result.source.droppableId as keyof Board;
    const dest = result.destination.droppableId as keyof Board;
    if (src === "TODO" && dest === "DONE") return toast.error("TODO → DONE transition is not allowed");
    if (!["TODO", "IN_PROGRESS", "DONE"].includes(src) || !["TODO", "IN_PROGRESS", "DONE"].includes(dest)) return;

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
      window.location.reload(); 
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
    <div className="space-y-6">
      {pendingTasks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
          <h3 className="mb-3 font-semibold text-amber-800 dark:text-amber-500">
            {isManager ? "Tasks Needing Review" : "Your Pending Requests"} ({pendingTasks.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTasks.map(task => (
              <div key={task.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm shadow-sm dark:border-amber-800 dark:bg-slate-900">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-slate-500">{task.status}</p>
                <div className="mt-3 flex gap-2">
                  {isManager && task.status === "PENDING_REVIEW" && (
                    <Button size="sm" onClick={() => handleAction(task, "activate")}>Activate to TODO</Button>
                  )}
                  {isManager && ["PENDING_PROGRESS", "PENDING_DONE"].includes(task.status) && (
                    <>
                      <Button size="sm" onClick={() => handleAction(task, "approve-move")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(task, "reject-move")}>Reject</Button>
                    </>
                  )}
                  {!isManager && (
                    <span className="text-xs italic text-amber-600 dark:text-amber-400">Waiting for manager approval</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} className="grid grid-cols-3 gap-4">
          {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => (
            <KanbanColumn
              key={status}
              title={status}
              tasks={board[status] ?? []}
              onOpenTask={setOpenTask}
              isDragDisabled={!isManager}
              onAddTask={async (title, priority, col) => {
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
                  comments_count: 0,
                  created_at: new Date().toISOString()
                };
                setBoard((b) => ({ ...b, PENDING_REVIEW: [optimisticTask, ...(b.PENDING_REVIEW || [])] }));
                try {
                  await taskApi.post("/", { title, priority, status: col, project_id: projectId });
                  window.location.reload();
                } catch {
                  setBoard((b) => ({ ...b, PENDING_REVIEW: (b.PENDING_REVIEW || []).filter((task) => task.id !== optimisticTask.id) }));
                  toast.error("Failed to create task");
                }
              }}
            />
          ))}
        </motion.div>
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
