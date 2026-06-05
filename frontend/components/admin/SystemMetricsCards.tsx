"use client";

import { Activity, Users, UserCheck, UserX } from "lucide-react";
import { motion } from "framer-motion";

export const SystemMetricsCards = ({ healthData }: { healthData: any }) => {
  const totalUsers = (healthData?.active_users || 0) + (healthData?.inactive_users || 0);
  const activeRatio = totalUsers > 0 ? Math.round((healthData?.active_users / totalUsers) * 100) : 0;

  const cards = [
    { label: "Total Platform Users", value: totalUsers, color: "indigo", icon: Users },
    { label: "Active Users (7d)", value: healthData?.active_users || 0, color: "emerald", icon: UserCheck },
    { label: "Inactive Users", value: healthData?.inactive_users || 0, color: "rose", icon: UserX },
    { label: "Active Ratio", value: `${activeRatio}%`, color: "amber", icon: Activity, circle: true }
  ];

  const colors: Record<string, string> = {
    indigo: "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/5",
    emerald: "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5",
    rose: "border-rose-500 bg-rose-50/50 dark:bg-rose-500/5",
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
          <div className="flex items-center gap-2">
            <card.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{card.label}</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{card.value}</p>
            {card.circle && (
              <div className="relative h-12 w-12">
                <svg className="h-12 w-12 -rotate-90">
                  <circle cx="24" cy="24" r="18" strokeWidth="4" className="stroke-slate-100 dark:stroke-slate-800" fill="none" />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    strokeWidth="4"
                    strokeDasharray={113}
                    strokeDashoffset={113 - (113 * activeRatio) / 100}
                    className="stroke-amber-500 transition-all duration-1000 ease-out"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-slate-50 opacity-50 dark:bg-slate-800" />
        </motion.article>
      ))}
    </motion.div>
  );
};
