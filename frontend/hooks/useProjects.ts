"use client";

import { useQuery } from "@tanstack/react-query";
import { mockProjects } from "@/lib/mock-data";
import { projectApi } from "@/lib/api";
import type { Project } from "@/types";

const mock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export const useProjects = () =>
  useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => (mock ? mockProjects : (await projectApi.get("/api/projects/")).data)
  });

export const useProjectDetail = (id: string) =>
  useQuery<Project>({
    queryKey: ["project", id],
    queryFn: async () => {
      if (mock) return mockProjects.find((p) => p.id === id) as Project;
      return (await projectApi.get(`/api/projects/${id}`)).data;
    },
    enabled: Boolean(id)
  });
