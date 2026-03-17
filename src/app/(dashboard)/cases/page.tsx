"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const categoryLabels: Record<string, string> = {
  HARASSMENT: "ハラスメント",
  FRAUD: "不正・不祥事",
  SAFETY: "安全衛生",
  OTHER: "その他",
};

const categoryColors: Record<string, string> = {
  HARASSMENT: "text-purple-700",
  FRAUD: "text-red-700",
  SAFETY: "text-green-700",
  OTHER: "text-gray-600",
};

const riskLevelLabels: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  URGENT: "緊急",
};

const riskLevelColors: Record<string, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-yellow-600",
  HIGH: "text-orange-600 font-medium",
  URGENT: "text-red-600 font-bold",
};

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "対応中",
  PRE_INPUT_SUBMITTED: "対応中",
  IN_MEETING: "対応中",
  MEETING_ENDED: "調査中",
  CLOSED: "完了",
};

const statusColors: Record<string, string> = {
  PRE_INPUT_PENDING: "bg-green-100 text-green-700",
  PRE_INPUT_SUBMITTED: "bg-green-100 text-green-700",
  IN_MEETING: "bg-green-100 text-green-700",
  MEETING_ENDED: "bg-purple-100 text-purple-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const intakeChannelLabels: Record<string, string> = {
  EMAIL: "メール",
  PHONE: "電話",
  WEB_FORM: "Webフォーム",
  IN_PERSON: "対面",
};

export default function CasesPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">読み込み中...</p>}>
      <CasesPageContent />
    </Suspense>
  );
}

