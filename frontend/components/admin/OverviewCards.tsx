"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import type { AnalyticsOverview } from "@/types";

export const OverviewCards = ({ overview }: { overview: AnalyticsOverview }) => {
  const cards = [
    { label: "Total Tasks", value: overview.total_tasks, color: "indigo", trend: overview.events_today, trendLabel: "events today" },
    { label: "Active Projects", value: overview.total_projects, color: "emerald", trend: null },
    { label: "Team Members", value: overview.total_users, color: "violet", trend: null },
    { label: "Completion Rate", value: `${overview.completion_rate}%`, color: "amber", trend: null, circle: true }
  ];

  const colors: Record<string, string> = {
    indigo: "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/5",
    emerald: "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5",
    violet: "border-violet-500 bg-violet-50/50 dark:bg-violet-500/5",
    amber: "border-amber-500 bg-amber-50/50 dark:bg-amber-500/5"
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} 
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <motion.article
          key={card.label}
          variants={{ 
            hidden: { opacity: 0, y: 20 }, 
            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } } 
          }}
          className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 border-l-4 ${colors[card.color]}`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{card.label}</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{card.value}</p>
            {card.circle ? (
              <div className="relative h-12 w-12">
                <svg className="h-12 w-12 -rotate-90">
                  <circle cx="24" cy="24" r="18" strokeWidth="4" className="stroke-slate-100 dark:stroke-slate-800" fill="none" />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    strokeWidth="4"
                    strokeDasharray={113}
                    strokeDashoffset={113 - (113 * overview.completion_rate) / 100}
                    className="stroke-amber-500 transition-all duration-1000 ease-out"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                </div>
              </div>
            ) : card.trend !== null && card.trend !== undefined ? (
              <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${card.trend > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                {card.trend > 0 && <ArrowUpRight className="h-3 w-3" />}
                {card.trend} {(card as any).trendLabel ?? ""}
              </div>
            ) : null}
          </div>
          
          {/* Subtle background decoration */}
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-slate-50 opacity-50 dark:bg-slate-800" />
        </motion.article>
      ))}
    </motion.div>
  );
};
