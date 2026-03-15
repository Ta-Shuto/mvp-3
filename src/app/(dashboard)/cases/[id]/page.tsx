"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { useState } from "react";
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

const progressOptions = Object.entries(progressLabels);

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "事前入力未提出",
  PRE_INPUT_SUBMITTED: "事前入力提出済",
  IN_MEETING: "面談中",
  MEETING_ENDED: "面談終了",
  CLOSED: "クローズ",
};

export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const utils = trpc.useUtils();

  const caseData = trpc.case.getById.useQuery({ id });
  const updateProgress = trpc.case.updateProgress.useMutation({
    onSuccess: () => utils.case.getById.invalidate({ id }),
  });
  const updateNextTask = trpc.case.updateNextTask.useMutation({
    onSuccess: () => utils.case.getById.invalidate({ id }),
  });
  const updateSummary = trpc.case.updateSummary.useMutation({
    onSuccess: () => utils.case.getById.invalidate({ id }),
  });

  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState({
    category: "",
    issue: "",
    conclusion: "",
    action: "",
    referencePoint: "",
  });

  if (caseData.isLoading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  if (!caseData.data) {
    return <p className="text-destructive">案件が見つかりません</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = caseData.data as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cases" className="text-muted-foreground hover:text-foreground text-sm">
          &larr; 案件一覧
        </Link>
        <h1 className="text-2xl font-bold">{c.category ?? `案件 ${c.id.slice(0, 8)}`}</h1>
        <span className="px-2 py-0.5 text-xs rounded bg-secondary">
          {statusLabels[c.status] ?? c.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 基本情報 */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">基本情報</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">案件ID:</span>
            <span>{c.id}</span>
            <span className="text-muted-foreground">ユースケース:</span>
            <span>{c.useCase === "VOLUNTARY_RETIREMENT" ? "希望退職" : "監査室"}</span>
            <span className="text-muted-foreground">会議URL:</span>
            <span className="truncate">{c.meetingUrl ?? "—"}</span>
            <span className="text-muted-foreground">開始予定:</span>
            <span>{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("ja-JP") : "—"}</span>
            <span className="text-muted-foreground">作成日:</span>
            <span>{new Date(c.createdAt).toLocaleString("ja-JP")}</span>
          </div>

          {/* 事前チャットURL */}
          {c.preChat && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">事前チャットURL</p>
              <code className="text-xs break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}/pre-chat/{c.preChat.token}
              </code>
              <p className="text-xs text-muted-foreground mt-1">
                提出状態: {c.preChat.isSubmitted ? "提出済" : "未提出"}
              </p>
            </div>
          )}
        </div>

        {/* FR-104: 進捗ステータス */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">進捗ステータス</h2>
          <div className="flex flex-wrap gap-2">
            {progressOptions.map(([key, label]) => (
              <button
                key={key}
                onClick={() => updateProgress.mutate({ id, progress: key as Parameters<typeof updateProgress.mutate>[0]["progress"] })}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  c.progress === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* FR-105: 次の作業・期限 */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium">次の作業・期限</h3>
            <input
              type="text"
              placeholder="次の作業..."
              defaultValue={c.nextTask ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (c.nextTask ?? "")) {
                  updateNextTask.mutate({ id, nextTask: e.target.value });
                }
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            />
            <input
              type="date"
              defaultValue={c.deadline ? new Date(c.deadline).toISOString().split("T")[0] : ""}
              onChange={(e) => {
                if (e.target.value) {
                  updateNextTask.mutate({ id, deadline: new Date(e.target.value).toISOString() });
                }
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            />
          </div>

          {/* 進捗履歴 */}
          {c.progressHistory.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">進捗履歴</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {c.progressHistory.map((h: any) => (
                  <div key={h.id} className="text-xs text-muted-foreground">
                    {progressLabels[h.previousValue]} → {progressLabels[h.currentValue]}
                    <span className="ml-2">{h.updatedBy.name}</span>
                    <span className="ml-2">{new Date(h.createdAt).toLocaleString("ja-JP")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FR-106: 案件サマリー */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3 lg:col-span-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">案件サマリー</h2>
            <button
              onClick={() => {
                if (editingSummary) {
                  updateSummary.mutate({ id, ...summaryForm });
                } else {
                  setSummaryForm({
                    category: c.category ?? "",
                    issue: c.issue ?? "",
                    conclusion: c.conclusion ?? "",
                    action: c.action ?? "",
                    referencePoint: c.referencePoint ?? "",
                  });
                }
                setEditingSummary(!editingSummary);
              }}
              className="text-sm text-primary hover:underline"
            >
              {editingSummary ? "保存" : "編集"}
            </button>
          </div>

          {editingSummary ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">事象カテゴリ</label>
                <input
                  value={summaryForm.category}
                  onChange={(e) => setSummaryForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">争点（論点）</label>
                <textarea
                  value={summaryForm.issue}
                  onChange={(e) => setSummaryForm((f) => ({ ...f, issue: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm mt-1"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">結論</label>
                <textarea
                  value={summaryForm.conclusion}
                  onChange={(e) => setSummaryForm((f) => ({ ...f, conclusion: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm mt-1"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">対応（実施したこと）</label>
                <textarea
                  value={summaryForm.action}
                  onChange={(e) => setSummaryForm((f) => ({ ...f, action: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm mt-1"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">参考になるポイント</label>
                <input
                  value={summaryForm.referencePoint}
                  onChange={(e) => setSummaryForm((f) => ({ ...f, referencePoint: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm mt-1"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">事象カテゴリ:</span>
              <span>{c.category ?? "—"}</span>
              <span className="text-muted-foreground">争点:</span>
              <span>{c.issue ?? "—"}</span>
              <span className="text-muted-foreground">結論:</span>
              <span>{c.conclusion ?? "—"}</span>
              <span className="text-muted-foreground">対応:</span>
              <span>{c.action ?? "—"}</span>
              <span className="text-muted-foreground">参考ポイント:</span>
              <span>{c.referencePoint ?? "—"}</span>
            </div>
          )}
        </div>

        {/* 担当者 */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">担当者</h2>
          <div className="space-y-1">
            {c.assignments.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span>{a.user.name}</span>
                <span className="text-xs text-muted-foreground">{a.user.email}</span>
                {c.primaryAssigneeId === a.userId && (
                  <span className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground rounded">主担当</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 参考案件 */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">参考案件</h2>
          {c.referencesFrom.length > 0 ? (
            <div className="space-y-2">
              {c.referencesFrom.map((ref: any) => (
                <Link
                  key={ref.id}
                  href={`/cases/${ref.toCaseId}`}
                  className="block p-2 border border-border rounded hover:bg-accent text-sm"
                >
                  <span className="font-medium">{ref.toCase.category ?? ref.toCaseId.slice(0, 8)}</span>
                  <p className="text-xs text-muted-foreground mt-1">{ref.reason}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">参考案件はありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
