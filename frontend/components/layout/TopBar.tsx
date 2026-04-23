"use client";

import { Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const TopBar = ({ title }: { title: string }) => {
  const { theme, setTheme } = useTheme();
  const user = getUser();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-8 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/85">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-10 w-10 p-0">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" className="h-10 w-10 p-0">
          <Bell className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{user?.email}</span>
      </div>
    </header>
  );
};
