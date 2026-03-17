"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { useSession } from "next-auth/react";

const categoryLabels: Record<string, string> = {
  HARASSMENT: "ハラスメント",
  FRAUD: "不正・不祥事",
  SAFETY: "安全衛生",
  OTHER: "その他",
};

const riskLevelLabels: Record<string, string> = {
  URGENT: "緊急",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

const riskLevelColors: Record<string, string> = {
  URGENT: "bg-red-500 text-white",
  HIGH: "bg-orange-400 text-white",
  MEDIUM: "bg-yellow-400 text-black",
  LOW: "bg-gray-200 text-gray-600",
};

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "対応中",
  PRE_INPUT_SUBMITTED: "対応中",
  IN_MEETING: "対応中",
  MEETING_ENDED: "対応中",
  CLOSED: "完了",
};

const statusColors: Record<string, string> = {
  PRE_INPUT_PENDING: "bg-blue-100 text-blue-700",
  PRE_INPUT_SUBMITTED: "bg-blue-100 text-blue-700",
  IN_MEETING: "bg-blue-100 text-blue-700",
  MEETING_ENDED: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const stats = trpc.dashboard.getStats.useQuery();
  const riskMatrix = trpc.dashboard.getRiskMatrix.useQuery();
  const recentCases = trpc.dashboard.getRecentCases.useQuery();

  const userName = session?.user?.name ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {userName} さん、おはようございます
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-card border border-border rounded-lg flex justify-between items-start">
          <div>
            <p className="text-sm text-muted-foreground">総案件数</p>
            <p className="text-3xl font-bold mt-2">{stats.data?.totalCases ?? "—"}</p>
          </div>
          <span className="text-2xl text-muted-foreground">&#128203;</span>
        </div>
        <div className="p-5 bg-card border border-border rounded-lg flex justify-between items-start">
          <div>
            <p className="text-sm text-muted-foreground">対応中案件</p>
            <p className="text-3xl font-bold mt-2">{stats.data?.activeCases ?? "—"}</p>
          </div>
          <span className="text-2xl text-muted-foreground">&#9200;</span>
        </div>
        <div className="p-5 bg-card border border-border rounded-lg flex justify-between items-start">
          <div>
            <p className="text-sm text-muted-foreground">ユーザー数</p>
            <p className="text-3xl font-bold mt-2">{stats.data?.userCount ?? "—"}</p>
          </div>
          <span className="text-2xl text-muted-foreground">&#128100;</span>
        </div>
      </div>

      {/* リスク評価マトリクス */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">リスク評価マトリクス</h2>
          {riskMatrix.data && (
            <span className="text-sm text-muted-foreground">
              全{Object.values(riskMatrix.data).reduce(
                (sum, row) => sum + Object.values(row as Record<string, number>).reduce((s, v) => s + v, 0),
                0
              )}件
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left p-2 font-medium">重大度 ＼ カテゴリ</th>
              {Object.values(categoryLabels).map((label) => (
                <th key={label} className="text-center p-2 font-medium">{label}</th>
              ))}
              <th className="text-center p-2 font-medium">計</th>
            </tr>
          </thead>
          <tbody>
            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((level) => {
              const row = (riskMatrix.data?.[level] ?? {}) as Record<string, number>;
              const rowTotal = Object.values(row).reduce((s, v) => s + v, 0);
              return (
                <tr key={level} className="border-t border-border">
                  <td className="p-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${riskLevelColors[level]}`}>
                      {riskLevelLabels[level]}
                    </span>
                  </td>
                  {(["HARASSMENT", "FRAUD", "SAFETY", "OTHER"] as const).map((cat) => (
                    <td key={cat} className="text-center p-2">
                      {row[cat] ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${riskLevelColors[level]}`}>
                          {row[cat]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                  <td className="text-center p-2 font-medium">{rowTotal}</td>
                </tr>
              );
            })}
            <tr className="border-t border-border font-medium">
              <td className="p-2">計</td>
              {(["HARASSMENT", "FRAUD", "SAFETY", "OTHER"] as const).map((cat) => {
                const colTotal = (["URGENT", "HIGH", "MEDIUM", "LOW"] as const).reduce(
                  (sum, level) => sum + ((riskMatrix.data?.[level] as Record<string, number>)?.[cat] ?? 0),
                  0
                );
                return <td key={cat} className="text-center p-2">{colTotal}</td>;
              })}
              <td className="text-center p-2">
                {riskMatrix.data
                  ? Object.values(riskMatrix.data).reduce(
                      (sum, row) => sum + Object.values(row as Record<string, number>).reduce((s, v) => s + v, 0),
                      0
                    )
                  : 0}
              </td>
            </tr>
          </tbody>
        </table>
        {riskMatrix.isLoading && <p className="text-muted-foreground mt-2">読み込み中...</p>}
      </section>

      {/* 最近の案件 */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">最近の案件</h2>
          <Link href="/cases" className="text-sm text-primary hover:underline">
            すべて見る →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left p-2 font-medium">案件名</th>
              <th className="text-left p-2 font-medium">ステータス</th>
              <th className="text-left p-2 font-medium">作成日</th>
            </tr>
          </thead>
          <tbody>
            {recentCases.data?.map((c: any) => (
              <tr key={c.id} className="border-t border-border hover:bg-accent/50">
                <td className="p-2">
                  <Link href={`/cases/${c.id}`} className="font-medium text-foreground hover:text-primary">
                    {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                  </Link>
                </td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] ?? "bg-gray-100"}`}>
                    {statusLabels[c.status] ?? c.status}
                  </span>
                </td>
                <td className="p-2 text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            ))}
            {recentCases.data?.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">案件がありません</td></tr>
            )}
          </tbody>
        </table>
        {recentCases.isLoading && <p className="text-muted-foreground mt-2">読み込み中...</p>}
      </section>
    </div>
  );
}
