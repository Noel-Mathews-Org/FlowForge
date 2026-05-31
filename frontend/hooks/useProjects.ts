"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockProjects } from "@/lib/mock-data";
import { projectApi } from "@/lib/api";
import type { Project, ProjectDetail } from "@/types";

const mock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export const useProjects = () =>
  useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      if (mock) return mockProjects;
      const res = (await projectApi.get("")).data;
      // Backend returns { projects: [...], total: N }
      return Array.isArray(res) ? res : (res.projects ?? []);
    }
  });

export const useProjectDetail = (id: string) =>
  useQuery<ProjectDetail>({
    queryKey: ["project", id],
    queryFn: async () => {
      if (mock) return { ...mockProjects.find((p) => p.id === id)!, members: [], pending_approval_count: 0 } as ProjectDetail;
      return (await projectApi.get(`/${id}`)).data;
    },
    enabled: Boolean(id)
  });

export const useArchiveProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.patch(`/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
};

export const useUnarchiveProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.patch(`/${id}/unarchive`, { member_ids: [] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
};
