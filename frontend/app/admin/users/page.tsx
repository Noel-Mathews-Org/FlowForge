"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Shield, ShieldAlert, Key, Plus, Trash2, Mail, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [newUser, setNewUser] = useState({ email: "", full_name: "", role: "member", org: "Default" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await authApi.get("/users")).data,
  });

  const toggleActive = useMutation({
    mutationFn: (user: any) =>
      user.is_active ? authApi.patch(`/users/${user.id}/revoke`) : authApi.patch(`/users/${user.id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated");
    },
    onError: () => toast.error("Failed to update user status"),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      authApi.patch(`/users/${userId}/role`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User role updated");
    },
    onError: () => toast.error("Failed to update user role"),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => authApi.patch(`/users/${userId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deactivated");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const handleCreate = async () => {
    if (!newUser.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.post("/invite", { email: newUser.email.trim(), role: newUser.role });
      toast.success("User invite sent successfully");
      setModalOpen(false);
      setNewUser({ email: "", full_name: "", role: "member", org: "Default" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to invite user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">User Governance</h2>
          <p className="text-sm font-medium text-slate-500">Manage global roles, permissions and account access.</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="h-11 gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
          <Plus className="h-4 w-4" /> 
          <span className="font-semibold">Add New User</span>
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">User Profile</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Role & Authority</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Status</th>
                <th className="hidden px-6 py-4 font-bold uppercase tracking-wider lg:table-cell">Registered</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={5} className="py-20 text-center text-rose-500 font-medium">Failed to establish connection with User Service.</td></tr>
              ) : !users || users.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium">No records found in the directory.</td></tr>
              ) : (
                users.map((user: any) => (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {user.full_name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{user.full_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {user.role === "admin" ? <ShieldAlert className="h-3 w-3 text-rose-500" /> : user.role === "manager" ? <Shield className="h-3 w-3 text-indigo-500" /> : <Key className="h-3 w-3 text-emerald-500" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          user.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-700"
                        )} />
                        <span className={cn(
                          "text-xs font-semibold",
                          user.is_active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                        )}>
                          {user.is_active ? "Authorized" : "Revoked"}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 lg:table-cell">
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="hidden w-36 sm:block">
                          <SelectField
                            value={user.role}
                            onValueChange={(val) => changeRole.mutate({ userId: user.id, newRole: val })}
                            options={[
                              { value: "member", label: "Team Member" },
                              { value: "manager", label: "Manager" },
                              { value: "org_owner", label: "Org Owner" },
                              { value: "platform_admin", label: "Platform Admin" }
                            ]}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-9 rounded-xl border border-slate-100 dark:border-slate-800 font-semibold px-4",
                            user.is_active ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          )}
                          title={user.is_active ? "Deactivate User" : "Activate User"}
                          onClick={() => toggleActive.mutate(user)}
                          disabled={toggleActive.isPending}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl border border-slate-100 text-rose-500 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/30"
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals remain mostly same but with better styling */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Onboard New User</h3>
                <p className="text-sm text-slate-500">Provision a new account with specific role access.</p>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <Input type="email" placeholder="email@example.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="h-11" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                  <Input placeholder="Full Name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="h-11" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Security Role</label>
                  <SelectField
                    value={newUser.role}
                    onValueChange={(val) => setNewUser({ ...newUser, role: val })}
                    options={[
                      { value: "member", label: "Team Member" },
                      { value: "manager", label: "Project Manager" },
                      { value: "org_owner", label: "Organization Owner" },
                    ]}
                  />
                </div>
                <div className="mt-8 flex gap-3">
                  <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={isSubmitting} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700">
                    {isSubmitting ? "Provisioning..." : "Create Account"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">Deactivate Identity</h3>
              <p className="mb-8 text-sm text-slate-500 leading-relaxed">
                You are about to revoke access for <span className="font-bold text-slate-900 dark:text-white">{deleteTarget.full_name}</span>. This action can be reversed, but the user will be logged out immediately.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setDeleteTarget(null)}>Abort</Button>
                <Button
                  className="flex-1 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                  onClick={() => deleteUser.mutate(deleteTarget.id)}
                  disabled={deleteUser.isPending}
                >
                  Confirm Revoke
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
