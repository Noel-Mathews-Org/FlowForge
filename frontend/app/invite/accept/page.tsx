"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import { setToken, setRefreshToken, routeForRole, getUser } from "@/lib/auth";

function InviteAcceptContent() {
  const params = useSearchParams();
  const token  = params.get("token") ?? "";

  const [info, setInfo]       = useState<{ email: string; role: string } | null>(null);
  const [password, setPass]   = useState("");
  const [fullName, setName]   = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!token) { setError("Missing invitation token."); setVerifying(false); return; }
    authApi.get(`/invite/verify?token=${token}`)
      .then(({ data }) => { setInfo(data); setVerifying(false); })
      .catch(() => { setError("Invalid or expired invitation link."); setVerifying(false); });
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const { data } = await authApi.post("/invite/accept", { token, password, full_name: fullName });
      setToken(data.access_token);
      try {
        const rt = await authApi.post("/token/issue");
        setRefreshToken(rt.data.refresh_token);
      } catch { /* optional */ }
      const user = getUser();
      window.location.href = user ? routeForRole(user.role) : "/dashboard";
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to set up account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e1b4b] to-[#4c1d95] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900"
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accept Invitation</h1>
        <p className="mt-1 text-sm text-slate-500">Set up your FlowForge account</p>

        {verifying && <p className="mt-6 text-sm text-slate-500">Verifying invitation…</p>}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div>
        )}

        {info && !verifying && (
          <>
            <div className="mt-4 rounded-xl bg-violet-50 p-4 dark:bg-violet-900/20">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Email:</span> {info.email}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Role:</span> {info.role.replace("_", " ")}
              </p>
            </div>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Full Name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPass(e.target.value)}
                required
                minLength={8}
                placeholder="Choose a password (min 8 chars)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? "Setting up…" : "Create Account & Sign In"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e1b4b] to-[#4c1d95] p-4 text-white">Loading...</div>}>
      <InviteAcceptContent />
    </Suspense>
  );
}
