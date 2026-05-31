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
    <div className="mx-auto max-w-2xl space-y-6">
      {toast && (
        <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.ok ? "bg-emerald-600" : "bg-rose-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Profile info */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 mb-5">
          <User className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profile</h2>
          {user?.role && (
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${roleColors[user.role] ?? ""}`}>
              {user.role.replace("_", " ")}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-4">Email: <span className="font-medium text-slate-700 dark:text-slate-300">{user?.email}</span></p>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
            <input value={fullName} onChange={e => setName(e.target.value)} required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              <Bell className="inline h-3.5 w-3.5 mr-1" />Notification Email (optional)
            </label>
            <input value={notifEmail} onChange={e => setNotif(e.target.value)} type="email" placeholder="Defaults to login email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <button type="submit" disabled={saving}
            className="rounded-xl bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </motion.div>

      {/* Change password */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 mb-5">
          <Key className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          <input value={oldPw} onChange={e => setOld(e.target.value)} required type="password" placeholder="Current password"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          <input value={newPw} onChange={e => setNew(e.target.value)} required type="password" placeholder="New password (min 8 chars)" minLength={8}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          <button type="submit" disabled={changingPw}
            className="rounded-xl bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {changingPw ? "Updating…" : "Update Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
