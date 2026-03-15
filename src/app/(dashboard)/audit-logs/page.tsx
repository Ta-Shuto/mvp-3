"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";

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
};

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    eventType: undefined as string | undefined,
    dateFrom: "",
    dateTo: "",
    page: 1,
  });

  const logs = trpc.auditLog.list.useQuery({
    eventType: filters.eventType,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    page: filters.page,
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">監査ログ</h1>

      {/* FR-073: フィルタ */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filters.eventType ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value || undefined, page: 1 }))}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm"
        >
          <option value="">イベント種別: 全て</option>
          {Object.entries(eventTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">期間:</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm"
          />
          <span className="text-muted-foreground">〜</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm"
          />
        </div>
      </div>

      {/* ログ一覧 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3">日時</th>
              <th className="text-left p-3">イベント</th>
              <th className="text-left p-3">ユーザー</th>
              <th className="text-left p-3">案件ID</th>
              <th className="text-left p-3">詳細</th>
            </tr>
          </thead>
          <tbody>
            {(logs.data as any)?.logs?.map((log: any) => (
              <tr key={log.id} className="border-b border-border">
                <td className="p-3 text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("ja-JP")}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-secondary">
                    {eventTypeLabels[log.eventType] ?? log.eventType}
                  </span>
                </td>
                <td className="p-3">{log.user?.name ?? "system"}</td>
                <td className="p-3 text-xs font-mono">{log.caseId?.slice(0, 8) ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {log.details ? JSON.stringify(log.details).slice(0, 80) : "—"}
                </td>
              </tr>
            ))}
            {(logs.data as any)?.logs?.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">ログがありません</td></tr>
            )}
          </tbody>
        </table>
        {logs.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </div>

      {/* ページネーション */}
      {(logs.data as any)?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: (logs.data as any).totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setFilters((f) => ({ ...f, page }))}
              className={`px-3 py-1 rounded text-sm ${
                page === filters.page ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
