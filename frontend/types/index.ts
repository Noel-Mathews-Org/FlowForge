export type Role = "admin" | "manager" | "member";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  org: string;
};

export type ProjectMember = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: "MANAGER" | "MEMBER";
  joined_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  manager_email: string;
  created_at: string;
  status: "ACTIVE" | "ARCHIVED";
  members: ProjectMember[];
  task_count: number;
};

export type Comment = {
  id: string;
  author: string;
  author_email: string;
  content: string;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee_name?: string;
  assignee_email?: string;
  comments_count: number;
  due_date?: string;
  created_at: string;
};

export type KanbanBoard = {
  TODO: Task[];
  IN_PROGRESS: Task[];
  DONE: Task[];
};

export type ApprovalRequest = {
  id: string;
  requester_name: string;
  requester_email: string;
  project_id: string;
  project_name: string;
  created_at: string;
};

export type AnalyticsOverview = {
  total_tasks: number;
  active_projects: number;
  team_members: number;
  completion_rate: number;
  trend_total_tasks: number;
};

export type ThroughputDataPoint = {
  date: string;
  tasks_created: number;
  tasks_completed: number;
};

export type UserActivityStat = {
  event_type: "task_created" | "task_moved" | "task_deleted" | "comment_added";
  user: string;
  project: string;
  time: string;
};
