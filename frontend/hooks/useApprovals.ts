"use client";

import { useQuery } from "@tanstack/react-query";
import { mockApprovals } from "@/lib/mock-data";
import { projectApi } from "@/lib/api";
import type { ApprovalRequest } from "@/types";

const mock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export const useApprovals = () =>
  useQuery<ApprovalRequest[]>({
    queryKey: ["approvals"],
    queryFn: async () => {
      if (mock) return mockApprovals;
      const res = (await projectApi.get("/approvals")).data;
      return Array.isArray(res) ? res : [];
    }
  });
