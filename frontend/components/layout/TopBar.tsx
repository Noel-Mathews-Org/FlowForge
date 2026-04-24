"use client";

import { Bell, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const TopBar = ({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) => {
  const { theme, setTheme } = useTheme();
  const user = getUser();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/85 md:h-16 md:px-8">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button onClick={onMenuClick} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 md:text-xl">{title}</h1>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        <Button variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-9 w-9 p-0 md:h-10 md:w-10">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" className="h-9 w-9 p-0 md:h-10 md:w-10">
          <Bell className="h-4 w-4" />
        </Button>
        <span className="ml-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:inline md:ml-2">{user?.email}</span>
      </div>
    </header>
  );
};
