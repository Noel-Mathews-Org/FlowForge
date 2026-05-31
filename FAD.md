flowForge Final Architecture Document v4.0
Single Source of Truth for Antigravity Development
Document Purpose: This is the complete specification for building FlowForge. It defines WHAT to build, not HOW to build it. Antigravity will determine the optimal code structure while following these requirements exactly.

Document Quick Navigation
Section	Content
Section 1	Core Concepts & Role Definitions
Section 2	Business Rules & Workflows
Section 3	Database Schema Requirements
Section 4	API Contracts
Section 5	Frontend Requirements
Section 6	Analytics Dashboard Specifications
Section 7	AI Service Requirements
Section 8	Notification System Requirements
Section 9	Security Requirements
Section 10	Deployment Requirements
Section 1: Core Concepts & Role Definitions
1.1 What FlowForge Is
FlowForge is a single-tenant DevOps team management platform that helps organizations manage hierarchical teams, projects, and tasks with strict access control. It demonstrates microservices architecture, event-driven patterns, RBAC, and AI integration for training purposes.

1.2 The Four Roles - Complete Definition
Role	Created How	Default Credentials	Core Responsibility
platform_admin	Bootstrapped on first start	admin@flowforge.com / Admin123! (force reset)	System health, user oversight, AI cost monitoring
org_owner	Bootstrapped on first start	owner@flowforge.com / Owner123! (force reset)	Organization management, user invitations, transfers
manager	Invited by org_owner	N/A (invite only)	Team management, project creation, task approval
member	Invited by org_owner or manager	N/A (invite only)	Task execution, status updates
1.3 Role Capabilities Matrix
text
┌──────────────────────────────┬────────────────┬────────────┬─────────┬────────┐
│           Action              │ platform_admin │ org_owner  │ manager │ member │
├──────────────────────────────┼────────────────┼────────────┼─────────┼────────┤
│ View system health           │ ✅             │ ❌         │ ❌      │ ❌     │
│ View AI token usage          │ ✅             │ ❌         │ ❌      │ ❌     │
│ View all users               │ ✅             │ ✅         │ ❌      │ ❌     │
│ View users in my team        │ ✅             │ ✅         │ ✅      │ ❌     │
│ Invite users                 │ ✅             │ ✅         │ ✅*     │ ❌     │
│ Transfer members             │ ❌             │ ✅         │ ❌      │ ❌     │
│ Revoke users                 │ ✅             │ ✅         │ ❌      │ ❌     │
│ View all projects            │ ✅             │ ✅         │ ❌      │ ❌     │
│ View my projects             │ ✅             │ ✅         │ ✅      │ ✅     │
│ Create projects              │ ✅             │ ❌         │ ✅      │ ❌     │
│ Archive projects             │ ✅             │ ❌         │ ✅      │ ❌     │
│ View all tasks               │ ✅             │ ✅         │ ❌      │ ❌     │
│ View my tasks                │ ✅             │ ✅         │ ✅      │ ✅     │
│ Create tasks                 │ ✅             │ ❌         │ ✅      │ ✅**   │
│ Approve tasks                │ ✅             │ ❌         │ ✅      │ ❌     │
│ View org-wide analytics      │ ✅             │ ✅         │ ❌      │ ❌     │
│ View team analytics          │ ✅             │ ✅         │ ✅      │ ❌     │
│ View personal analytics      │ ✅             │ ✅         │ ✅      │ ✅     │
│ Generate AI project summary  │ ✅             │ ❌         │ ✅      │ ❌     │
│ Generate AI org summary      │ ✅             │ ✅         │ ❌      │ ❌     │
└──────────────────────────────┴────────────────┴────────────┴─────────┴────────┘

* Managers can only invite members (automatically assigned to them)
** Members can create tasks but need manager approval to mark as complete
1.4 Bootstrapping Requirements
On first container startup, the system MUST:

Check if any platform_admin exists in the database

If none exist, create both default accounts:

platform_admin with email admin@flowforge.com, password Admin123!, must_reset_password=true

org_owner with email owner@flowforge.com, password Owner123!, must_reset_password=true

Create the organization record (single tenant)

Link both users to the organization

Log bootstrap completion to console

