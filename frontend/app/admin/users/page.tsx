"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Check, X, Shield, ShieldAlert, Key } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";

export default function AdminUsersPage() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  const { data: users, isLoading, refetch } = useQuery({
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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await authApi.post("/invite", { email: inviteEmail, role: inviteRole });
      toast.success("Invite sent successfully");
      setInviteEmail("");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User Management</h2>
          <p className="text-sm text-slate-500">View and manage workspace members</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold">Invite User</h3>
        <div className="flex items-center gap-3">
          <Input 
            placeholder="user@example.com" 
            value={inviteEmail} 
            onChange={(e) => setInviteEmail(e.target.value)} 
            className="max-w-xs"
          />
          <div className="w-32">
            <SelectField 
              value={inviteRole} 
              onValueChange={setInviteRole} 
              options={[
                { value: "member", label: "Member" },
                { value: "manager", label: "Manager" },
                { value: "admin", label: "Admin" }
              ]} 
            />
          </div>
          <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
            {isInviting ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="border-b border-slate-200 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </td>
                </tr>
              ) : !users || users.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center">No users found</td></tr>
              ) : (
                users.map((user: any) => (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {user.role === "admin" ? <ShieldAlert className="h-3 w-3 text-rose-500" /> : user.role === "manager" ? <Shield className="h-3 w-3 text-indigo-500" /> : <Key className="h-3 w-3 text-emerald-500" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{format(new Date(user.created_at), "MMM d, yyyy")}</td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => toggleActive(user.id, user.is_active ?? true)}
                      >
                        {(user.is_active ?? true) ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
