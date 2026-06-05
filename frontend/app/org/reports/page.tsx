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
  const [viewLoading, setViewLoading] = useState(false);

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
      const res = await analyticsApi.post("/reports/generate", {
        project_name: "FlowForge Organization",
        executive_summary: "This is an AI-generated executive summary based on the latest metrics. The organization has shown significant progress in the last reporting period with a strong completion rate across all active projects.\n\nTeam utilization remains high and project delivery timelines are being met consistently. Manager workload distribution appears balanced with adequate team allocation.",
        chart_labels: ["TODO", "IN_PROGRESS", "DONE"],
        chart_values: [12, 5, 20]
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

  const fetchPdfBlob = async (report: Report): Promise<string | null> => {
    try {
      if (report.storage === "azure") {
        return report.url;
      }
      const reportId = report.id;
      const res = await analyticsApi.get(`/reports/download/${reportId}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      return URL.createObjectURL(blob);
    } catch {
      toast.error("Failed to fetch report. Please try again.");
      return null;
    }
  };

  const handleView = async (report: Report) => {
    setViewLoading(true);
    const blobUrl = await fetchPdfBlob(report);
    setViewLoading(false);
    if (blobUrl) {
      setViewerUrl(blobUrl);
    }
  };

  const handleDownload = async (report: Report) => {
    const blobUrl = await fetchPdfBlob(report);
    if (blobUrl) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = report.name || report.id;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (report.storage !== "azure") {
        URL.revokeObjectURL(blobUrl);
      }
    }
  };

  const closeViewer = () => {
    if (viewerUrl && viewerUrl.startsWith("blob:")) {
      URL.revokeObjectURL(viewerUrl);
    }
    setViewerUrl(null);
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

      {/* Loading overlay */}
      <AnimatePresence>
        {viewLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900"
            >
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Loading report…</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Report</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Generated</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Storage</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {reports.map(report => (
                <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white truncate max-w-[300px]">{report.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <div className="flex items-center text-xs text-slate-500">
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                      {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                      {report.storage}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8 px-3"
                        onClick={() => handleView(report)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8 px-3"
                        onClick={() => handleDownload(report)}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF Viewer Modal */}
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
                <Button variant="ghost" size="icon" onClick={closeViewer} className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
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
