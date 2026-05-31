"use client";

import { FormEvent, useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { User, Key, Bell, Loader2, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const user = getUser();
  const [fullName, setName]        = useState(user?.full_name ?? "");
  const [notifEmail, setNotif]     = useState("");
  const [oldPw, setOld]            = useState("");
  const [newPw, setNew]            = useState("");
  const [saving, setSaving]        = useState(false);
  const [changingPw, setChangePw]  = useState(false);
  const [loading, setLoading]      = useState(true);

  useEffect(() => {
    authApi.get("/me").then(({ data }) => {
      setName(data.full_name ?? "");
      setNotif(data.notification_email ?? "");
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load profile data");
      setLoading(false);
    });
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.put("/me", { full_name: fullName, notification_email: notifEmail || null });
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setChangePw(true);
    try {
      await authApi.post("/change-password", { old_password: oldPw, new_password: newPw });
      toast.success("Password changed successfully");
      setOld("");
      setNew("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to change password");
    } finally {
      setChangePw(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Account Settings</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Manage your personal information and security preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {fullName ? fullName[0].toUpperCase() : user?.email?.[0].toUpperCase() ?? "U"}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Personal Details</h3>
              <p className="text-sm text-slate-500">Update your account information</p>
            </div>
            {user?.role && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Shield className="h-3 w-3" />
                {user.role.replace("_", " ")}
              </span>
            )}
          </div>
          
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Full Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  value={fullName} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-slate-200 bg-transparent py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:text-white" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Primary Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  value={user?.email || ""} 
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-500 outline-none cursor-not-allowed dark:border-slate-800 dark:bg-slate-900/50" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                Notification Email <span className="text-[10px] text-slate-400 normal-case">(Optional)</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Bell className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  value={notifEmail} 
                  onChange={e => setNotif(e.target.value)} 
                  type="email" 
                  placeholder="Defaults to primary email"
                  className="w-full rounded-xl border border-slate-200 bg-transparent py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:text-white" 
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Security Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Security</h3>
              <p className="text-sm text-slate-500">Update your password</p>
            </div>
          </div>
          
          <form onSubmit={changePassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Password
              </label>
              <input 
                value={oldPw} 
                onChange={e => setOld(e.target.value)} 
                required 
                type="password" 
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:text-white" 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                New Password
              </label>
              <input 
                value={newPw} 
                onChange={e => setNew(e.target.value)} 
                required 
                type="password" 
                placeholder="Min 8 characters" 
                minLength={8}
                className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:text-white" 
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="outline" disabled={changingPw} className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50">
                {changingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
