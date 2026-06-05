"use client";

import { useEffect, useState } from "react";
import {
  Users, UserMinus, UserPlus, Loader2, Mail, Shield, ShieldAlert, Key,
  ArrowRightLeft, Search, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { format } from "date-fns";

type OrgUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  manager_id?: string;
  notification_email?: string;
  created_at?: string;
};

export default function OrgUsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setEmail] = useState("");
  const [inviteRole, setRole] = useState("manager");
  const [inviteManager, setInviteManager] = useState("");
  const [inviting, setInviting] = useState(false);
  const [transferUser, setTransferUser] = useState<OrgUser | null>(null);
  const [newManagerId, setNewManagerId] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [validatingEmail, setValidatingEmail] = useState(false);

  const user = getUser();

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    authApi
      .get("/users")
      .then(({ data }) => setUsers(data.users ?? data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role !== "org_owner" && user?.role !== "platform_admin") {
      window.location.href = "/login";
      return;
    }
    load();
  }, []);

  // Validate email before invite – check if user already exists
  const validateAndInvite = async () => {
    if (!inviteEmail.trim()) return;
    if (inviteRole === "member" && !inviteManager) {
      showToast("Please select a manager for the member", false);
      return;
    }

    setInviteError(null);
    setValidatingEmail(true);

    try {
      // Check if a user with this email already exists
      const checkResp = await authApi.get("/users");
      const allUsers: OrgUser[] = checkResp.data.users ?? checkResp.data;
      const existingUser = allUsers.find(
        (u) => u.email.toLowerCase() === inviteEmail.trim().toLowerCase()
      );

      if (existingUser) {
        setInviteError(
          `A user with email "${inviteEmail.trim()}" already exists (${existingUser.full_name}, role: ${existingUser.role}). Cannot send a duplicate invite.`
        );
        setValidatingEmail(false);
        return;
      }
    } catch {
      // If we can't validate, proceed but warn
    }

    setValidatingEmail(false);
    setInviting(true);
    try {
      await authApi.post("/invite", {
        email: inviteEmail.trim(),
        role: inviteRole,
        manager_id: inviteRole === "member" ? inviteManager : undefined,
      });
      showToast(`Invite sent to ${inviteEmail}`, true);
      setEmail("");
      setInviteManager("");
      setInviteError(null);
      load(); // Refresh user list
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Failed to send invite";
      showToast(msg, false);
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await authApi.patch(`/users/${id}/revoke`);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: false } : u))
      );
      showToast("User revoked", true);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Cannot revoke user", false);
    }
  };

  const activate = async (id: string) => {
    try {
      await authApi.patch(`/users/${id}/activate`);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: true } : u))
      );
      showToast("User activated", true);
    } catch {
      showToast("Failed to activate", false);
    }
  };

  const transfer = async () => {
    if (!transferUser || !newManagerId) return;
    try {
      await authApi.patch(`/users/${transferUser.id}/transfer`, {
        new_manager_id: newManagerId,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === transferUser.id ? { ...u, manager_id: newManagerId } : u
        )
      );
      showToast("User transferred successfully", true);
      setTransferUser(null);
      setNewManagerId("");
    } catch (err: any) {
      showToast(
        err?.response?.data?.detail ?? "Failed to transfer user",
        false
      );
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await authApi.patch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast("User role updated", true);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Failed to update role", false);
    }
  };

  const roleColors: Record<string, string> = {
    platform_admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    org_owner: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    manager: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    member: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  const roleIcons: Record<string, typeof Shield> = {
    platform_admin: ShieldAlert,
    org_owner: Shield,
    manager: Shield,
    member: Key,
  };

  const managers = users.filter((u) => u.role === "manager" && u.is_active);

  // Get manager name by ID
  const getManagerName = (managerId?: string) => {
    if (!managerId) return "—";
    const mgr = users.find((u) => u.id === managerId);
    return mgr ? mgr.full_name : "—";
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !u.full_name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      )
        return false;
    }
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "revoked" && u.is_active) return false;
    return true;
  });

  // Summary stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const totalManagers = users.filter((u) => u.role === "manager").length;
  const totalMembers = users.filter((u) => u.role === "member").length;

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${
            toast.ok ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            User Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage all organization users, roles, and permissions.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalUsers}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeUsers}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Managers</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{totalManagers}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Members</p>
          <p className="mt-1 text-2xl font-bold text-slate-700 dark:text-slate-300">{totalMembers}</p>
        </div>
      </div>

      {/* Invite Section */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Mail className="h-4 w-4 text-violet-600" /> Invite New User
        </h3>
        <div className="flex flex-wrap gap-3">
          <input
            value={inviteEmail}
            onChange={(e) => {
              setEmail(e.target.value);
              setInviteError(null);
            }}
            type="email"
            placeholder="Email address"
            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={inviteRole}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
          {inviteRole === "member" && (
            <select
              value={inviteManager}
              onChange={(e) => setInviteManager(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select Manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={validateAndInvite}
            disabled={inviting || validatingEmail || !inviteEmail.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {inviting || validatingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {validatingEmail ? "Validating…" : inviting ? "Sending…" : "Invite"}
          </button>
        </div>
        {/* Invite Error Banner */}
        {inviteError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{inviteError}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Roles</option>
          <option value="platform_admin">Platform Admin</option>
          <option value="org_owner">Org Owner</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Users className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-500">
            {users.length === 0
              ? "No users yet. Invite your first team member."
              : "No users match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                {["User", "Role", "Manager", "Status", "Registered", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredUsers.map((u) => {
                const RoleIcon =
                  roleIcons[u.role] || Key;
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {u.full_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {u.full_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            roleColors[u.role] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {u.role.replace("_", " ")}
                        </span>
                        {/* Role change dropdown for non-admin, non-self */}
                        {u.id !== user?.sub &&
                          u.role !== "platform_admin" && (
                            <select
                              value={u.role}
                              onChange={(e) =>
                                changeRole(u.id, e.target.value)
                              }
                              className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-[10px] outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              <option value="member">Member</option>
                              <option value="manager">Manager</option>
                              <option value="org_owner">Org Owner</option>
                            </select>
                          )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {u.role === "member"
                        ? getManagerName(u.manager_id)
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.is_active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}
                      >
                        {u.is_active ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {u.is_active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {u.created_at
                        ? format(new Date(u.created_at), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {u.role !== "platform_admin" &&
                          u.role !== "org_owner" &&
                          u.id !== user?.sub && (
                            <>
                              {u.is_active ? (
                                <button
                                  onClick={() => revoke(u.id)}
                                  className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/30"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />{" "}
                                  Revoke
                                </button>
                              ) : (
                                <button
                                  onClick={() => activate(u.id)}
                                  className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />{" "}
                                  Activate
                                </button>
                              )}
                            </>
                          )}
                        {u.role === "member" && u.is_active && (
                          <button
                            onClick={() => setTransferUser(u)}
                            className="flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />{" "}
                            Transfer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Modal */}
      {transferUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
              Transfer Member
            </h3>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              Select a new manager for{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {transferUser.full_name}
              </span>
              . This will reassign all their project memberships.
            </p>
            {transferUser.manager_id && (
              <p className="mb-4 text-xs text-slate-500">
                Current manager:{" "}
                <span className="font-medium">
                  {getManagerName(transferUser.manager_id)}
                </span>
              </p>
            )}
            <select
              value={newManagerId}
              onChange={(e) => setNewManagerId(e.target.value)}
              className="mb-6 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select New Manager</option>
              {managers
                .filter((m) => m.id !== transferUser.manager_id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTransferUser(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={transfer}
                disabled={!newManagerId}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
