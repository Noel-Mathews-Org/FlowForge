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

  const isManager = user?.role === "manager" || user?.role === "platform_admin" || user?.role === "org_owner";

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const src = result.source.droppableId as keyof Board;
    const dest = result.destination.droppableId as keyof Board;

    if (src === dest && result.source.index === result.destination.index) return;

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

  const handleProposeMove = async (task: Task, targetStatus: "IN_PROGRESS" | "DONE") => {
    try {
      await taskApi.put(`/${task.id}`, { status: targetStatus });
      toast.success("Status change request submitted for manager review");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    } catch {
      toast.error("Failed to submit status change request");
    }
  };

  const totalTasks = (board.TODO?.length ?? 0) + (board.IN_PROGRESS?.length ?? 0) + (board.DONE?.length ?? 0);

  return (
    <div className="space-y-8">
      {totalTasks === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700 bg-white dark:bg-slate-900/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No tasks yet</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">Create the first task in any column to get started.</p>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Responsive Kanban Container */}
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

                    try {
                      await taskApi.post("", {
                        title,
                        priority,
                        project_id: projectId,
                        assignee_id: assigneeId,
                        assignee_email: assigneeEmail
                      });
                      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
                      toast.success(isManager ? "Task created" : "Task submitted for approval");
                    } catch {
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
        onProposeMove={!isManager ? (target) => handleProposeMove(openTask!, target) : undefined}
      />
    </div>
  );
};
