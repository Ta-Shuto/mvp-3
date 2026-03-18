"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import Link from "next/link";

const eventTypeLabels: Record<string, string> = {
  pre_chat_viewed: "事前チャット閲覧",
  summary_viewed: "要約閲覧",
  script_viewed: "台本閲覧",
  script_generated: "台本生成",
  case_created: "案件作成",
  case_updated: "案件更新",
  case_closed: "案件クローズ",
  progress_updated: "進捗更新",
  template_updated: "テンプレ更新",
  template_restored: "テンプレ復元",
  assignment_changed: "担当変更",
  pre_chat_submitted: "事前チャット提出",
  pre_chat_url_reissued: "事前チャットURL再発行",
  meeting_started: "面談開始",
  meeting_ended: "面談終了",
  export_downloaded: "エクスポート",
  login: "ログイン",
  logout: "ログアウト",
  user_invited: "ユーザー招待",
  settings_updated: "設定更新",
};

const eventTypeColors: Record<string, string> = {
  case_created: "bg-green-100 text-green-700",
  case_closed: "bg-gray-100 text-gray-600",
  meeting_started: "bg-blue-100 text-blue-700",
  meeting_ended: "bg-blue-100 text-blue-700",
  progress_updated: "bg-purple-100 text-purple-700",
  login: "bg-yellow-100 text-yellow-700",
  logout: "bg-yellow-100 text-yellow-700",
  settings_updated: "bg-orange-100 text-orange-700",
  user_invited: "bg-green-100 text-green-700",
  assignment_changed: "bg-purple-100 text-purple-700",
  export_downloaded: "bg-blue-100 text-blue-700",
};

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    eventType: undefined as string | undefined,
    dateFrom: "",
    dateTo: "",
    page: 1,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logs = trpc.auditLog.list.useQuery({
    eventType: filters.eventType,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    page: filters.page,
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">監査ログ</h1>
        <p className="text-base text-muted-foreground mt-1">
          システム操作の追跡記録（改竄不可）
        </p>
      </div>

      {/* フィルタ */}
      <div className="flex gap-4 flex-wrap items-center">
        <select
          value={filters.eventType ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value || undefined, page: 1 }))}
          className="px-3 py-2 border border-white/50 rounded-xl bg-white/30 text-base"
        >
          <option value="">イベント種別: 全て</option>
          {Object.entries(eventTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-base text-muted-foreground">期間:</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-white/50 rounded-xl bg-white/30 text-base"
          />
          <span className="text-muted-foreground">〜</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-white/50 rounded-xl bg-white/30 text-base"
          />
        </div>

        {(filters.eventType || filters.dateFrom || filters.dateTo) && (
          <button
            onClick={() => setFilters({ eventType: undefined, dateFrom: "", dateTo: "", page: 1 })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            フィルタをクリア
          </button>
        )}
      </div>

      {/* ログ一覧 */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border glass-thead">
              <th className="text-left p-3 font-medium text-muted-foreground w-8"></th>
              <th className="text-left p-3 font-medium text-muted-foreground">日時</th>
              <th className="text-left p-3 font-medium text-muted-foreground">イベント</th>
              <th className="text-left p-3 font-medium text-muted-foreground">ユーザー</th>
              <th className="text-left p-3 font-medium text-muted-foreground">案件</th>
              <th className="text-left p-3 font-medium text-muted-foreground">概要</th>
            </tr>
          </thead>
          <tbody>
            {(logs.data as any)?.logs?.map((log: any) => (
              <>
                <tr
                  key={log.id}
                  className="border-b border-white/20 hover:bg-white/30 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="p-3 text-muted-foreground text-sm">
                    {log.details ? (expandedId === log.id ? "▼" : "▶") : ""}
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-sm rounded-full font-medium ${eventTypeColors[log.eventType] ?? "bg-secondary"}`}>
                      {eventTypeLabels[log.eventType] ?? log.eventType}
                    </span>
                  </td>
                  <td className="p-3">{log.user?.name ?? "system"}</td>
                  <td className="p-3">
                    {log.caseId ? (
                      <Link
                        href={`/cases/${log.caseId}`}
                        className="text-sm font-mono text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {log.caseId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                    {formatDetails(log.eventType, log.details)}
                  </td>
                </tr>
                {expandedId === log.id && log.details && (
                  <tr key={`${log.id}-detail`} className="border-b border-white/20">
                    <td colSpan={6} className="p-4 bg-white/20">
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {(logs.data as any)?.logs?.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">ログがありません</td></tr>
            )}
          </tbody>
        </table>
        {logs.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </div>

      {/* ページネーション */}
      {(logs.data as any)?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
            disabled={filters.page <= 1}
            className="px-3 py-1 rounded-xl text-base border border-white/50 bg-white/30 hover:bg-white/50 disabled:opacity-30"
          >
            前へ
          </button>
          <span className="px-3 py-1 text-base text-muted-foreground">
            {filters.page} / {(logs.data as any)?.totalPages}
          </span>
          <button
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            disabled={filters.page >= (logs.data as any)?.totalPages}
            className="px-3 py-1 rounded-xl text-base border border-white/50 bg-white/30 hover:bg-white/50 disabled:opacity-30"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

function formatDetails(eventType: string, details: any): string {
  if (!details) return "—";

  switch (eventType) {
    case "progress_updated":
      return `${details.from ?? "?"} → ${details.to ?? "?"}`;
    case "assignment_changed":
      return `${details.assigneeIds?.length ?? 0}名に変更`;
    case "settings_updated":
      return Object.keys(details).join(", ");
    case "meeting_ended":
      return details.reason ? `理由: ${details.reason}` : "—";
    default:
      return JSON.stringify(details).slice(0, 80);
  }
}