This MUST happen exactly once. Subsequent starts should detect existing users and skip bootstrap.

Section 2: Business Rules & Workflows
2.1 Manager-Member Hierarchy Rules
Rule	Description	Enforcement
No orphaned members	Every member must have a manager_id	Reject member creation/registration without manager_id
Manager revocation	Cannot revoke a manager who has members	Block revocation, show error with member list
Member visibility	Members can only see their assigned manager	API must filter based on manager_id
Manager scope	Managers can only see members assigned to them	Team list endpoint must filter by manager_id
2.2 Member Transfer Workflow
When org owner transfers a member to a new manager:

text
Step 1: Validate new manager exists and is active
Step 2: Update member's manager_id to new manager
Step 3: DELETE all project_members records where:
        - member_id = transferred member
        - project_id IN (projects managed by old manager)
Step 4: Publish "member_transferred" event to Redis stream
Step 5: Create audit log entry with old_manager, new_manager, removed_projects
Step 6: Return success message with list of removed projects
Important: Do NOT delete tasks. Task ownership remains but assignment is removed (set assignee_id = NULL).

2.3 Project Archive Rules
State	Member Access	Manager Access	Task Operations
Active	Full access (view, work on tasks)	Full access	Create, update, delete
Archived	No access (404/403)	Read-only (can view, cannot edit)	NO operations allowed
Archive Flow:

text
Step 1: Set is_archived = true, archived_at = NOW(), archived_by = current_user
Step 2: Publish "project_archived" event
Step 3: System creates in-app notifications for all project members
Step 4: Project disappears from member dashboards
Unarchive Flow:

text
Step 1: Manager clicks "Unarchive & Make Visible"
Step 2: System shows member selection dialog (pre-selects previous members)
Step 3: Manager confirms/updates member list
Step 4: Set is_archived = false, unarchived_at = NOW()
Step 5: Replace project_members with new list
Step 6: Publish "project_unarchived" event
Step 7: Project becomes visible to new members
2.4 Task Approval Rules
Scenario	Behavior
Manager creates/updates task	Direct change, no approval needed
Member creates task	Task created with TODO status, no approval needed
Member marks task as DONE	Task enters PENDING_APPROVAL state, creates approval_request record
Manager approves	Task status becomes DONE, assignee notified
Manager rejects	Task returns to previous status, assignee notified with reason
Member updates other fields	No approval needed (title, description, etc.)
2.5 Invitation & Registration Flow
Invitation Flow:

text
Step 1: Org owner or manager clicks "Invite User"
Step 2: If inviting member, MUST select a manager (dropdown of available managers)
Step 3: System generates unique token, stores in invitations table
Step 4: System sends email with magic link: /invite/accept?token={token}
Step 5: Token expires in 7 days
Registration Flow:

text
Step 1: User clicks magic link
Step 2: System validates token (exists, not expired, status=PENDING)
Step 3: User sees registration form (full_name, password)
Step 4: On submit, system creates user with:
        - role from invitation
        - manager_id from invitation (if member)
        - is_active = true
        - must_reset_password = false
Step 5: System marks invitation as ACCEPTED
Step 6: User is redirected to login
2.6 Force Password Reset Flow
For default accounts (must_reset_password=true):

text
Step 1: User attempts login with default password
Step 2: Auth validates credentials, returns JWT but with must_reset_password=true
Step 3: Frontend redirects to /force-reset page
Step 4: User cannot access any other route
Step 5: User submits new password
Step 6: System updates password, sets must_reset_password=false
Step 7: User can now access dashboard
For any user (voluntary):

Any user can change password via profile page

Requires old password verification

Does NOT affect must_reset_password flag

Section 3: Database Schema Requirements
3.1 Database Architecture
FlowForge uses four separate databases in a single PostgreSQL instance:

