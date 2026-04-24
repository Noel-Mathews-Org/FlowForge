"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Shield, ShieldAlert, Key, Plus } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminUsersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", full_name: "", role: "member", org: "Default" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users, isLoading, refetch, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await authApi.get("/admin/users")).data,
  });

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      await authApi.patch(`/admin/users/${userId}`, { is_active: !isActive });
      toast.success("User status updated");
      refetch();
    } catch {
      toast.error("Failed to update user status");
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await authApi.patch(`/admin/users/${userId}`, { role: newRole });
      toast.success("User role updated");
      refetch();
    } catch {
      toast.error("Failed to update user role");
    }
  };

  const handleCreate = async () => {
    if (!newUser.email.trim() || !newUser.full_name.trim()) {
      toast.error("Email and Name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.post("/admin/users", newUser);
      toast.success("User created and email sent");
      setModalOpen(false);
      setNewUser({ email: "", full_name: "", role: "member", org: "Default" });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User Management</h2>
          <p className="text-sm text-slate-500">View and manage workspace members</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="border-b border-slate-200 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr><td colSpan={5} className="p-8 text-center text-rose-500">Failed to load users</td></tr>
              ) : !users || users.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center">No users found</td></tr>
              ) : (
                users.map((user: any) => (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {user.role === "admin" ? <ShieldAlert className="h-3 w-3 text-rose-500" /> : user.role === "manager" ? <Shield className="h-3 w-3 text-indigo-500" /> : <Key className="h-3 w-3 text-emerald-500" />}
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${(user.is_active ?? true) ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {(user.is_active ?? true) ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{format(new Date(user.created_at), "MMM d, yyyy")}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-32 text-left">
                          <SelectField 
                            value={user.role} 
                            onValueChange={(val) => changeRole(user.id, val)} 
                            options={[
                              { value: "member", label: "Member" },
                              { value: "manager", label: "Manager" },
                              { value: "admin", label: "Admin" }
                            ]} 
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => toggleActive(user.id, user.is_active ?? true)}
                        >
                          {(user.is_active ?? true) ? "Deactivate" : "Activate"}
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

      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Create New User</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <Input type="email" placeholder="user@example.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Full Name</label>
                  <Input placeholder="John Doe" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Organization</label>
                  <Input placeholder="Acme Corp" value={newUser.org} onChange={(e) => setNewUser({ ...newUser, org: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Role</label>
                  <SelectField 
                    value={newUser.role} 
                    onValueChange={(val) => setNewUser({ ...newUser, role: val })} 
                    options={[
                      { value: "member", label: "Member" },
                      { value: "manager", label: "Manager" },
                      { value: "admin", label: "Admin" }
                    ]} 
                  />
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
