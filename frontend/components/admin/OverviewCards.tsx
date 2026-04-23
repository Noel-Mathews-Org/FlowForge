"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import type { AnalyticsOverview } from "@/types";

export const OverviewCards = ({ overview }: { overview: AnalyticsOverview }) => {
  const cards = [
    { label: "Total Tasks", value: overview.total_tasks, color: "border-indigo-500", trend: overview.trend_total_tasks },
    { label: "Active Projects", value: overview.active_projects, color: "border-emerald-500", trend: 8 },
    { label: "Team Members", value: overview.team_members, color: "border-violet-500", trend: 5 },
    { label: "Completion Rate", value: `${overview.completion_rate}%`, color: "border-amber-500", trend: 3, circle: true }
  ];
  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <motion.article
          key={card.label}
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 28 } } }}
          className={`rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 ${card.color} border-l-4`}
        >
          <p className="text-xs text-slate-500">{card.label}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-4xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</p>
            {card.circle ? (
              <svg className="h-12 w-12 -rotate-90">
                <circle cx="24" cy="24" r="18" strokeWidth="6" className="stroke-slate-200 dark:stroke-slate-700" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  strokeWidth="6"
                  strokeDasharray={113}
                  strokeDashoffset={113 - (113 * overview.completion_rate) / 100}
                  className="stroke-amber-500"
                  fill="none"
                />
              </svg>
            ) : (
              <div className={`flex items-center text-xs ${card.trend > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {card.trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(card.trend)}%
              </div>
            )}
          </div>
        </motion.article>
      ))}
    </motion.div>
  );
};
