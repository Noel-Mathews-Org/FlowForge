"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Activity, Database, Server } from "lucide-react";

export const PlatformHealthChart = ({ healthData }: { healthData: any }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Connection Latency</h3>
          <p className="text-xs text-slate-500">Live ping latency across infrastructure layers (ms)</p>
        </div>
        
        <div className="flex gap-4">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${healthData?.database_connected ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10"}`}>
            <Database className="h-3 w-3" />
            Database: {healthData?.database_connected ? "Connected" : "Disconnected"}
          </div>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${healthData?.redis_connected ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10"}`}>
            <Server className="h-3 w-3" />
            Redis: {healthData?.redis_connected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full">
        {healthData?.latency_history?.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={healthData.latency_history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip 
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                labelStyle={{ fontWeight: "bold", color: "#0f172a", marginBottom: 4 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Line 
                type="monotone" 
                dataKey="db_latency_ms" 
                name="Database (ms)" 
                stroke="#6366f1" 
                strokeWidth={2} 
                dot={{ r: 3 }} 
                activeDot={{ r: 5 }} 
              />
              <Line 
                type="monotone" 
                dataKey="redis_latency_ms" 
                name="Redis (ms)" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={{ r: 3 }} 
                activeDot={{ r: 5 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            <Activity className="mr-2 h-4 w-4" /> No telemetry data available
          </div>
        )}
      </div>
    </div>
  );
};
