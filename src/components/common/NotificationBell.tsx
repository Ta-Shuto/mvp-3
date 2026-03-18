"use client";

import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const typeLabels: Record<string, string> = {
  case_created: "案件作成",
  case_assigned: "担当割当",
  case_status_changed: "ステータス変更",
  meeting_started: "面談開始",
  meeting_ended: "面談終了",
  risk_detected: "リスク検出",
  pre_chat_submitted: "事前回答提出",
  export_ready: "エクスポート完了",
};

const typeIcons: Record<string, string> = {
  case_created: "folder",
  case_assigned: "user",
  case_status_changed: "refresh",
  meeting_started: "play",
  meeting_ended: "stop",
  risk_detected: "alert",
  pre_chat_submitted: "check",
  export_ready: "download",
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const notifications = trpc.notification.list.useQuery(
    { limit: 20 },
    { enabled: isOpen }
  );
  const markAsRead = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      unreadCount.refetch();
      notifications.refetch();
    },
  });
  const markAllAsRead = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      unreadCount.refetch();
      notifications.refetch();
    },
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const count = unreadCount.data ?? 0;

  const handleNotificationClick = (notif: any) => {
    if (!notif.isRead) {
      markAsRead.mutate({ id: notif.id });
    }
    setIsOpen(false);
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return d.toLocaleDateString("ja-JP");
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-white/40 transition-colors"
        aria-label={`通知${count > 0 ? ` (${count}件の未読)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg className="w-5 h-5 text-foreground/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div role="menu" aria-label="通知一覧" className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold">通知</h3>
            {count > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="text-xs text-primary hover:underline"
              >
                すべて既読にする
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.isLoading && (
              <p className="text-muted-foreground text-sm p-4 text-center">読み込み中...</p>
            )}
            {notifications.data?.length === 0 && (
              <p className="text-muted-foreground text-sm p-8 text-center">通知はありません</p>
            )}
            {notifications.data?.map((notif: any) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`block p-3 border-b border-border/50 hover:bg-white/20 transition-colors cursor-pointer ${
                  !notif.isRead ? "bg-primary/5" : ""
                }`}
              >
                {notif.linkUrl ? (
                  <Link href={notif.linkUrl} className="block">
                    <NotificationContent notif={notif} formatTime={formatTime} />
                  </Link>
                ) : (
                  <NotificationContent notif={notif} formatTime={formatTime} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationContent({ notif, formatTime }: { notif: any; formatTime: (d: string) => string }) {
  return (
    <div className="flex gap-3">
      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${notif.isRead ? "bg-transparent" : "bg-primary"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/50 text-muted-foreground">
            {typeLabels[notif.type] ?? notif.type}
          </span>
          <span className="text-xs text-muted-foreground">{formatTime(notif.createdAt)}</span>
        </div>
        <p className="text-sm font-medium mt-0.5 truncate">{notif.title}</p>
        <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
      </div>
    </div>
  );
}
