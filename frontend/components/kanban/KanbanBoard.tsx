"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { taskApi } from "@/lib/api";
import type { KanbanBoard as Board, Task } from "@/types";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";

export const KanbanBoard = ({ initialBoard }: { initialBoard: Board }) => {
  const [board, setBoard] = useState(initialBoard);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const src = result.source.droppableId as keyof Board;
    const dest = result.destination.droppableId as keyof Board;
    if (src === "TODO" && dest === "DONE") return toast.error("TODO → DONE transition is not allowed");

    const cloned = structuredClone(board);
    const [moved] = cloned[src].splice(result.source.index, 1);
    moved.status = dest;
    cloned[dest].splice(result.destination.index, 0, moved);
    const prev = board;
    setBoard(cloned);

    try {
      await taskApi.put(`/api/tasks/${moved.id}`, { status: dest });
    } catch {
      setBoard(prev);
      toast.error("Failed to update status");
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} className="grid grid-cols-3 gap-4">
          {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => (
            <KanbanColumn
              key={status}
              title={status}
              tasks={board[status]}
              onOpenTask={setOpenTask}
              onAddTask={async (title, priority, col) => {
                const optimisticTask = {
                  id: crypto.randomUUID(),
                  title,
                  priority,
                  status: col,
                  description: "",
                  project_id: "p1",
                  comments_count: 0,
                  created_at: new Date().toISOString()
                };
                setBoard((b) => ({ ...b, [col]: [optimisticTask, ...b[col]] }));
                try {
                  await taskApi.post("/api/tasks/", { title, priority, status: col });
                } catch {
                  setBoard((b) => ({ ...b, [col]: b[col].filter((task) => task.id !== optimisticTask.id) }));
                  toast.error("Failed to create task");
                }
              }}
            />
          ))}
        </motion.div>
      </DragDropContext>
      <TaskDetailModal task={openTask} open={Boolean(openTask)} onClose={() => setOpenTask(null)} />
    </>
  );
};
