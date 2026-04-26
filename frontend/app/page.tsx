"use client";

import Link from "next/link";
import { BarChart3, Shield, Zap, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8 lg:px-16">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/30">
              FF
            </div>
            <span className="text-xl font-bold tracking-tight text-white">FlowForge</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400">Features</Link>
            <Button asChild className="rounded-full bg-indigo-600 px-6 hover:bg-indigo-700">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-slate-600 dark:text-slate-300"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <div className="flex flex-col gap-4">
              <Link href="#features" className="text-sm font-medium text-slate-600 dark:text-slate-300" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
              <Button asChild className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-8 sm:py-32 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col items-start gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-400">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse-dot" />
                Enterprise Workflow Orchestration
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Master your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">workflows.</span>
              </h1>
              <p className="max-w-xl text-base text-zinc-400 sm:text-lg">
                The ultimate orchestration platform for modern teams. Streamline approvals, track tasks, and boost throughput with enterprise-grade security.
              </p>
              <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto rounded-full bg-indigo-600 px-8 hover:bg-indigo-700">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-full border-slate-200 px-8 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                  <Link href="#features">Learn more</Link>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-30 blur-2xl dark:opacity-20" />
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex items-center justify-center p-8">
                {/* Mock UI Dashboard inside Hero */}
                <div className="w-full h-full border border-slate-100 dark:border-slate-800 rounded-lg flex flex-col p-4 bg-slate-50/50 dark:bg-slate-950/50">
                  <div className="flex gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-rose-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex gap-4 flex-1">
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-2 shadow-sm">
                      <div className="w-20 h-2 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
                      <div className="w-full h-12 rounded border border-slate-100 dark:border-slate-800 mb-2 bg-slate-50 dark:bg-slate-950" />
                      <div className="w-full h-16 rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950" />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-2 shadow-sm">
                      <div className="w-24 h-2 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
                      <div className="w-full h-20 rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-black px-4 py-20 sm:px-8 sm:py-32 lg:px-16 border-y border-zinc-800">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Built for scale. Designed for speed.</h2>
            <p className="mt-4 text-lg text-zinc-400">Everything you need to manage your organization&apos;s workflow from end to end.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Real-time Kanban</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Drag and drop tasks instantly with our highly optimized, real-time Kanban boards.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Role-Based Access</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Granular permissions and robust approval workflows ensure security at every step.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-950 sm:col-span-2 lg:col-span-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Advanced Analytics</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Get insights into team throughput, task status distribution, and complete audit trails.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 py-12 px-4 sm:px-8 lg:px-16 border-t border-zinc-800">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-xs">FF</div>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">© 2026 FlowForge Inc.</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500 dark:text-slate-400">
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
