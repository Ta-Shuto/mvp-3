"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";

const progressLabels: Record<string, string> = {
  RECEPTION: "受付",
  INITIAL_JUDGMENT: "初期判断",
  INVESTIGATION_PLAN: "調査計画",
  PREPARATION: "準備",
  EXECUTION: "実施",
  RECORDING: "記録",
  POLICY_DECISION: "方針決定",
  COMPLETED: "完了",
};

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "事前入力未提出",
  PRE_INPUT_SUBMITTED: "事前入力提出済",
  IN_MEETING: "面談中",
  MEETING_ENDED: "面談終了",
  CLOSED: "クローズ",
};

export default function OpsPage() {
  const stats = trpc.dashboard.getStats.useQuery();
  const urgentCases = trpc.dashboard.getUrgentCases.useQuery();
  const staleCases = trpc.dashboard.getStaleCases.useQuery();
  const summary = trpc.dashboard.getSummary.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">運営管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          システム全体のモニタリングと運営状況
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "総案件数", value: stats.data?.totalCases ?? 0 },
          { label: "対応中", value: stats.data?.activeCases ?? 0 },
          { label: "期限超過/間近", value: urgentCases.data?.length ?? 0, color: "text-destructive" },
          { label: "長期未更新", value: staleCases.data?.length ?? 0, color: "text-orange-600" },
        ].map((card) => (
          <div key={card.label} className="border border-white/40 rounded-2xl bg-white/30 p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color ?? ""}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 進捗別サマリー */}
      {summary.data && (
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4">進捗ステータス別 案件数</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(progressLabels).map(([key, label]) => {
              const data = (summary.data as any)?.[key];
              const active = data?.active ?? 0;
              const closed = data?.closed ?? 0;
              return (
                <div key={key} className="border border-white/40 rounded-2xl bg-white/30 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold mt-1">{active}</p>
                  <p className="text-xs text-muted-foreground">完了: {closed}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 期限超過・間近の案件 */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">要対応案件（期限7日以内・超過）</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border glass-thead">
              <th className="text-left p-3">案件名</th>
              <th className="text-left p-3">担当者</th>
              <th className="text-left p-3">ステータス</th>
              <th className="text-left p-3">期限</th>
              <th className="text-left p-3">残日数</th>
            </tr>
          </thead>
          <tbody>
            {urgentCases.data?.map((c: any) => {
              const daysLeft = c.deadline
                ? Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <tr key={c.id} className="border-b border-border hover:bg-white/30">
                  <td className="p-3">
                    <Link href={`/cases/${c.id}`} className="text-primary hover:underline font-medium">
                      {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.primaryAssignee?.name ?? "—"}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                      {statusLabels[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.deadline ? new Date(c.deadline).toLocaleDateString("ja-JP") : "—"}
                  </td>
                  <td className="p-3">
                    {daysLeft !== null && (
                      <span className={`text-xs font-bold ${daysLeft < 0 ? "text-destructive" : daysLeft <= 3 ? "text-orange-600" : "text-muted-foreground"}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}日超過` : `${daysLeft}日`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {urgentCases.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  期限超過・間近の案件はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {urgentCases.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </section>

      {/* 長期未更新案件 */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">長期未更新案件（7日以上）</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border glass-thead">
              <th className="text-left p-3">案件名</th>
              <th className="text-left p-3">担当者</th>
              <th className="text-left p-3">ステータス</th>
              <th className="text-left p-3">最終更新</th>
              <th className="text-left p-3">未更新日数</th>
            </tr>
          </thead>
          <tbody>
            {staleCases.data?.map((c: any) => {
              const daysSince = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <tr key={c.id} className="border-b border-border hover:bg-white/30">
                  <td className="p-3">
                    <Link href={`/cases/${c.id}`} className="text-primary hover:underline font-medium">
                      {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.primaryAssignee?.name ?? "—"}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                      {statusLabels[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs font-bold ${daysSince > 14 ? "text-destructive" : "text-orange-600"}`}>
                      {daysSince}日
                    </span>
                  </td>
                </tr>
              );
            })}
            {staleCases.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  長期未更新の案件はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {staleCases.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </section>
    </div>
  );
}
