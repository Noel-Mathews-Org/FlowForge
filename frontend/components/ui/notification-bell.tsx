"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { authApi } from "@/lib/api";

type Notification = {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState<Notification[]>([]);
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = async () => {
    try {
      const { data } = await authApi.get("/users/me/notifications/unread-count");
      setUnread(data.unread_count ?? 0);
    } catch { /* ignore */ }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await authApi.get("/users/me/notifications?page_size=15");
      setItems(data.notifications ?? data ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  const markRead = async (id: string) => {
    try {
      await authApi.patch(`/users/me/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  const markAll = async () => {
    try {
      await authApi.patch("/users/me/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) fetchAll();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-violet-600 hover:underline dark:text-violet-400">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No notifications yet</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${!n.is_read ? "bg-violet-50 dark:bg-violet-900/10" : ""}`}
                >
                  <p className={`text-sm font-medium ${!n.is_read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.content}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