Database	Purpose	Primary Tables
auth_db	Authentication, users, invitations	users, invitations, notifications, refresh_tokens
project_db	Project management	projects, project_members
task_db	Task tracking	tasks, task_comments, approval_requests
analytics_db	Analytics and audit	audit_events, daily_task_stats, user_activity_stats
3.2 Users Table (auth_db)
Column	Type	Constraints	Description
id	UUID	PK	Unique identifier
org_id	UUID	NOT NULL	Organization ID (single tenant)
email	VARCHAR(255)	UNIQUE, NOT NULL	Login email
hashed_password	VARCHAR(255)	NOT NULL	bcrypt hash
full_name	VARCHAR(255)	NOT NULL	Display name
role	ENUM	NOT NULL	platform_admin, org_owner, manager, member
manager_id	UUID	FK(users.id), NULL	For members only
notification_email	VARCHAR(255)	NULL	Optional separate email for notifications
must_reset_password	BOOLEAN	DEFAULT FALSE	Force password change on login
is_active	BOOLEAN	DEFAULT TRUE	Soft delete flag
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
Indexes Required: email, role, manager_id, org_id, is_active

3.3 Invitations Table (auth_db)
Column	Type	Constraints	Description
id	UUID	PK	
email	VARCHAR(255)	NOT NULL	Invited user's email
role	ENUM	NOT NULL	manager or member
manager_id	UUID	FK(users.id), NULL	Required when role=member
token	VARCHAR(255)	UNIQUE, NOT NULL	Magic link token
expires_at	TIMESTAMP	NOT NULL	7 days from creation
status	ENUM	DEFAULT 'PENDING'	PENDING, ACCEPTED, EXPIRED, CANCELLED
created_by	UUID	FK(users.id)	Who sent invitation
created_at	TIMESTAMP	DEFAULT NOW()	
3.4 Projects Table (project_db)
Column	Type	Constraints	Description
id	UUID	PK	
org_id	UUID	NOT NULL	
name	VARCHAR(255)	NOT NULL	
description	TEXT	NULL	
manager_id	UUID	NOT NULL	Project owner
manager_email	VARCHAR(255)	NOT NULL	Denormalized
is_archived	BOOLEAN	DEFAULT FALSE	
archived_by	UUID	NULL	Who archived
archived_at	TIMESTAMP	NULL	
unarchived_at	TIMESTAMP	NULL	
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
3.5 Project Members Table (project_db)
Column	Type	Constraints	Description
id	UUID	PK	
project_id	UUID	FK(projects.id)	
user_id	UUID	NOT NULL	References auth_db.users
user_email	VARCHAR(255)	NOT NULL	Denormalized
joined_at	TIMESTAMP	DEFAULT NOW()	
Unique Constraint: (project_id, user_id)

3.6 Tasks Table (task_db)
Column	Type	Constraints	Description
id	UUID	PK	
project_id	UUID	NOT NULL	References project_db.projects
title	VARCHAR(255)	NOT NULL	
description	TEXT	NULL	
status	ENUM	DEFAULT 'TODO'	TODO, IN_PROGRESS, DONE, BLOCKED
priority	ENUM	DEFAULT 'MEDIUM'	LOW, MEDIUM, HIGH
assignee_id	UUID	NULL	References auth_db.users
assignee_email	VARCHAR(255)	NULL	Denormalized
created_by	UUID	NOT NULL	
created_by_email	VARCHAR(255)	NOT NULL	
position	INTEGER	DEFAULT 0	Kanban order
needs_approval	BOOLEAN	DEFAULT FALSE	For member completions
proposed_status	VARCHAR(20)	NULL	Status member wants
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
deleted_at	TIMESTAMP	NULL	Soft delete
3.7 Approval Requests Table (task_db)
Column	Type	Constraints	Description
id	UUID	PK	
task_id	UUID	FK(tasks.id)	
requested_by	UUID	NOT NULL	Member who requested
requested_status	VARCHAR(20)	NOT NULL	Status requested
status	ENUM	DEFAULT 'PENDING'	PENDING, APPROVED, REJECTED
reviewed_by	UUID	NULL	Manager who reviewed
review_comment	TEXT	NULL	
created_at	TIMESTAMP	DEFAULT NOW()	
resolved_at	TIMESTAMP	NULL	
3.8 Notifications Table (auth_db)
Column	Type	Constraints	Description
id	UUID	PK	
user_id	UUID	FK(users.id)	Recipient
type	VARCHAR(50)	NOT NULL	task_assigned, task_approved, etc.
title	VARCHAR(255)	NOT NULL	Short title
content	TEXT	NOT NULL	Full message
metadata	JSONB	NULL	Extra data (task_id, project_id)
is_read	BOOLEAN	DEFAULT FALSE	
created_at	TIMESTAMP	DEFAULT NOW()	
3.9 Audit Events Table (analytics_db)
Column	Type	Constraints	Description
id	UUID	PK	
event_type	VARCHAR(50)	NOT NULL	USER_TRANSFERRED, PROJECT_ARCHIVED, etc.
user_id	UUID	NOT NULL	Who performed action
user_email	VARCHAR(255)	NOT NULL	
user_role	VARCHAR(20)	NOT NULL	
entity_type	VARCHAR(50)	NOT NULL	user, project, task, invitation
entity_id	UUID	NOT NULL	
metadata	JSONB	NOT NULL	Flexible event data
occurred_at	TIMESTAMP	DEFAULT NOW()	
ingested_at	TIMESTAMP	DEFAULT NOW()	
3.10 Statistics Tables (analytics_db)
daily_task_stats:

