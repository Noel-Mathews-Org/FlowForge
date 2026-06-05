"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Download, Plus, X, Loader2, BarChart3, Clock, Eye } from "lucide-react";
import { analyticsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type Report = {
  id: string;
  name: string;
  created_at: string;
  url: string;
  storage: "azure" | "local";
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const res = await analyticsApi.get("/reports");
      setReports(res.data.reports || []);
    } catch {
      toast.error("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // In a real app we might select a project or specific parameters.
      // Here we just ask the backend to generate an org-level executive report.
      const res = await analyticsApi.post("/reports/generate", {
        project_name: "FlowForge Organization",
        executive_summary: "This is an AI-generated executive summary based on the latest metrics. The organization has shown significant progress in the last week with a high completion rate.",
        chart_labels: ["TODO", "IN_PROGRESS", "DONE"],
        chart_values: [12, 5, 20] // Mock data for generation
      });
      if (res.data.success) {
        toast.success("Report generated successfully!");
        fetchReports();
      }
    } catch {
      toast.error("Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Executive Reports</h2>
          <p className="text-sm font-medium text-slate-500">
            Generate and view professional AI-summarized PDF reports.
          </p>
        </div>
        <Button 
          onClick={handleGenerate} 
          disabled={generating}
          className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Generate New Report
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700 bg-white dark:bg-slate-900/50">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-800">
            <BarChart3 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No reports generated yet</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Click the button above to generate your first executive summary report.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map(report => (
            <div key={report.id} className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{report.name}</h3>
                <div className="mt-2 flex items-center text-xs text-slate-500">
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
                <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  {report.storage} storage
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl"
                  onClick={() => setViewerUrl(report.url)}
                >
                  <Eye className="mr-2 h-4 w-4" /> View
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl"
                  onClick={() => window.open(report.url, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Document Viewer Modal */}
      <AnimatePresence>
        {viewerUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-rose-500" />
                  Document Viewer
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setViewerUrl(null)} className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 bg-slate-100 p-4 dark:bg-slate-950">
                <iframe src={viewerUrl} className="h-full w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800" title="PDF Viewer" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
