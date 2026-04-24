"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskApi } from "@/lib/api";
import type { Task } from "@/types";

// Get all pending task approvals for a specific project
export const useTaskApprovals = (projectId?: string) =>
  useQuery<Task[]>({
    queryKey: ["task-approvals", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await taskApi.get(`/project/${projectId}/pending`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

export const useApproveTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => taskApi.post(`/${taskId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-approvals"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};

export const useRejectTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => taskApi.post(`/${taskId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-approvals"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};
