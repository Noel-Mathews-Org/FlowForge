import { subDays } from "date-fns";
import type { AnalyticsOverview, ApprovalRequest, KanbanBoard, Project, ThroughputDataPoint, User, UserActivityStat } from "@/types";

export const mockUsers: User[] = [
  { id: "u1", email: "amaya.rivera@flowforge.io", full_name: "Amaya Rivera", role: "admin", org: "FlowForge" },
  { id: "u2", email: "theo.bennett@flowforge.io", full_name: "Theo Bennett", role: "manager", org: "FlowForge" },
  { id: "u3", email: "nina.patel@flowforge.io", full_name: "Nina Patel", role: "manager", org: "FlowForge" },
  { id: "u4", email: "marcus.kim@flowforge.io", full_name: "Marcus Kim", role: "member", org: "FlowForge" },
  { id: "u5", email: "sara.okafor@flowforge.io", full_name: "Sara Okafor", role: "member", org: "FlowForge" }
];

export const mockProjects: Project[] = [
  { id: "p1", name: "Platform Redesign", description: "Rebuild the customer dashboard with unified design tokens and performance budgets.", manager_email: "theo.bennett@flowforge.io", created_at: subDays(new Date(), 24).toISOString(), status: "ACTIVE", members: [], task_count: 5 },
  { id: "p2", name: "API Gateway Migration", description: "Migrate legacy edge services to gateway v2 with canary rollout safeguards.", manager_email: "nina.patel@flowforge.io", created_at: subDays(new Date(), 43).toISOString(), status: "ACTIVE", members: [], task_count: 4 },
  { id: "p3", name: "Q4 Marketing Campaign", description: "Coordinate launch timeline, content approvals, and analytics instrumentation.", manager_email: "theo.bennett@flowforge.io", created_at: subDays(new Date(), 12).toISOString(), status: "ARCHIVED", members: [], task_count: 3 }
];

const now = new Date();
export const mockBoard: KanbanBoard = {
  TODO: [
    { id: "t1", project_id: "p1", title: "Implement JWT refresh", description: "Add refresh token rotation with replay protection.", status: "TODO", priority: "HIGH", assignee_name: "Marcus Kim", assignee_email: "marcus.kim@flowforge.io", comments_count: 3, created_at: subDays(now, 2).toISOString() },
    { id: "t2", project_id: "p1", title: "Design system audit", description: "Inventory component drift across admin surfaces.", status: "TODO", priority: "MEDIUM", assignee_name: "Sara Okafor", assignee_email: "sara.okafor@flowforge.io", comments_count: 1, created_at: subDays(now, 3).toISOString() },
    { id: "t3", project_id: "p2", title: "Set up Argo Rollouts", description: "Create canary policy and alert gates.", status: "TODO", priority: "HIGH", comments_count: 2, created_at: subDays(now, 4).toISOString() },
    { id: "t4", project_id: "p2", title: "Write API documentation", description: "Publish migration and troubleshooting guide.", status: "TODO", priority: "LOW", comments_count: 0, created_at: subDays(now, 1).toISOString() }
  ],
  IN_PROGRESS: [
    { id: "t5", project_id: "p1", title: "Build role permission matrix", description: "Map scope by resource and route.", status: "IN_PROGRESS", priority: "MEDIUM", assignee_name: "Marcus Kim", comments_count: 4, created_at: subDays(now, 6).toISOString() },
    { id: "t6", project_id: "p2", title: "Gateway health dashboard", description: "Surface p95 and error-rate slices.", status: "IN_PROGRESS", priority: "HIGH", comments_count: 5, created_at: subDays(now, 8).toISOString() },
    { id: "t7", project_id: "p3", title: "Campaign audience review", description: "Validate segments before launch.", status: "IN_PROGRESS", priority: "LOW", comments_count: 1, created_at: subDays(now, 5).toISOString() },
    { id: "t8", project_id: "p3", title: "Legal content sign-off", description: "Close open legal review comments.", status: "IN_PROGRESS", priority: "MEDIUM", comments_count: 2, created_at: subDays(now, 7).toISOString() }
  ],
  DONE: [
    { id: "t9", project_id: "p1", title: "Token revocation endpoint", description: "Completed endpoint and tests.", status: "DONE", priority: "MEDIUM", comments_count: 1, created_at: subDays(now, 10).toISOString() },
    { id: "t10", project_id: "p2", title: "Service inventory baseline", description: "Captured ownership and runtimes.", status: "DONE", priority: "LOW", comments_count: 0, created_at: subDays(now, 11).toISOString() },
    { id: "t11", project_id: "p3", title: "Ad creative QA pass", description: "Fixed spacing issues and export quality.", status: "DONE", priority: "LOW", comments_count: 3, created_at: subDays(now, 9).toISOString() },
    { id: "t12", project_id: "p1", title: "SSO discovery workshop", description: "Documented provider constraints.", status: "DONE", priority: "MEDIUM", comments_count: 2, created_at: subDays(now, 13).toISOString() }
  ]
};

export const mockApprovals: ApprovalRequest[] = [
  { id: "a1", requester_name: "Ari Singh", requester_email: "ari.singh@flowforge.io", project_id: "p1", project_name: "Platform Redesign", created_at: subDays(now, 1).toISOString() },
  { id: "a2", requester_name: "Leila Chen", requester_email: "leila.chen@flowforge.io", project_id: "p2", project_name: "API Gateway Migration", created_at: subDays(now, 2).toISOString() },
  { id: "a3", requester_name: "Mateo Alvarez", requester_email: "mateo.alvarez@flowforge.io", project_id: "p3", project_name: "Q4 Marketing Campaign", created_at: subDays(now, 3).toISOString() }
];

export const mockThroughput: ThroughputDataPoint[] = Array.from({ length: 7 }).map((_, i) => ({
  date: subDays(now, 6 - i).toISOString(),
  tasks_created: [11, 8, 14, 9, 12, 7, 10][i],
  tasks_completed: [6, 9, 10, 11, 8, 9, 12][i]
}));

export const mockOverview: AnalyticsOverview = {
  total_tasks: 126,
  active_projects: 18,
  team_members: 47,
  completion_rate: 72,
  trend_total_tasks: 14
};

export const mockAudit: UserActivityStat[] = Array.from({ length: 20 }).map((_, i) => ({
  event_type: (["task_created", "task_moved", "task_deleted", "comment_added"] as const)[i % 4],
  user: mockUsers[i % mockUsers.length].full_name,
  project: mockProjects[i % mockProjects.length].name,
  time: subDays(now, Math.floor(i / 3)).toISOString()
}));
