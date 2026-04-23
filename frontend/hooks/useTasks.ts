"use client";

import { useQuery } from "@tanstack/react-query";
import { mockBoard } from "@/lib/mock-data";
import { taskApi } from "@/lib/api";
import { isValidUUID } from "@/lib/utils";
import type { KanbanBoard } from "@/types";

const mock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export const useTasks = (projectId?: string) =>
  useQuery<KanbanBoard>({
    queryKey: ["tasks", projectId],
    enabled: isValidUUID(projectId),
    queryFn: async () => {
      if (mock) {
        return {
          TODO: mockBoard.TODO.filter((t) => t.project_id === projectId),
          IN_PROGRESS: mockBoard.IN_PROGRESS.filter((t) => t.project_id === projectId),
          DONE: mockBoard.DONE.filter((t) => t.project_id === projectId)
        };
      }
      return (await taskApi.get(`/project/${projectId}`)).data;
    }
  });
