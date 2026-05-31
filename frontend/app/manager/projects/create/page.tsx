"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { projectApi } from "@/lib/api";

export default function CreateProjectPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [desc, setDesc]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Project name is required."); return; }
    setLoading(true);
    try {
      const { data } = await projectApi.post("", { name: name.trim(), description: desc.trim() });
      router.push(`/manager/projects/${data.id}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to create project. Name may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">New Project</h2>
        <p className="mt-1 text-sm text-slate-500">Create a project and assign tasks to your team.</p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/20">{error}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Project Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required maxLength={120}
              placeholder="e.g. API Redesign Q3"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} maxLength={500}
              placeholder="What is this project about?"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              {loading ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
