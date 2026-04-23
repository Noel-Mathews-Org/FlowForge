"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          className: "border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        }}
      />
    </QueryClientProvider>
  </ThemeProvider>
);
