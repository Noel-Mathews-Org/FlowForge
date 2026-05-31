"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { User, Key, Bell } from "lucide-react";

export default function ProfilePage() {
  const user = getUser();
  const [fullName, setName]        = useState(user?.full_name ?? "");
  const [notifEmail, setNotif]     = useState("");
  const [oldPw, setOld]            = useState("");
  const [newPw, setNew]            = useState("");
  const [toast, setToast]          = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving]        = useState(false);
  const [changingPw, setChangePw]  = useState(false);

  const show = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    authApi.get("/me").then(({ data }) => {
      setName(data.full_name ?? "");
      setNotif(data.notification_email ?? "");
    }).catch(() => {});
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.put("/me", { full_name: fullName, notification_email: notifEmail || null });
      show("Profile updated ✓", true);
    } catch { show("Failed to update profile", false); }
    finally { setSaving(false); }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { show("New password must be at least 8 characters.", false); return; }
    setChangePw(true);
    try {
      await authApi.post("/change-password", { old_password: oldPw, new_password: newPw });
      show("Password changed ✓", true);
      setOld(""); setNew("");
    } catch (err: any) {
      show(err?.response?.data?.detail ?? "Failed to change password", false);
    } finally { setChangePw(false); }
  };

  const roleColors: Record<string, string> = {
    platform_admin: "bg-violet-100 text-violet-700",
    org_owner:      "bg-blue-100 text-blue-700",
    manager:        "bg-amber-100 text-amber-700",
    member:         "bg-slate-100 text-slate-600",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {toast && (
        <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.ok ? "bg-emerald-600" : "bg-rose-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
            <p className="mt-2 text-indigo-100">Manage your personal information and security settings.</p>
          </div>
          {user?.role && (
            <div className="mt-4 sm:mt-0">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                user.role === "platform_admin" ? "bg-fuchsia-500/20 text-fuchsia-100" :
                user.role === "org_owner" ? "bg-blue-500/20 text-blue-100" :
                user.role === "manager" ? "bg-amber-500/20 text-amber-100" :
                "bg-slate-500/20 text-slate-100"
              }`}>
                {user.role.replace("_", " ")}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Profile info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personal Details</h2>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
              <input value={fullName} onChange={e => setName(e.target.value)} required placeholder="Your full name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                <Bell className="mr-1 h-3.5 w-3.5" /> Notification Email
              </label>
              <input value={notifEmail} onChange={e => setNotif(e.target.value)} type="email" placeholder="Defaults to login email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={saving}
                className="w-full rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-700">
                {saving ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Change password */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security</h2>
              <p className="text-xs text-slate-500">Update your password</p>
            </div>
          </div>
          
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</label>
              <input value={oldPw} onChange={e => setOld(e.target.value)} required type="password" placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">New Password</label>
              <input value={newPw} onChange={e => setNew(e.target.value)} required type="password" placeholder="Min 8 characters" minLength={8}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={changingPw}
                className="w-full rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-700">
                {changingPw ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
