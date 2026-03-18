"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";

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

function DonutChart({ data, labels, colors }: { data: number[]; labels: string[]; colors: string[] }) {
  const total = data.reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-muted-foreground text-center py-4">データなし</p>;

  let cumulative = 0;
  const segments = data.map((value, i) => {
    const pct = (value / total) * 100;
    const offset = cumulative;
    cumulative += pct;
    return { value, pct, offset, label: labels[i], color: colors[i] };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {segments.map((seg, i) => (
            <circle
              key={i}
              r="16"
              cx="18"
              cy="18"
              fill="none"
              stroke={seg.color}
              strokeWidth="3"
              strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
              strokeDashoffset={`${-seg.offset}`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">{total}</div>
      </div>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium">{seg.value} ({Math.round(seg.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "export">("overview");

  const categories = trpc.analysis.getCategoryBreakdown.useQuery();
  const statuses = trpc.analysis.getStatusBreakdown.useQuery();
  const risks = trpc.analysis.getRiskBreakdown.useQuery();
  const trend = trpc.analysis.getMonthlyTrend.useQuery();
  const avgDays = trpc.analysis.getAverageResolutionDays.useQuery();
  const assignees = trpc.analysis.getAssigneeBreakdown.useQuery();
  const riskItems = trpc.analysis.getRiskItemStats.useQuery();

  const handleExportCSV = () => {
    if (!categories.data || !statuses.data || !risks.data || !riskItems.data) return;

    let csv = "\uFEFF"; // BOM for Excel
    csv += "分析レポート\n\n";

    csv += "カテゴリ別案件数\nカテゴリ,合計,対応中,完了\n";
    categories.data.forEach((c) => {
      csv += `${categoryLabels[c.category] ?? c.category},${c.total},${c.active},${c.closed}\n`;
    });

    csv += "\nステータス別案件数\nステータス,件数\n";
    statuses.data.forEach((s) => {
      csv += `${statusLabels[s.status] ?? s.status},${s.count}\n`;
    });

    csv += "\nリスクレベル別（対応中）\nレベル,件数\n";
    risks.data.forEach((r) => {
      csv += `${riskLevelLabels[r.level] ?? r.level},${r.count}\n`;
    });

    csv += `\n平均解決日数,${avgDays.data?.average ?? "N/A"}日\n`;
    csv += `完了案件数,${avgDays.data?.count ?? 0}\n`;

    csv += `\nリスクアイテム\n総数,${riskItems.data.total}\n`;
    csv += `未対応,${riskItems.data.pending}\n`;
    csv += `対応済,${riskItems.data.accepted}\n`;
    csv += `却下,${riskItems.data.rejected}\n`;

    if (trend.data) {
      csv += "\n月別推移\n月,新規,完了\n";
      trend.data.forEach((m) => {
        csv += `${m.month},${m.created},${m.closed}\n`;
      });
    }

    if (assignees.data) {
      csv += "\n担当者別案件数\n担当者,件数\n";
      assignees.data.forEach((a) => {
        csv += `${a.name},${a.count}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: "overview" as const, label: "概要" },
    { key: "details" as const, label: "詳細分析" },
    { key: "export" as const, label: "レポート出力" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">分析・レポート</h1>
          <p className="text-base text-muted-foreground mt-1">
            案件データの統計分析とレポート
          </p>
        </div>
      </div>

      {/* タブ */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-base font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "text-primary border-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">総案件数</p>
              <p className="text-3xl font-bold mt-1">
                {categories.data?.reduce((s, c) => s + c.total, 0) ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                対応中: {categories.data?.reduce((s, c) => s + c.active, 0) ?? "—"} / 完了: {categories.data?.reduce((s, c) => s + c.closed, 0) ?? "—"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">平均解決日数</p>
              <p className="text-3xl font-bold mt-1">
                {avgDays.data?.average != null ? `${avgDays.data.average}日` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">完了案件: {avgDays.data?.count ?? 0}件</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">リスクアイテム</p>
              <p className="text-3xl font-bold mt-1">{riskItems.data?.total ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                未対応: {riskItems.data?.pending ?? 0} / 対応済: {riskItems.data?.accepted ?? 0}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">担当者数</p>
              <p className="text-3xl font-bold mt-1">
                {assignees.data?.filter((a) => a.id !== "unassigned").length ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">対応中案件の担当者</p>
            </div>
          </div>

          {/* ドーナツチャート */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold mb-4">カテゴリ別構成比</h2>
              {categories.data ? (
                <DonutChart
                  data={categories.data.map((c) => c.total)}
                  labels={categories.data.map((c) => categoryLabels[c.category] ?? c.category)}
                  colors={["#ef4444", "#f97316", "#eab308", "#9ca3af"]}
                />
              ) : (
                <p className="text-muted-foreground">読み込み中...</p>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold mb-4">リスクレベル構成比</h2>
              {risks.data ? (
                <DonutChart
                  data={risks.data.map((r) => r.count)}
                  labels={risks.data.map((r) => riskLevelLabels[r.level] ?? r.level)}
                  colors={["#ef4444", "#f97316", "#eab308", "#d1d5db"]}
                />
              ) : (
                <p className="text-muted-foreground">読み込み中...</p>
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
                    const maxVal = Math.max(...trend.data!.map((t) => Math.max(t.created, t.closed)), 1);
                    const createdPct = (m.created / maxVal) * 100;
                    const closedPct = (m.closed / maxVal) * 100;
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="flex gap-0.5 items-end flex-1 w-full justify-center">
                          <div className="w-5 bg-indigo-400 rounded-t transition-all duration-500" style={{ height: `${createdPct}%` }} title={`新規: ${m.created}`} />
                          <div className="w-5 bg-green-400 rounded-t transition-all duration-500" style={{ height: `${closedPct}%` }} title={`完了: ${m.closed}`} />
                        </div>
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground">{m.month.split("-")[1]}月</span>
                          <div className="text-xs font-medium">{m.created}/{m.closed}</div>
                        </div>
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
        </>
      )}

      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* カテゴリ別 */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">カテゴリ別案件数</h2>
            {categories.data ? (
              <>
                <BarChart
                  data={categories.data.map((c) => ({ label: c.category, count: c.total }))}
                  labelMap={categoryLabels}
                  colorMap={categoryColors}
                />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2">カテゴリ</th>
                        <th className="text-right py-2">合計</th>
                        <th className="text-right py-2">対応中</th>
                        <th className="text-right py-2">完了</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.data.map((c) => (
                        <tr key={c.category} className="border-b border-border/50">
                          <td className="py-2">{categoryLabels[c.category] ?? c.category}</td>
                          <td className="text-right py-2 font-medium">{c.total}</td>
                          <td className="text-right py-2">{c.active}</td>
                          <td className="text-right py-2">{c.closed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">読み込み中...</p>
            )}
          </section>

          {/* ステータス別 */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">ステータス別案件数</h2>
            {statuses.data ? (
              <BarChart
                data={statuses.data.map((s) => ({ label: s.status, count: s.count }))}
                labelMap={statusLabels}
                colorMap={statusColors}
              />
            ) : (
              <p className="text-muted-foreground">読み込み中...</p>
            )}
          </section>

          {/* 担当者別 */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">担当者別案件数（対応中）</h2>
            {assignees.data && assignees.data.length > 0 ? (
              <BarChart
                data={assignees.data.map((a) => ({ label: a.name, count: a.count }))}
                labelMap={Object.fromEntries(assignees.data.map((a) => [a.name, a.name]))}
                colorMap={Object.fromEntries(assignees.data.map((a) => [a.name, "bg-indigo-400"]))}
                labelKey="label"
              />
            ) : (
              <p className="text-muted-foreground text-center py-4">データがありません</p>
            )}
          </section>

          {/* リスクアイテム詳細 */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">リスクアイテム統計</h2>
            {riskItems.data ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/30 text-center">
                  <p className="text-2xl font-bold">{riskItems.data.total}</p>
                  <p className="text-sm text-muted-foreground">総数</p>
                </div>
                <div className="p-4 rounded-xl bg-yellow-50 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{riskItems.data.pending}</p>
                  <p className="text-sm text-muted-foreground">未対応</p>
                </div>
                <div className="p-4 rounded-xl bg-green-50 text-center">
                  <p className="text-2xl font-bold text-green-700">{riskItems.data.accepted}</p>
                  <p className="text-sm text-muted-foreground">対応済み</p>
                </div>
                <div className="p-4 rounded-xl bg-red-50 text-center">
                  <p className="text-2xl font-bold text-red-700">{riskItems.data.rejected}</p>
                  <p className="text-sm text-muted-foreground">却下</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">読み込み中...</p>
            )}
          </section>
        </div>
      )}

      {activeTab === "export" && (
        <div className="space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">レポート出力</h2>
            <p className="text-muted-foreground mb-6">
              現在の分析データをCSV形式でエクスポートできます。カテゴリ別・ステータス別・リスクレベル別の分析データ、月別推移、担当者別の案件数が含まれます。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/30 border border-border">
                <h3 className="font-semibold mb-2">含まれるデータ</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>・カテゴリ別案件数（合計/対応中/完了）</li>
                  <li>・ステータス別案件数</li>
                  <li>・リスクレベル別案件数</li>
                  <li>・平均解決日数</li>
                  <li>・リスクアイテム統計</li>
                  <li>・月別推移（過去6ヶ月）</li>
                  <li>・担当者別案件数</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-white/30 border border-border">
                <h3 className="font-semibold mb-2">サマリー</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">総案件数</span>
                    <span className="font-medium">{categories.data?.reduce((s, c) => s + c.total, 0) ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均解決日数</span>
                    <span className="font-medium">{avgDays.data?.average != null ? `${avgDays.data.average}日` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">リスクアイテム総数</span>
                    <span className="font-medium">{riskItems.data?.total ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">アクティブ担当者数</span>
                    <span className="font-medium">{assignees.data?.filter((a) => a.id !== "unassigned").length ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={!categories.data}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
            >
              CSVをダウンロード
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
