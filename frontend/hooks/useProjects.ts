"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockProjects } from "@/lib/mock-data";
import { projectApi } from "@/lib/api";
import type { Project, ProjectDetail } from "@/types";

const mock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

/** Safely extract an array of projects from any API response shape */
function extractProjects(res: any): Project[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.projects)) return res.projects;
  return [];
}

/** Fetches active (non-archived) projects for the current user */
export const useProjects = () =>
  useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      if (mock) return mockProjects;
      const res = (await projectApi.get("")).data;
      return extractProjects(res);
    }
  });

/** Fetches ALL projects (active + archived) for pages that need both */
export const useAllProjects = () =>
  useQuery<{ active: Project[]; archived: Project[] }>({
    queryKey: ["projects", "all"],
    queryFn: async () => {
      if (mock) return { active: mockProjects, archived: [] };
      const [activeRes, archivedRes] = await Promise.all([
        projectApi.get("", { params: { archived: false } }),
        projectApi.get("", { params: { archived: true } }),
      ]);
      return {
        active: extractProjects(activeRes.data),
        archived: extractProjects(archivedRes.data),
      };
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project"] });
    },
  });
};

export const useUnarchiveProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.patch(`/${id}/unarchive`, { member_ids: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project"] });
    },
  });
};
