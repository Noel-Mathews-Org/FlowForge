"use client";

import { useEffect, useState } from "react";
import { Users, UserMinus, UserPlus, Loader2, Mail } from "lucide-react";
import { authApi, projectApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

type OrgUser = { id: string; email: string; full_name: string; role: string; is_active: boolean; manager_id?: string };

export default function OrgUsersPage() {
  const [users, setUsers]       = useState<OrgUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inviteEmail, setEmail] = useState("");
  const [inviteRole, setRole]   = useState("manager");
  const [inviteManager, setInviteManager] = useState("");
  const [inviting, setInviting] = useState(false);
  const [transferUser, setTransferUser] = useState<OrgUser | null>(null);
  const [newManagerId, setNewManagerId] = useState("");
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const user = getUser();

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    authApi.get("/users").then(({ data }) => setUsers(data.users ?? data))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role !== "org_owner" && user?.role !== "platform_admin") {
      window.location.href = "/login"; return;
    }
    load();
  }, []);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    if (inviteRole === "member" && !inviteManager) {
      showToast("Please select a manager for the member", false);
      return;
    }
    setInviting(true);
    try {
      await authApi.post("/invite", { email: inviteEmail.trim(), role: inviteRole, manager_id: inviteRole === "member" ? inviteManager : undefined });
      showToast(`Invite sent to ${inviteEmail}`, true);
      setEmail("");
      setInviteManager("");
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Failed to send invite", false);
    } finally { setInviting(false); }
  };

  const revoke = async (id: string) => {
    try {
      await authApi.patch(`/users/${id}/revoke`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: false } : u));
      showToast("User revoked", true);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Cannot revoke user", false);
    }
  };

  const activate = async (id: string) => {
    try {
      await authApi.patch(`/users/${id}/activate`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: true } : u));
      showToast("User activated", true);
    } catch { showToast("Failed to activate", false); }
  };

  const transfer = async () => {
    if (!transferUser || !newManagerId) return;
    try {
      await authApi.patch(`/users/${transferUser.id}/transfer`, { new_manager_id: newManagerId });
      setUsers(prev => prev.map(u => u.id === transferUser.id ? { ...u, manager_id: newManagerId } : u));
      showToast("User transferred successfully", true);
      setTransferUser(null);
      setNewManagerId("");
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Failed to transfer user", false);
    }
  };

  const roleColors: Record<string, string> = {
    platform_admin: "bg-violet-100 text-violet-700",
    org_owner:      "bg-blue-100 text-blue-700",
    manager:        "bg-amber-100 text-amber-700",
    member:         "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.ok ? "bg-emerald-600" : "bg-rose-600"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">{users.filter(u => u.is_active).length} active users</p>
        </div>
      </div>

      {/* Invite */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Mail className="h-4 w-4 text-violet-600" /> Invite New User
        </h3>
        <div className="flex flex-wrap gap-3">
          <input value={inviteEmail} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address"
            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          <select value={inviteRole} onChange={e => setRole(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
          {inviteRole === "member" && (
            <select value={inviteManager} onChange={e => setInviteManager(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Select Manager</option>
              {users.filter(u => u.role === "manager").map(m => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
              ))}
            </select>
          )}
          <button onClick={invite} disabled={inviting || !inviteEmail.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Invite
          </button>
        </div>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Users className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-500">No users yet. Invite your first team member.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                {["User", "Role", "Status", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleColors[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {u.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {u.role !== "platform_admin" && u.role !== "org_owner" && (
                        u.is_active ? (
                          <button onClick={() => revoke(u.id)}
                            className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
                            <UserMinus className="h-3.5 w-3.5" /> Revoke
                          </button>
                        ) : (
                          <button onClick={() => activate(u.id)}
                            className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50">
                            <UserPlus className="h-3.5 w-3.5" /> Activate
                          </button>
                        )
                      )}
                      {u.role === "member" && u.is_active && (
                        <button onClick={() => setTransferUser(u)}
                          className="flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                          Transfer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Modal */}
      {transferUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Transfer Member</h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Select a new manager for {transferUser.full_name}. This will reassign all their projects.
            </p>
            <select value={newManagerId} onChange={e => setNewManagerId(e.target.value)}
              className="mb-6 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Select New Manager</option>
              {users.filter(u => u.role === "manager" && u.id !== transferUser.manager_id).map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setTransferUser(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={transfer} disabled={!newManagerId} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">Confirm Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