date (DATE), project_id (UUID), tasks_created, tasks_completed, tasks_in_progress, tasks_blocked

user_activity_stats:

user_id (UUID), user_email, date, events_count, tasks_created, tasks_completed

Section 4: API Contracts
4.1 API Base Convention
text
Base URL: /api/v1
Authentication: Bearer JWT token (except login and public invite endpoints)
Internal endpoints require: X-Internal-Token header
All responses: JSON
All errors: { "error": "message", "details": {} } (optional details)
4.2 Authentication Endpoints
Method	Path	Auth	Request	Response
POST	/auth/login	Public	{email, password}	{token, user: {id, email, role, must_reset_password}}
POST	/auth/logout	JWT	(none)	{success}
POST	/auth/refresh	JWT	{refresh_token}	{access_token}
POST	/auth/change-password	JWT	{old_password, new_password}	{success}
POST	/auth/force-reset	JWT	{new_password}	{success, must_reset_password: false}
4.3 Invitation Endpoints
Method	Path	Auth	Request	Response
POST	/auth/invite	org_owner, manager	{email, role, manager_id?}	{success, message}
GET	/auth/invite/verify	Public	Query: ?token=xyz	{valid, email, role, manager_id?}
POST	/auth/invite/accept	Public	{token, password, full_name}	{success, message}
4.4 User Management Endpoints
Method	Path	Auth	Response
GET	/users	org_owner, platform_admin	List of all users with role, email, status
GET	/users/team	manager	List of members assigned to this manager
GET	/users/me	JWT	Current user object
PUT	/users/me	JWT	Update profile (full_name, notification_email)
PATCH	/users/{id}/revoke	org_owner, platform_admin	Soft delete user
PATCH	/users/{id}/activate	org_owner, platform_admin	Reactivate user
PATCH	/users/{id}/transfer	org_owner	{new_manager_id} → {success, removed_projects}
GET	/users/{id}/history	org_owner, platform_admin	Audit trail for user
4.5 Project Endpoints
Method	Path	Auth	Request	Response
GET	/projects	All	Query: ?status=active&archived	List filtered by role
POST	/projects	manager, platform_admin	{name, description, member_ids}	Project object
GET	/projects/{id}	Project access	(none)	Project with members
PATCH	/projects/{id}	Manager, platform_admin	{name?, description?}	Updated project
PATCH	/projects/{id}/archive	Manager, platform_admin	(none)	{success}
PATCH	/projects/{id}/unarchive	Manager, platform_admin	{member_ids}	{success}
GET	/projects/{id}/members	Project access	(none)	List of members
POST	/projects/{id}/members	Manager, platform_admin	{user_id}	{success}
DELETE	/projects/{id}/members/{user_id}	Manager, platform_admin	(none)	{success}
4.6 Task Endpoints
Method	Path	Auth	Request	Response
GET	/tasks	All	Query: ?project_id=&assignee_id=&status=	List of tasks
POST	/tasks	Project access	{project_id, title, description, assignee_id?}	Task object
GET	/tasks/{id}	Task access	(none)	Task with comments
PATCH	/tasks/{id}	Task access	{title?, description?, status?, assignee_id?}	Updated task
DELETE	/tasks/{id}	Manager, creator	(none)	{success}
POST	/tasks/{id}/comments	Task access	{body}	Comment object
GET	/tasks/{id}/comments	Task access	(none)	List of comments
GET	/tasks/pending-approvals	manager	(none)	Tasks pending approval
POST	/tasks/{id}/approve	manager	{comment?}	{success}
POST	/tasks/{id}/reject	manager	{comment}	{success}
4.7 Analytics Endpoints
Method	Path	Auth	Response Data
GET	/analytics/platform/overview	platform_admin	System health, user counts, AI costs
GET	/analytics/org/overview	org_owner	Org stats, project distribution, completion rate
GET	/analytics/manager/dashboard	manager	Team velocity, project status, pending approvals
GET	/analytics/member/dashboard	member	Personal tasks, completion rate, activity
GET	/analytics/project/{id}/stats	Project access	Task history, completion trends
4.8 AI Endpoints
Method	Path	Auth	Request	Response
POST	/ai/summarize-project	manager, platform_admin	{project_id}	{summary, generated_at}
POST	/ai/summarize-org	org_owner, platform_admin	{}	{summary, generated_at}
4.9 Internal Endpoints (Service-to-Service)
All internal endpoints require X-Internal-Token header.

