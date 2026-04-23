"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const invalid = useMemo(() => !token || token.length < 8, [token]);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(invalid ? "Registration token is invalid or missing." : null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    setError(null);
    try {
      await authApi.post("/api/auth/register", { token, full_name: fullName, password });
      toast.success("Account created! Sign in to continue");
      router.replace("/login");
    } catch {
      setError("Registration failed. Your token may be expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Finish setup for your FlowForge workspace.</p>
        {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/20">{error}</div>}
        <div className="mt-4 space-y-3">
          <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} required />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input placeholder="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <Button disabled={loading || invalid} className="w-full">
            {loading ? "Creating..." : "Create account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
