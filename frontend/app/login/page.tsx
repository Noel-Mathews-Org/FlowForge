"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Shield } from "lucide-react";
import { FormEvent, useState, ChangeEvent } from "react";
import { authApi } from "@/lib/api";
import { getUser, routeForRole, setToken, setRefreshToken, isEntraEnabled, loginWithEntra } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const handleEntraLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithEntra();
      const user = getUser();
      if (user) window.location.href = routeForRole(user.role);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Microsoft sign-in failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      setSubmitting(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setSubmitting(false);
      return;
    }

    try {
      const { data } = await authApi.post("/login", { email: email.trim(), password });
      setToken(data.access_token);

      // Obtain refresh token (non-blocking)
      try {
        const rt = await authApi.post("/token/issue");
        setRefreshToken(rt.data.refresh_token);
      } catch { /* ignore — access token still works */ }

      // Force-reset check
      if (data.must_reset_password) {
        window.location.href = "/force-reset";
        return;
      }

      const user = getUser();
      if (user) window.location.href = routeForRole(user.role);
    } catch {
      setError("Unable to sign in. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[45%_55%]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1e1b4b] to-[#4c1d95] p-12 text-white md:flex">
        <div>
          <h1 className="text-5xl font-light tracking-tight">FlowForge</h1>
          <p className="mt-3 text-base text-indigo-100">Enterprise workflow orchestration</p>
          <div className="mt-8 flex gap-2">
            {["Zero-trust auth", "Real-time Kanban", "Role-based access"].map((pill) => (
              <span key={pill} className="rounded-full border border-indigo-400/40 bg-indigo-950/30 px-3 py-1 text-xs">
                {pill}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-8 gap-2 opacity-80">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className={`h-4 rounded-sm ${i % 9 === 0 ? "bg-violet-500" : "bg-indigo-800"}`} />
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center bg-white px-4 py-12 sm:px-8 md:px-20 dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="w-full max-w-md"
        >
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Sign in to your workspace</p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600 dark:border-rose-900 dark:bg-rose-900/20"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Entra ID (Microsoft) Login ─── */}
          {isEntraEnabled && (
            <div className="mt-6">
              <Button
                onClick={handleEntraLogin}
                disabled={submitting}
                className="h-12 w-full rounded-xl bg-[#2f2f2f] text-white hover:bg-[#404040] dark:bg-[#f3f3f3] dark:text-[#1a1a1a] dark:hover:bg-[#e0e0e0] transition-all"
              >
                <AnimatePresence mode="wait">
                  {submitting ? (
                    <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" />
                  ) : (
                    <motion.span key="txt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                      <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                      </svg>
                      Sign in with Microsoft
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              {/* Toggle for fallback email/password login */}
              <button
                type="button"
                onClick={() => setShowFallback(!showFallback)}
                className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showFallback ? "Hide" : "Use"} email & password instead
              </button>
            </div>
          )}

          {/* ─── Email/Password Fallback (or primary if Entra not enabled) ─── */}
          {(!isEntraEnabled || showFallback) && (
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {isEntraEnabled && (
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span className="text-xs text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>
              )}
              <div className={`${isEntraEnabled ? "" : "mt-6"} space-y-4`}>
                <Input value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="Email" type="email" required className="w-full" />
                <div className="relative">
                  <Input
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-3 text-slate-400">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button disabled={submitting} className="h-11 w-full">
                  <AnimatePresence mode="wait">
                    {submitting ? (
                      <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <motion.span key="txt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Sign in
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </motion.form>
          )}

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Don&apos;t have an account? Contact your administrator.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
