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
  IN_MEETING: "面談中",
  MEETING_ENDED: "調査中",
  CLOSED: "完了",
};

const statusColors: Record<string, string> = {
  PRE_INPUT_PENDING: "bg-blue-100 text-blue-700",
  PRE_INPUT_SUBMITTED: "bg-blue-100 text-blue-700",
  IN_MEETING: "bg-green-100 text-green-700",
  MEETING_ENDED: "bg-purple-100 text-purple-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const stats = trpc.dashboard.getStats.useQuery();
  const riskMatrix = trpc.dashboard.getRiskMatrix.useQuery();
  const recentCases = trpc.dashboard.getRecentCases.useQuery();
  const urgentCases = trpc.dashboard.getUrgentCases.useQuery();
  const staleCases = trpc.dashboard.getStaleCases.useQuery();

  const userName = session?.user?.name ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {userName} さん、おかえりなさい
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/cases" className="p-5 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
          <p className="text-sm text-muted-foreground">総案件数</p>
          <p className="text-3xl font-bold mt-2">{stats.data?.totalCases ?? "—"}</p>
        </Link>
        <Link href="/cases?status=active" className="p-5 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
          <p className="text-sm text-muted-foreground">対応中案件</p>
          <p className="text-3xl font-bold mt-2 text-blue-600">{stats.data?.activeCases ?? "—"}</p>
        </Link>
        <div className="p-5 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">期限超過/間近</p>
          <p className={`text-3xl font-bold mt-2 ${(urgentCases.data?.length ?? 0) > 0 ? "text-destructive" : ""}`}>
            {urgentCases.data?.length ?? "—"}
          </p>
        </div>
        <Link href="/users" className="p-5 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
          <p className="text-sm text-muted-foreground">ユーザー数</p>
          <p className="text-3xl font-bold mt-2">{stats.data?.userCount ?? "—"}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 通知パネル */}
        <div className="lg:col-span-1 space-y-4">
          {/* 要対応案件 */}
          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">要対応</h2>
            <div className="space-y-2">
              {urgentCases.data?.slice(0, 5).map((c: any) => {
                const daysLeft = c.deadline
                  ? Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="block p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium truncate pr-2">
                        {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                      </p>
                      {daysLeft !== null && (
                        <span className={`text-xs font-bold whitespace-nowrap ${daysLeft < 0 ? "text-destructive" : "text-orange-600"}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}日超過` : `${daysLeft}日`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.primaryAssignee?.name ?? "未割当"}
                    </p>
                  </Link>
                );
              })}
              {(urgentCases.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">期限超過の案件なし</p>
              )}
            </div>
          </section>

          {/* 長期未更新 */}
          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">長期未更新</h2>
            <div className="space-y-2">
              {staleCases.data?.slice(0, 5).map((c: any) => {
                const daysSince = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="block p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium truncate pr-2">
                        {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                      </p>
                      <span className="text-xs font-bold text-orange-600 whitespace-nowrap">{daysSince}日</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.primaryAssignee?.name ?? "未割当"}
                    </p>
                  </Link>
                );
              })}
              {(staleCases.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">未更新の案件なし</p>
              )}
            </div>
          </section>

          {/* クイックアクション */}
          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">クイックアクション</h2>
            <div className="space-y-2">
              <Link
                href="/cases"
                className="block w-full text-left px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >
                + 新規案件を登録
              </Link>
              <Link
                href="/interviews"
                className="block w-full text-left px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >
                面談を管理
              </Link>
            </div>
          </section>
        </div>

        {/* メインエリア */}
        <div className="lg:col-span-2 space-y-6">
          {/* リスク評価マトリクス */}
          <section className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">リスク評価マトリクス</h2>
              {riskMatrix.data && (
                <span className="text-xs text-muted-foreground">
                  対応中
                  {Object.values(riskMatrix.data).reduce(
                    (sum, row) => sum + Object.values(row as Record<string, number>).reduce((s, v) => s + v, 0),
                    0
                  )}件
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left p-2 font-medium">重大度</th>
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
                            <Link
                              href={`/cases?category=${cat}&risk=${level}`}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${riskLevelColors[level]} hover:opacity-80`}
                            >
                              {row[cat]}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center p-2 font-medium">{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {riskMatrix.isLoading && <p className="text-muted-foreground mt-2 text-sm">読み込み中...</p>}
          </section>

          {/* 最近の案件 */}
          <section className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">最近の案件</h2>
              <Link href="/cases" className="text-sm text-primary hover:underline">
                すべて見る
              </Link>
            </div>
            <div className="space-y-2">
              {recentCases.data?.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                        {c.caseCategory && ` / ${categoryLabels[c.caseCategory] ?? c.caseCategory}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.riskLevel && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskLevelColors[c.riskLevel]}`}>
                        {riskLevelLabels[c.riskLevel]}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] ?? "bg-gray-100"}`}>
                      {statusLabels[c.status] ?? c.status}
                    </span>
                  </div>
                </Link>
              ))}
              {recentCases.data?.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">案件がありません</p>
              )}
            </div>
            {recentCases.isLoading && <p className="text-muted-foreground text-sm">読み込み中...</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
