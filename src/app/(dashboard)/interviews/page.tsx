"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import Link from "next/link";

export default function InterviewsPage() {
  const [filters, setFilters] = useState({
    keyword: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
  });

  const history = trpc.meeting.listHistory.useQuery({
    keyword: filters.keyword || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    page: filters.page,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">面談履歴</h1>

      {/* FR-110: 検索・絞り込み */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="キーワード検索..."
          value={filters.keyword}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm flex-1 min-w-48"
        />
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

      {/* 面談履歴一覧 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3">実施日時</th>
              <th className="text-left p-3">案件名</th>
              <th className="text-left p-3">面談担当者</th>
              <th className="text-left p-3">要点</th>
            </tr>
          </thead>
          <tbody>
            {(history.data as any)?.meetings?.map((m: any) => (
              <tr key={m.id} className="border-b border-border hover:bg-accent/50">
                <td className="p-3 whitespace-nowrap">
                  {m.startedAt ? new Date(m.startedAt).toLocaleString("ja-JP") : "—"}
                </td>
                <td className="p-3">
                  <Link href={`/cases/${m.case?.id}`} className="text-primary hover:underline">
                    {m.case?.category ?? `案件 ${m.case?.id?.slice(0, 8)}`}
                  </Link>
                </td>
                <td className="p-3">{m.case?.primaryAssignee?.name ?? "—"}</td>
                <td className="p-3 text-muted-foreground max-w-xs truncate">
                  {m.meetingSummary?.slice(0, 100) ?? "—"}
                </td>
              </tr>
            ))}
            {(history.data as any)?.meetings?.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">面談履歴がありません</td></tr>
            )}
          </tbody>
        </table>
        {history.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </div>

      {/* ページネーション */}
      {(history.data as any)?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: (history.data as any).totalPages }, (_, i) => i + 1).map((page) => (
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
