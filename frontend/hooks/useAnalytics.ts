"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { mockAudit, mockOverview, mockThroughput } from "@/lib/mock-data";
import type { AnalyticsOverview, ThroughputDataPoint, UserActivityStat } from "@/types";

const mock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export const useAnalyticsOverview = () =>
  useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: async () => (mock ? mockOverview : (await analyticsApi.get("/overview")).data)
  });

export const useThroughput = (days = 7) =>
  useQuery<ThroughputDataPoint[]>({
    queryKey: ["throughput", days],
    queryFn: async () => (mock ? mockThroughput : (await analyticsApi.get(`/task-throughput?days=${days}`)).data)
  });

export const useAudit = () =>
  useQuery<UserActivityStat[]>({
    queryKey: ["audit"],
    queryFn: async () => (mock ? mockAudit : (await analyticsApi.get("/audit-log")).data)
  });