Service	Method	Path	Purpose
Auth	GET	/internal/users/by-email?email=	Get user by email
Auth	GET	/internal/users/{id}/validate-manager	Verify user is manager
Project	GET	/internal/projects/{id}/status	Get archive status
Project	POST	/internal/projects/member-removed	Notify member removal
Task	GET	/internal/tasks/approvals?manager_id=	Get pending approvals
Task	POST	/internal/tasks/{id}/approve	Internal approve
Task	POST	/internal/tasks/{id}/reject	Internal reject
4.10 Response Formats
Success Response:

json
{
  "success": true,
  "data": { ... }
}
Error Response:

json
{
  "error": "Unauthorized",
  "message": "You don't have permission to access this resource",
  "status": 403
}
List Response:

json
{
  "items": [ ... ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
Section 5: Frontend Requirements
5.1 Technology Requirements
Framework: Next.js with App Router

Styling: Tailwind CSS

State Management: React Query for server state, Context for auth/theme

Charts: Recharts or similar library

Forms: React Hook Form with Zod validation

Notifications: Toast notifications + custom bell component

5.2 Page Requirements
Public Routes (no auth required):

/login - Email/password login form

/invite/accept?token={token} - Magic link registration page

/force-reset - Password reset page (redirected after login)

Authenticated Routes (role-based access):

Path	Role	Description
/dashboard	member	Personal task dashboard
/manager	manager	Team management overview
/manager/projects	manager	List all projects
/manager/projects/create	manager	Create new project
/manager/projects/[id]	manager	Project details with Kanban
/manager/approvals	manager	Pending task approvals
/manager/team	manager	Team members list, invite
/org	org_owner	Organization overview
/org/users	org_owner	User management
/org/users/[id]/history	org_owner	User audit history
/org/projects	org_owner	Read-only all projects
/admin	platform_admin	System health dashboard
/admin/users	platform_admin	All users (including revoked)
/admin/audit	platform_admin	System audit log
/profile	All	User profile (change password, notification email)
5.3 Navigation Requirements
Sidebar must be role-aware:

platform_admin: System Health, Users, Audit Log

org_owner: Dashboard, Users, Projects

manager: Dashboard, Projects, Approvals (with badge), Team

member: My Tasks, Projects

Header must include:

Notification bell (shows unread count, dropdown on click)

User menu (Profile, Logout)

Platform name/logo

5.4 Empty State Requirements
When no data exists, show friendly messages:

Scenario	Empty State Message
No projects assigned	"No projects assigned yet. Contact your manager to get started."
No tasks	"All caught up! No tasks assigned. Great job!"
No team members (manager)	"Your team is empty. Invite members to get started."
No pending approvals	"No pending approvals. Great work, team!"
No users (org_owner)	"No users yet. Invite your first team member."
5.5 Loading & Error States
Show skeleton loaders for all async data fetches

Show toast notifications for API errors

Retry failed requests with exponential backoff (max 3 retries)

Display error boundaries for component failures

5.6 API Client Configuration
Base URL from environment variable NEXT_PUBLIC_API_URL

Automatic JWT token injection in request headers

Automatic token refresh on 401 (except login endpoint)

Redirect to login on refresh failure

Section 6: Analytics Dashboard Specifications
6.1 Platform Admin Dashboard
URL: /admin

Data to Display:

System Health Cards:

PostgreSQL status (UP/DOWN)

Redis status (UP/DOWN)

AI Service status (UP/DOWN/ Degraded)

Last health check timestamp

User Statistics:

Total active users (is_active=true)

Users by role (pie chart)

User trend (line chart, last 30 days)

AI Cost Monitoring:

Total token usage this month

Estimated cost (USD)

Cost trend (line chart)

Recent Audit Events:

Last 10 events with timestamp, user, action

Link to full audit log

API Required: GET /analytics/platform/overview

6.2 Org Owner Dashboard
URL: /org

Data to Display:

Organization Stats:

Total managers

Total members

Active projects vs archived projects

Overall task completion rate

Task Throughput by Project:

Bar chart showing tasks completed per project

Last 30 days

Project Status Distribution:

Pie chart: Active vs Archived projects

On click, filter by status

AI Organization Summary:

Button to generate summary

Display AI-generated text

Show generation timestamp

APIs Required:

GET /analytics/org/overview

POST /ai/summarize-org

6.3 Manager Dashboard
URL: /manager

Data to Display:

Team Stats:

Number of members

Pending tasks awaiting approval

Active projects count

Team velocity (tasks/week average)

Team Velocity Chart:

Line chart showing tasks completed per week

Last 8 weeks

Show trend (increasing/decreasing)

Project Status (Stacked Bar):

For each project: completed vs pending tasks

Show completion percentage

AI Project Summary:

Dropdown to select project

Button to generate summary

Display AI summary

APIs Required:

GET /analytics/manager/dashboard

GET /projects?manager=true (for dropdown)

POST /ai/summarize-project

6.4 Member Dashboard
URL: /dashboard

Data to Display:

Personal Stats:

Tasks pending

Tasks in progress

Tasks completed (total)

Personal completion rate

Task Completion History:

Bar chart: tasks completed per week

Last 5 weeks

Task Status Distribution:

Pie chart: TODO vs IN_PROGRESS vs DONE

Show counts and percentages

Recent Activity:

List of recent notifications/updates

Task approvals, assignments, etc.

API Required: GET /analytics/member/dashboard

Section 7: AI Service Requirements
7.1 AI Provider
Use Azure Foundry (OpenAI compatible) OR direct OpenAI API

Model: gpt-3.5-turbo (sufficient for training project)

Fallback to basic summary if API fails (no hard failures)

7.2 Required Environment Variables
Variable	Required	Description
AZURE_FOUNDRY_ENDPOINT	No (if using OpenAI)	Azure endpoint URL
AZURE_FOUNDRY_KEY	No	Azure API key
AZURE_FOUNDRY_DEPLOYMENT	No	Deployment name (default: gpt-35-turbo)
OPENAI_API_KEY	No	OpenAI API key
OPENAI_MODEL	No	Model name (default: gpt-3.5-turbo)
If neither is configured, AI features return fallback summaries without error.

7.3 Summary Prompts
Project Summary Prompt:

text
You are a project management assistant. Summarize this project status concisely:

Project Name: {name}
Total Tasks: {total}
Completed: {completed} ({pct}%)
In Progress: {in_progress}
Blocked: {blocked}
Pending: {pending}

Recent activity (last 7 days):
- Tasks completed: {completed_this_week}
- Tasks created: {created_this_week}

Provide 2-3 sentences focusing on progress, recent momentum, and any blockers.
Organization Summary Prompt:

text
You are an executive assistant. Summarize this organization's health:

Projects:
{project_list}

Overall completion: {total_completed}/{total_tasks} tasks

Provide 3-4 sentences: highlight top performing projects, struggling projects, and overall trends. Be actionable.
7.4 Fallback Behavior
If AI API call fails (timeout, auth error, rate limit):

Return basic statistical summary without AI

Log error but don't expose to user

Example: "Project Alpha is 60% complete with 12/20 tasks done. 3 tasks in progress, 2 blocked."

7.5 No Caching Required
For training project, generate on demand. No caching layer needed. (5-10 users, negligible cost)

Section 8: Notification System Requirements
8.1 Notification Channels
Channel	Implementation	When Used
In-app	Database table + API endpoint	All events (always)
Email	SMTP (if configured)	Task assigned, task approved/rejected, invitations
8.2 Events That Trigger Notifications
Event	In-App	Email	Recipient
Task assigned	✅	✅	Assignee
Task marked complete (needs approval)	✅	✅	Project manager
Task approved	✅	✅	Task assignee
Task rejected	✅	✅	Task assignee
Project archived	✅	❌	All project members
Member transferred	✅	❌	Transferred member
Added to project	✅	❌	New member
Invitation sent	❌	✅	Invited user
8.3 In-App Notification Structure
json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "task_assigned",
  "title": "New Task: Fix Login Bug",
  "content": "You have been assigned to 'Fix Login Bug' by John Manager",
  "metadata": {
    "task_id": "uuid",
    "project_id": "uuid",
    "assigned_by": "John Manager"
  },
  "is_read": false,
  "created_at": "2024-01-15T10:30:00Z"
}
8.4 Notification APIs
Method	Path	Description
GET	/users/me/notifications	List user's notifications (paginated)
GET	/users/me/notifications/unread-count	Get unread count (for badge)
PATCH	/users/me/notifications/{id}/read	Mark as read
PATCH	/users/me/notifications/read-all	Mark all as read
8.5 Email Template Requirements
Task Assigned Email:

text
Subject: [FlowForge] New Task Assigned: {task_title}

Hello {assignee_name},

{assigner_name} assigned you a new task:

Task: {task_title}
Project: {project_name}
Priority: {priority}

View and work on this task: {dashboard_url}

---
FlowForge Platform
Task Approved Email:

text
Subject: [FlowForge] Task Approved: {task_title}

Hello {assignee_name},

Your task "{task_title}" has been APPROVED by {approver_name}.

View your completed tasks: {dashboard_url}

---
FlowForge Platform
Invitation Email:

text
Subject: [FlowForge] You've been invited to join

Hello,

You've been invited to join FlowForge as a {role}.

Click here to set up your account: {invite_url}

This link expires in 7 days.

---
FlowForge Platform
8.6 Event Publishing Requirements
All services that generate events MUST publish to Redis Stream:

text
Stream: notifications
XADD notifications * event_type task_assigned task_id {id} assignee_id {id} ...
Notification worker consumes stream and creates in-app notifications + sends emails.

Section 9: Security Requirements
9.1 Authentication
Requirement	Implementation
Password hashing	bcrypt with salt rounds=12
JWT signing	HS256 with strong secret
JWT expiry	1 hour (refresh token 7 days)
Session management	Stateless JWT + refresh tokens
9.2 Authorization (RBAC)
All API endpoints MUST check role before allowing access.

Role hierarchy for permission inheritance:

platform_admin > org_owner > manager > member

Permission check pattern:

text
can_access_resource(user, resource, action):
    if user.role == 'platform_admin': return True
    if user.role == 'org_owner' and resource.org_id == user.org_id: return True
    if user.role == 'manager' and resource.manager_id == user.id: return True
    if user.role == 'member' and resource.assignee_id == user.id: return True
    return False
9.3 Internal Service Security
All internal endpoints (between services) MUST validate X-Internal-Token header.

python
# Validate in every internal endpoint
if request.headers.get('X-Internal-Token') != INTERNAL_API_KEY:
    return 401 {"error": "Invalid internal token"}
9.4 Data Protection
Requirement	Implementation
Passwords	Never returned in API responses
Email visibility	Only shown to admins and managers (for their team)
Soft delete	Never hard delete users (is_active=false)
Audit logging	Log all sensitive actions (transfers, revokes, role changes)
9.5 Force Password Reset
Users with must_reset_password=true:

CAN ONLY access: /auth/force-reset

All other API requests return 403

Frontend MUST redirect to reset page and block navigation

9.6 CORS Configuration
Allow requests from frontend origin only (localhost:3000 for development).

Section 10: Deployment Requirements
10.1 Docker Compose Services
Service	Port	Dependencies	Description
postgres	5432	-	PostgreSQL database
redis	6379	-	Redis cache + streams
gateway	8000	postgres, redis	API gateway
auth-service	8001	postgres, redis	Auth logic
project-service	8002	postgres, redis, auth-service	Projects
task-service	8003	postgres, redis, project-service	Tasks
analysis-service	8004	postgres, redis	Analytics + AI
notification-worker	-	redis, auth-service	Background worker
frontend	3000	gateway	Next.js app
10.2 Health Check Requirements
Each service MUST expose /health endpoint returning:

json
{ "status": "healthy", "timestamp": "2024-01-15T10:30:00Z" }
Docker Compose health checks should verify:

PostgreSQL: pg_isready

Redis: PING command

Services: HTTP GET /health returns 200

10.3 Required Environment Variables
bash
# Required (no defaults)
JWT_SECRET_KEY=must-change-in-production
INTERNAL_API_KEY=must-change-in-production

# Database (required)
POSTGRES_USER=flowforge
POSTGRES_PASSWORD=must-change
POSTGRES_HOST=postgres

# Optional (with fallbacks)
SMTP_HOST= (email disabled if not set)
AZURE_FOUNDRY_KEY= (AI fallback to basic summary if not set)
OPENAI_API_KEY= (alternative to Azure)
10.4 Bootstrap Requirements
On first startup, run migrations THEN bootstrap users:

Run all CREATE TABLE statements

Check if platform_admin exists

If not, create default accounts

Log: "Bootstrap complete: Admin and Owner accounts created"

Default credentials (force reset required):

Admin: admin@flowforge.com / Admin123!

Owner: owner@flowforge.com / Owner123!

10.5 Logging Requirements
Log levels:

INFO: Service startup/shutdown, bootstrap

WARNING: Retryable failures, degraded mode

ERROR: Service failures, DB connection issues

Log format: JSON with timestamp, level, service, message

10.6 Graceful Degradation
Service Failure	Impact	Mitigation
AI service	No AI summaries	Return basic stats, log error
Email (SMTP)	No email notifications	In-app notifications still work
Redis	No events, no notifications	Core CRUD operations still work
One database	That service only	Other services continue
No cascading failures. Each service should handle dependency failures gracefully.

Section 11: Success Criteria
11.1 Backend Success
All 5 services start successfully with docker-compose up -d

Bootstrap creates admin and owner accounts

Both default accounts have must_reset_password=true

Force reset endpoint works and clears flag

Member cannot exist without manager_id

Transferring member removes old project assignments

Archived projects return 403 for members

Managers cannot edit tasks in archived projects

Task approval flow works end-to-end

In-app notifications are created for all events

Audit logs record all sensitive actions

Internal endpoints require X-Internal-Token

AI summaries return (or fallback gracefully)

11.2 Frontend Success
Login page works

Force reset redirect for default accounts

Magic link invitation flow works

Role-based sidebar shows correct menus

Notification bell shows unread count

Empty states show friendly messages

All charts render with data

Admin sees system health

Org owner can transfer members

Manager can approve/reject tasks

Member can update task status

11.3 API Success
All endpoints return correct status codes

Authentication rejects invalid tokens

Authorization prevents cross-role access

Pagination works on list endpoints

Search/filter parameters work

Error responses have consistent format

Section 12: Development Notes for Antigravity
12.1 What Antigravity Can Assume
The existing codebase structure exists but can be reorganized as needed

Use best practices for each framework (FastAPI, Next.js)

Write clean, maintainable, commented code

No need for enterprise patterns (event sourcing, CQRS, Kafka)

Focus on working software over perfection

12.2 What Antigravity Should NOT Do
Do not over-engineer with unnecessary abstractions

Do not add features not specified in this document

Do not assume multi-tenancy (single tenant only)

Do not add complex caching unless specified

Do not add distributed tracing or service mesh

12.3 Testing Requirements
Write unit tests for critical business logic (role checks, transfer logic, archive rules)

Write integration tests for API endpoints

Ensure all services can start and communicate

Test force password reset flow end-to-end

Test member transfer flow end-to-end

12.4 Documentation Requirements
Each service must have a README with setup instructions

API endpoints documented (can be auto-generated)

Environment variables documented in .env.example

Database schema documented

