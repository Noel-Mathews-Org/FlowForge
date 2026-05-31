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
    <div className="mx-auto max-w-4xl space-y-8 pb-12 pt-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed right-6 top-24 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-md ${toast.ok ? "bg-emerald-600/90" : "bg-rose-600/90"}`}>
          {toast.msg}
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-700 to-indigo-900 p-10 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl mix-blend-overlay"></div>
        
        <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white/20 p-1 backdrop-blur-md shadow-inner border border-white/20">
            <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] bg-indigo-900/40 text-4xl font-bold uppercase">
              {fullName ? fullName[0] : user?.email?.[0] ?? "U"}
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-black tracking-tight text-white">{fullName || "Your Profile"}</h1>
            <p className="mt-1.5 text-lg font-medium text-indigo-200">{user?.email}</p>
          </div>
          {user?.role && (
            <div className="shrink-0">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold uppercase tracking-widest shadow-inner backdrop-blur-md ${
                user.role === "platform_admin" ? "bg-fuchsia-500/20 text-fuchsia-100 border border-fuchsia-500/30" :
                user.role === "org_owner" ? "bg-blue-500/20 text-blue-100 border border-blue-500/30" :
                user.role === "manager" ? "bg-amber-500/20 text-amber-100 border border-amber-500/30" :
                "bg-slate-500/20 text-slate-100 border border-slate-500/30"
              }`}>
                <span className="h-2 w-2 rounded-full bg-current animate-pulse"></span>
                {user.role.replace("_", " ")}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Profile info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm backdrop-blur-xl transition-all hover:shadow-xl hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-violet-700">
          
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-100/50 blur-2xl transition-all group-hover:bg-violet-200/50 dark:bg-violet-900/20"></div>

          <div className="relative mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-600 shadow-sm dark:from-violet-900/40 dark:to-indigo-900/20 dark:text-violet-400">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Personal Details</h2>
              <p className="text-sm font-medium text-slate-500">Update your account information</p>
            </div>
          </div>
          
          <form onSubmit={saveProfile} className="relative space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Full Name</label>
              <input value={fullName} onChange={e => setName(e.target.value)} required placeholder="Your full name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:focus:bg-slate-900" />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Bell className="h-3.5 w-3.5" /> Notification Email
              </label>
              <input value={notifEmail} onChange={e => setNotif(e.target.value)} type="email" placeholder="Defaults to login email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:focus:bg-slate-900" />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={saving}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/40 disabled:opacity-50 disabled:hover:scale-100">
                {saving ? "Saving Changes…" : "Save Profile"}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Change password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm backdrop-blur-xl transition-all hover:shadow-xl hover:border-rose-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-rose-700">
          
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-100/50 blur-2xl transition-all group-hover:bg-rose-200/50 dark:bg-rose-900/20"></div>

          <div className="relative mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-orange-50 text-rose-600 shadow-sm dark:from-rose-900/40 dark:to-orange-900/20 dark:text-rose-400">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security Settings</h2>
              <p className="text-sm font-medium text-slate-500">Manage your password</p>
            </div>
          </div>
          
          <form onSubmit={changePassword} className="relative space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Current Password</label>
              <input value={oldPw} onChange={e => setOld(e.target.value)} required type="password" placeholder="••••••••"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:focus:bg-slate-900" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">New Password</label>
              <input value={newPw} onChange={e => setNew(e.target.value)} required type="password" placeholder="Min 8 characters" minLength={8}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:focus:bg-slate-900" />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={changingPw}
                className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-slate-800 disabled:opacity-50 disabled:hover:scale-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                {changingPw ? "Updating Password…" : "Update Password"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
