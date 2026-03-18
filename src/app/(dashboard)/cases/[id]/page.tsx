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

const statusColors: Record<string, string> = {
  PRE_INPUT_PENDING: "bg-yellow-100 text-yellow-700",
  PRE_INPUT_SUBMITTED: "bg-blue-100 text-blue-700",
  IN_MEETING: "bg-green-100 text-green-700",
  MEETING_ENDED: "bg-gray-100 text-gray-600",
  CLOSED: "bg-gray-200 text-gray-500",
};

const categoryLabels: Record<string, string> = {
  HARASSMENT: "ハラスメント",
  FRAUD: "不正",
  SAFETY: "安全衛生",
  OTHER: "その他",
};

const riskColors: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const riskLabels: Record<string, string> = {
  URGENT: "緊急",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

type Tab = "overview" | "meeting" | "review" | "script";

export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
  const closeCase = trpc.case.close.useMutation({
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
    return <p className="text-muted-foreground p-8">読み込み中...</p>;
  }

  if (!caseData.data) {
    return <p className="text-destructive p-8">案件が見つかりません</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = caseData.data as any;

  const tabs: { key: Tab; label: string; href?: string }[] = [
    { key: "overview", label: "概要" },
    { key: "meeting", label: "面談支援", href: `/cases/${id}/meeting` },
    { key: "review", label: "レビュー", href: `/cases/${id}/review` },
    { key: "script", label: "台本生成", href: `/cases/${id}/script` },
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/cases" className="text-muted-foreground hover:text-foreground text-base">
            &larr; 一覧
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">
                {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
              </h1>
              <span className={`px-2 py-0.5 text-sm rounded-full font-medium ${statusColors[c.status] ?? "bg-secondary"}`}>
                {statusLabels[c.status] ?? c.status}
              </span>
              {c.riskLevel && (
                <span className={`px-2 py-0.5 text-sm rounded-full font-medium ${riskColors[c.riskLevel]}`}>
                  リスク: {riskLabels[c.riskLevel]}
                </span>
              )}
              {c.caseCategory && (
                <span className="px-2 py-0.5 text-sm rounded-full bg-secondary font-medium">
                  {categoryLabels[c.caseCategory] ?? c.caseCategory}
                </span>
              )}
            </div>
            <p className="text-base text-muted-foreground mt-1">
              作成: {new Date(c.createdAt).toLocaleDateString("ja-JP")} /
              担当: {c.primaryAssignee?.name ?? "未割当"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {c.status !== "CLOSED" && (
            <button
              onClick={() => {
                if (confirm("この案件をクローズしますか？")) {
                  closeCase.mutate({ id });
                }
              }}
              className="px-3 py-1.5 text-base border border-destructive text-destructive rounded-lg hover:bg-destructive/10"
            >
              案件クローズ
            </button>
          )}
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            tab.href && tab.key !== "overview" ? (
              <Link
                key={tab.key}
                href={tab.href}
                className="px-4 py-2.5 text-base font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-border transition-colors"
              >
                {tab.label}
              </Link>
            ) : (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-base font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "text-primary border-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            )
          ))}
        </div>
      </div>

      {/* 概要タブ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 進捗ステップ */}
          <section className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-semibold mb-4">進捗ステータス</h2>
            <div className="flex items-center gap-1">
              {progressOptions.map(([key, label], i) => {
                const currentIdx = progressOptions.findIndex(([k]) => k === c.progress);
                const isCompleted = i < currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={key}
                    onClick={() => updateProgress.mutate({ id, progress: key as any })}
                    className={`flex-1 py-2 text-sm rounded-md border transition-all ${
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary font-bold"
                        : isCompleted
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 基本情報 */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-semibold">基本情報</h2>
              <dl className="space-y-2 text-base">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">案件ID</dt>
                  <dd className="font-mono text-sm">{c.id.slice(0, 12)}...</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">ユースケース</dt>
                  <dd>{c.useCase === "VOLUNTARY_RETIREMENT" ? "希望退職" : "監査室"}</dd>
                </div>
                {c.intakeChannel && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">受付チャネル</dt>
                    <dd>{c.intakeChannel}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">会議URL</dt>
                  <dd className="truncate max-w-32">{c.meetingUrl ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">面談数</dt>
                  <dd>{c.meetings?.length ?? 0}件</dd>
                </div>
              </dl>

              {/* 事前チャットURL */}
              {c.preChat && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">事前チャットURL</p>
                  <code className="text-sm break-all text-muted-foreground">
                    {typeof window !== "undefined" ? window.location.origin : ""}/pre-chat/{c.preChat.token}
                  </code>
                  <p className="text-sm mt-1">
                    <span className={`px-1.5 py-0.5 rounded ${c.preChat.isSubmitted ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {c.preChat.isSubmitted ? "提出済" : "未提出"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* 次の作業・期限 */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-semibold">次の作業・期限</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">作業内容</label>
                  <input
                    type="text"
                    placeholder="次の作業を入力..."
                    defaultValue={c.nextTask ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (c.nextTask ?? "")) {
                        updateNextTask.mutate({ id, nextTask: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">期限</label>
                  <input
                    type="date"
                    defaultValue={c.deadline ? new Date(c.deadline).toISOString().split("T")[0] : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        updateNextTask.mutate({ id, deadline: new Date(e.target.value).toISOString() });
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base mt-1"
                  />
                </div>
                {c.deadline && (
                  <p className={`text-sm ${new Date(c.deadline) < new Date() ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {new Date(c.deadline) < new Date() ? "期限超過" : `残り ${Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}日`}
                  </p>
                )}
              </div>

              {/* 進捗履歴 */}
              {c.progressHistory.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">進捗履歴</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {c.progressHistory.map((h: any) => (
                      <div key={h.id} className="text-sm text-muted-foreground flex gap-2">
                        <span className="whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                        <span>
                          {progressLabels[h.previousValue]} → {progressLabels[h.currentValue]}
                        </span>
                        <span className="text-primary">{h.updatedBy.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 担当者・参考案件 */}
            <div className="space-y-6">
              <AssigneePanel caseId={id} assignments={c.assignments} primaryAssigneeId={c.primaryAssigneeId} />

              <div className="bg-card border border-border rounded-lg p-5 space-y-3">
                <h2 className="font-semibold">参考案件</h2>
                {c.referencesFrom.length > 0 ? (
                  <div className="space-y-2">
                    {c.referencesFrom.map((ref: any) => (
                      <Link
                        key={ref.id}
                        href={`/cases/${ref.toCaseId}`}
                        className="block p-2 border border-border rounded-lg hover:bg-accent text-base"
                      >
                        <span className="font-medium">{ref.toCase.category ?? ref.toCaseId.slice(0, 8)}</span>
                        <p className="text-sm text-muted-foreground mt-1">{ref.reason}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-base text-muted-foreground">参考案件はありません</p>
                )}
              </div>
            </div>
          </div>

          {/* 案件サマリー */}
          <section className="bg-card border border-border rounded-lg p-5 space-y-4">
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
                className="px-3 py-1.5 text-base border border-border rounded-lg hover:bg-accent"
              >
                {editingSummary ? "保存" : "編集"}
              </button>
            </div>

            {editingSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "category", label: "事象カテゴリ", type: "input" },
                  { key: "referencePoint", label: "参考になるポイント", type: "input" },
                  { key: "issue", label: "争点（論点）", type: "textarea" },
                  { key: "conclusion", label: "結論", type: "textarea" },
                  { key: "action", label: "対応（実施したこと）", type: "textarea" },
                ].map(({ key, label, type }) => (
                  <div key={key} className={type === "textarea" ? "" : ""}>
                    <label className="text-sm text-muted-foreground font-medium">{label}</label>
                    {type === "textarea" ? (
                      <textarea
                        value={(summaryForm as any)[key]}
                        onChange={(e) => setSummaryForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base mt-1"
                        rows={3}
                      />
                    ) : (
                      <input
                        value={(summaryForm as any)[key]}
                        onChange={(e) => setSummaryForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
                {[
                  { label: "事象カテゴリ", value: c.category },
                  { label: "参考ポイント", value: c.referencePoint },
                  { label: "争点", value: c.issue },
                  { label: "結論", value: c.conclusion },
                  { label: "対応", value: c.action },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="mt-1">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 通報内容（ある場合） */}
          {c.reportContent && (
            <section className="bg-card border border-border rounded-lg p-5">
              <h2 className="font-semibold mb-3">通報内容</h2>
              <p className="text-base whitespace-pre-wrap text-muted-foreground">{c.reportContent}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function AssigneePanel({
  caseId,
  assignments,
  primaryAssigneeId,
}: {
  caseId: string;
  assignments: any[];
  primaryAssigneeId: string | null;
}) {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const users = trpc.user.list.useQuery(undefined, { enabled: showAdd });
  const updateAssignees = trpc.case.updateAssignees.useMutation({
    onSuccess: () => utils.case.getById.invalidate({ id: caseId }),
  });

  const currentAssigneeIds = assignments.map((a: any) => a.userId);

  const handleAdd = () => {
    if (!selectedUserId) return;
    const newAssigneeIds = [...currentAssigneeIds, selectedUserId];
    updateAssignees.mutate({
      id: caseId,
      assigneeIds: newAssigneeIds,
      primaryAssigneeId: primaryAssigneeId ?? undefined,
    });
    setSelectedUserId("");
    setShowAdd(false);
  };

  const handleRemove = (userId: string) => {
    if (!confirm("この担当者を外しますか？")) return;
    const newAssigneeIds = currentAssigneeIds.filter((id: string) => id !== userId);
    const newPrimary = primaryAssigneeId === userId ? (newAssigneeIds[0] ?? undefined) : (primaryAssigneeId ?? undefined);
    updateAssignees.mutate({
      id: caseId,
      assigneeIds: newAssigneeIds,
      primaryAssigneeId: newPrimary,
    });
  };

  const handleSetPrimary = (userId: string) => {
    updateAssignees.mutate({
      id: caseId,
      assigneeIds: currentAssigneeIds,
      primaryAssigneeId: userId,
    });
  };

  const availableUsers = (users.data as any[])?.filter(
    (u: any) => !currentAssigneeIds.includes(u.id)
  ) ?? [];

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">担当者</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-sm text-primary hover:underline"
        >
          {showAdd ? "閉じる" : "+ 追加"}
        </button>
      </div>

      <div className="space-y-2">
        {assignments.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-base group">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {a.user.name?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium truncate">{a.user.name}</p>
              <p className="text-sm text-muted-foreground truncate">{a.user.email}</p>
            </div>
            {primaryAssigneeId === a.userId ? (
              <span className="text-sm px-1.5 py-0.5 bg-primary text-primary-foreground rounded shrink-0">主担当</span>
            ) : (
              <div className="hidden group-hover:flex gap-1 shrink-0">
                <button
                  onClick={() => handleSetPrimary(a.userId)}
                  className="text-sm text-primary hover:underline"
                >
                  主担当に
                </button>
                <button
                  onClick={() => handleRemove(a.userId)}
                  className="text-sm text-destructive hover:underline"
                >
                  外す
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 px-2 py-1.5 text-base border border-border rounded-lg bg-background"
          >
            <option value="">ユーザーを選択</option>
            {availableUsers.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedUserId || updateAssignees.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      )}
    </div>
  );
}
