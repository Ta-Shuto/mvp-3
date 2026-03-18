"use client";

import { trpc } from "@/lib/trpc";

const categoryLabels: Record<string, string> = {
  HARASSMENT: "ハラスメント",
  FRAUD: "不正・不祥事",
  SAFETY: "安全衛生",
  OTHER: "その他",
};

const categoryColors: Record<string, string> = {
  HARASSMENT: "bg-red-500",
  FRAUD: "bg-orange-500",
  SAFETY: "bg-yellow-500",
  OTHER: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "入力待ち",
  PRE_INPUT_SUBMITTED: "提出済み",
  IN_MEETING: "面談中",
  MEETING_ENDED: "面談終了",
  CLOSED: "完了",
};

const statusColors: Record<string, string> = {
  PRE_INPUT_PENDING: "bg-yellow-400",
  PRE_INPUT_SUBMITTED: "bg-blue-400",
  IN_MEETING: "bg-green-400",
  MEETING_ENDED: "bg-purple-400",
  CLOSED: "bg-gray-400",
};

const riskLevelLabels: Record<string, string> = {
  URGENT: "緊急",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

const riskLevelColors: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-400",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-gray-300",
};

function BarChart({
  data,
  labelMap,
  colorMap,
  valueKey = "count",
  labelKey = "label",
}: {
  data: any[];
  labelMap: Record<string, string>;
  colorMap: Record<string, string>;
  valueKey?: string;
  labelKey?: string;
}) {
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);

  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const label = labelMap[d[labelKey]] ?? d[labelKey];
        const value = d[valueKey] ?? 0;
        const pct = (value / max) * 100;
        const color = colorMap[d[labelKey]] ?? "bg-indigo-400";

        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-24 text-right shrink-0">
              {label}
            </span>
            <div className="flex-1 h-7 bg-white/30 rounded-lg overflow-hidden relative">
              <div
                className={`h-full ${color} rounded-lg transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium">
                {value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalysisPage() {
  const categories = trpc.analysis.getCategoryBreakdown.useQuery();
  const statuses = trpc.analysis.getStatusBreakdown.useQuery();
  const risks = trpc.analysis.getRiskBreakdown.useQuery();
  const trend = trpc.analysis.getMonthlyTrend.useQuery();
  const avgDays = trpc.analysis.getAverageResolutionDays.useQuery();
  const assignees = trpc.analysis.getAssigneeBreakdown.useQuery();
  const riskItems = trpc.analysis.getRiskItemStats.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">分析・レポート</h1>
        <p className="text-base text-muted-foreground mt-1">
          案件データの統計分析とレポート
        </p>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">総案件数</p>
          <p className="text-3xl font-bold mt-1">
            {categories.data?.reduce((s, c) => s + c.total, 0) ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            対応中:{" "}
            {categories.data?.reduce((s, c) => s + c.active, 0) ?? "—"} / 完了:{" "}
            {categories.data?.reduce((s, c) => s + c.closed, 0) ?? "—"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">平均解決日数</p>
          <p className="text-3xl font-bold mt-1">
            {avgDays.data?.average != null ? `${avgDays.data.average}日` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            完了案件: {avgDays.data?.count ?? 0}件
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">リスクアイテム</p>
          <p className="text-3xl font-bold mt-1">
            {riskItems.data?.total ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            未対応: {riskItems.data?.pending ?? 0} / 対応済:{" "}
            {riskItems.data?.accepted ?? 0}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">担当者数</p>
          <p className="text-3xl font-bold mt-1">
            {assignees.data?.filter((a) => a.id !== "unassigned").length ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            対応中案件の担当者
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* カテゴリ別 */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4">カテゴリ別案件数</h2>
          {categories.isLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : categories.data ? (
            <BarChart
              data={categories.data.map((c) => ({
                label: c.category,
                count: c.total,
              }))}
              labelMap={categoryLabels}
              colorMap={categoryColors}
            />
          ) : null}
        </section>

        {/* ステータス別 */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4">ステータス別案件数</h2>
          {statuses.isLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : statuses.data ? (
            <BarChart
              data={statuses.data.map((s) => ({
                label: s.status,
                count: s.count,
              }))}
              labelMap={statusLabels}
              colorMap={statusColors}
            />
          ) : null}
        </section>

        {/* リスクレベル別 */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4">リスクレベル別（対応中）</h2>
          {risks.isLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : risks.data ? (
            <BarChart
              data={risks.data.map((r) => ({
                label: r.level,
                count: r.count,
              }))}
              labelMap={riskLevelLabels}
              colorMap={riskLevelColors}
            />
          ) : null}
        </section>

        {/* 担当者別 */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4">担当者別案件数（対応中）</h2>
          {assignees.isLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : assignees.data && assignees.data.length > 0 ? (
            <BarChart
              data={assignees.data.map((a) => ({
                label: a.name,
                count: a.count,
              }))}
              labelMap={Object.fromEntries(
                assignees.data.map((a) => [a.name, a.name])
              )}
              colorMap={Object.fromEntries(
                assignees.data.map((a) => [a.name, "bg-indigo-400"])
              )}
              labelKey="label"
            />
          ) : (
            <p className="text-muted-foreground text-center py-4">
              データがありません
            </p>
          )}
        </section>
      </div>

      {/* 月別推移 */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-4">月別案件推移（過去6ヶ月）</h2>
        {trend.isLoading ? (
          <p className="text-muted-foreground">読み込み中...</p>
        ) : trend.data ? (
          <div>
            <div className="flex items-end gap-1 h-48">
              {trend.data.map((m) => {
                const maxVal = Math.max(
                  ...trend.data!.map((t) => Math.max(t.created, t.closed)),
                  1
                );
                const createdPct = (m.created / maxVal) * 100;
                const closedPct = (m.closed / maxVal) * 100;
                return (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                  >
                    <div className="flex gap-0.5 items-end flex-1 w-full justify-center">
                      <div
                        className="w-5 bg-indigo-400 rounded-t transition-all duration-500"
                        style={{ height: `${createdPct}%` }}
                        title={`新規: ${m.created}`}
                      />
                      <div
                        className="w-5 bg-green-400 rounded-t transition-all duration-500"
                        style={{ height: `${closedPct}%` }}
                        title={`完了: ${m.closed}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {m.month.split("-")[1]}月
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-indigo-400" />
                <span className="text-xs text-muted-foreground">新規</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-400" />
                <span className="text-xs text-muted-foreground">完了</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* リスクアイテム詳細 */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-4">リスクアイテム統計</h2>
        {riskItems.data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white/30 text-center">
              <p className="text-2xl font-bold">{riskItems.data.total}</p>
              <p className="text-sm text-muted-foreground">総数</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-50 text-center">
              <p className="text-2xl font-bold text-yellow-700">
                {riskItems.data.pending}
              </p>
              <p className="text-sm text-muted-foreground">未対応</p>
            </div>
            <div className="p-4 rounded-xl bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-700">
                {riskItems.data.accepted}
              </p>
              <p className="text-sm text-muted-foreground">対応済み</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50 text-center">
              <p className="text-2xl font-bold text-red-700">
                {riskItems.data.rejected}
              </p>
              <p className="text-sm text-muted-foreground">却下</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">読み込み中...</p>
        )}
      </section>
    </div>
  );
}
