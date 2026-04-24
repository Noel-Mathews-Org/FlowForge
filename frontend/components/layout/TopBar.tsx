"use client";

import { Bell, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const TopBar = ({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) => {
  const { theme, setTheme } = useTheme();
  const user = getUser();
  
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 md:h-16 md:px-8">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button 
            onClick={onMenuClick} 
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-xl">{title}</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
          className="h-10 w-10 rounded-xl p-0"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        
        <div className="relative">
          <Button variant="ghost" className="h-10 w-10 rounded-xl p-0">
            <Bell className="h-5 w-5" />
          </Button>
          <span className="absolute right-2.5 top-2.5 flex h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-950" />
        </div>
        
        <div className="ml-2 hidden flex-col items-end sm:flex">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{user?.full_name}</span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{user?.email}</span>
        </div>
      </div>
    </header>
  );
};