function CasesPageContent() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [showCreatePage, setShowCreatePage] = useState(false);

  const cases = trpc.case.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    caseCategory: categoryFilter !== "all" ? categoryFilter as any : undefined,
    riskLevel: riskFilter !== "all" ? riskFilter as any : undefined,
    keyword: keyword || undefined,
    progress: searchParams.get("progress") as any ?? undefined,
    page,
  });

  // ステータスごとの件数
  const allCases = trpc.case.list.useQuery({ limit: 1000 });
  const statusCounts = {
    all: allCases.data?.total ?? 0,
    active: allCases.data?.cases.filter((c: any) => !["CLOSED"].includes(c.status) && c.status !== "MEETING_ENDED").length ?? 0,
    investigating: allCases.data?.cases.filter((c: any) => c.status === "MEETING_ENDED").length ?? 0,
    resolved: 0,
    closed: allCases.data?.cases.filter((c: any) => c.status === "CLOSED").length ?? 0,
  };

  if (showCreatePage) {
    return <CreateCasePage onBack={() => setShowCreatePage(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">案件管理</h1>
          <p className="text-sm text-muted-foreground mt-1">内部通報案件の一覧・管理</p>
        </div>
        <button
          onClick={() => setShowCreatePage(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          + 新規案件
        </button>
      </div>

      {/* ステータスタブ */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "すべて", count: statusCounts.all },
          { key: "active", label: "対応中", count: statusCounts.active },
          { key: "investigating", label: "調査中", count: statusCounts.investigating },
          { key: "resolved", label: "解決済", count: statusCounts.resolved },
          { key: "closed", label: "完了", count: statusCounts.closed },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key === "active" ? "PRE_INPUT_PENDING" : tab.key === "investigating" ? "MEETING_ENDED" : tab.key === "closed" ? "CLOSED" : "all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              (statusFilter === "all" && tab.key === "all") ||
              (statusFilter === "PRE_INPUT_PENDING" && tab.key === "active") ||
              (statusFilter === "MEETING_ENDED" && tab.key === "investigating") ||
              (statusFilter === "CLOSED" && tab.key === "closed")
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label} {tab.count}
          </button>
        ))}
      </div>

      {/* 検索・フィルタ */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            placeholder="案件名で検索..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
          />
        </div>

        {/* カテゴリフィルタ */}
        <div className="flex gap-1">
          {[
            { key: "all", label: "全カテゴリ" },
            { key: "HARASSMENT", label: "ハラスメント" },
            { key: "FRAUD", label: "不正" },
            { key: "SAFETY", label: "安全衛生" },
            { key: "OTHER", label: "その他" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setCategoryFilter(opt.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                categoryFilter === opt.key
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* リスクフィルタ */}
        <div className="flex gap-1">
          {[
            { key: "all", label: "全リスク" },
            { key: "LOW", label: "低" },
            { key: "MEDIUM", label: "中" },
            { key: "HIGH", label: "高" },
            { key: "URGENT", label: "緊急" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setRiskFilter(opt.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                riskFilter === opt.key
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 案件テーブル */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">案件名</th>
              <th className="text-left p-3 font-medium text-muted-foreground">カテゴリ</th>
              <th className="text-left p-3 font-medium text-muted-foreground">ステータス</th>
              <th className="text-left p-3 font-medium text-muted-foreground">リスク</th>
              <th className="text-left p-3 font-medium text-muted-foreground">担当者</th>
              <th className="text-left p-3 font-medium text-muted-foreground">受付日</th>
              <th className="text-center p-3 font-medium text-muted-foreground">通報/面談</th>
              <th className="text-left p-3 font-medium text-muted-foreground">更新日</th>
            </tr>
          </thead>
          <tbody>
            {cases.data?.cases.map((c: any) => (
              <tr key={c.id} className="border-b border-border hover:bg-accent/50">
                <td className="p-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                  </Link>
                </td>
                <td className="p-3">
                  <span className={categoryColors[c.caseCategory] ?? "text-gray-600"}>
                    {categoryLabels[c.caseCategory] ?? "—"}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] ?? "bg-gray-100"}`}>
                    {statusLabels[c.status] ?? c.status}
                  </span>
                </td>
                <td className="p-3">
                  <span className={riskLevelColors[c.riskLevel] ?? "text-gray-500"}>
                    {riskLevelLabels[c.riskLevel] ?? "—"}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {c.primaryAssignee?.name ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="p-3 text-center text-muted-foreground">
                  1 / {c.meetingCount}
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            ))}
            {cases.data?.cases.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">案件がありません</td></tr>
            )}
          </tbody>
        </table>
        {cases.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {cases.data?.total ?? 0}件表示
      </p>

      {/* ページネーション */}
      {cases.data && cases.data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: cases.data.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCasePage({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [intakeChannel, setIntakeChannel] = useState<"EMAIL" | "PHONE" | "WEB_FORM" | "IN_PERSON">("EMAIL");
  const [reportContent, setReportContent] = useState("");
  const [caseName, setCaseName] = useState("");
  const [caseCategory, setCaseCategory] = useState<"HARASSMENT" | "FRAUD" | "SAFETY" | "OTHER">("HARASSMENT");
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("LOW");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);

  const analyzeMutation = trpc.case.analyzeReport.useMutation({
    onSuccess: (result) => {
      if (result.caseName) setCaseName(result.caseName);
      if (result.caseCategory) setCaseCategory(result.caseCategory);
      if (result.riskLevel) setRiskLevel(result.riskLevel);
    },
  });

  const createMutation = trpc.case.create.useMutation({
    onSuccess: (result) => {
      if (result.created) {
        utils.case.list.invalidate();
        router.push(`/cases/${(result as any).caseId}`);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      caseName,
      caseCategory,
      riskLevel,
      intakeChannel,
      reportContent: reportContent || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-lg">
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold">新規案件登録</h1>
          <p className="text-sm text-muted-foreground mt-1">
            通報内容を貼り付けてAIが自動分類します
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ステップ1: 通報内容入力 */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <h2 className="font-semibold">通報内容を入力</h2>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">受付チャネル</label>
            <div className="flex gap-2">
              {[
                { value: "EMAIL" as const, label: "メール" },
                { value: "PHONE" as const, label: "電話" },
                { value: "WEB_FORM" as const, label: "Webフォーム" },
                { value: "IN_PERSON" as const, label: "対面" },
              ].map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => setIntakeChannel(ch.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    intakeChannel === ch.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              通報内容（メール本文・電話メモ等をそのまま貼り付け）
            </label>
            <textarea
              value={reportContent}
              onChange={(e) => setReportContent(e.target.value)}
              rows={6}
              placeholder={"通報メールの本文をここに貼り付けてください...\n\n例：\n○○部の△△課長から日常的に大声で叱責を受けています。先月は会議中に「お前は無能だ」と言われ..."}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-y"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => reportContent && analyzeMutation.mutate({ reportContent })}
              disabled={!reportContent || analyzeMutation.isPending}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {analyzeMutation.isPending ? "分析中..." : "AIで分析"}
            </button>
          </div>
        </div>

        {/* ステップ2: 案件情報 */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <h2 className="font-semibold">案件情報を確認・修正</h2>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              案件名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
              required
              placeholder="例：営業部パワハラ申告"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              カテゴリ <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["HARASSMENT", "FRAUD", "SAFETY", "OTHER"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCaseCategory(cat)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    caseCategory === cat
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">リスクレベル</label>
            <div className="flex gap-2">
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRiskLevel(level)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    riskLevel === level
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {riskLevelLabels[level]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              受付日 <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending || !caseName}
          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {createMutation.isPending ? "登録中..." : "案件を登録する"}
        </button>
      </form>
    </div>
  );
}
