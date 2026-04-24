export type Role = "admin" | "manager" | "member";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  org: string;
};

export type ProjectMember = {
  user_id: string;
  user_email: string;
  member_role: string;
  joined_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  manager_id: string;
  manager_email: string;
  is_archived: boolean;
  created_at: string;
  member_count: number;
};

export type ProjectDetail = Project & {
  members: ProjectMember[];
  pending_approval_count: number;
};

export type Comment = {
  id: string;
  author_id?: string;
  author_email: string;
  body: string;
  created_at: string;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  created_by?: string;
  created_by_email?: string;
  comments_count: number;
  needs_approval: boolean;
  proposed_status: string | null;
  proposed_by: string | null;
  due_date?: string;
  created_at: string;
};

export type KanbanBoard = {
  TODO: Task[];
  IN_PROGRESS: Task[];
  DONE: Task[];
};

export type AnalyticsOverview = {
  total_tasks: number;
  tasks_by_status: Record<string, number>;
  total_projects: number;
  total_users: number;
  events_today: number;
  completion_rate: number;
};

export type ThroughputDataPoint = {
  date: string;
  tasks_created: number;
  tasks_completed: number;
  tasks_in_progress?: number;
};

export type AuditEvent = {
  id: string;
  event_type: string;
  user_id: string;
  user_email: string;
  project_id: string | null;
  task_id: string | null;
  event_metadata: Record<string, unknown>;
  occurred_at: string;
  ingested_at: string;
};

/** @deprecated kept for mock-data compat */
export type UserActivityStat = {
  event_type: "task_created" | "task_moved" | "task_deleted" | "comment_added";
  user: string;
  project: string;
  time: string;
};
