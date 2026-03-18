"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import Link from "next/link";

const meetingStatusLabels: Record<string, string> = {
  scheduled: "予定",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "中止",
};

const meetingStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

function getMeetingStatus(m: any): string {
  if (!m.startedAt && !m.endedAt) return "scheduled";
  if (m.startedAt && !m.endedAt) return "in_progress";
  if (m.endedAt) return "completed";
  return "scheduled";
}

export default function MeetingManagementPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();

  const meetings = trpc.meeting.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    page,
  });

  // 全件でカウント取得
  const allMeetings = trpc.meeting.list.useQuery({ limit: 1000 });
  const statusCounts = {
    all: allMeetings.data?.total ?? 0,
    scheduled: allMeetings.data?.meetings.filter((m: any) => getMeetingStatus(m) === "scheduled").length ?? 0,
    in_progress: allMeetings.data?.meetings.filter((m: any) => getMeetingStatus(m) === "in_progress").length ?? 0,
    completed: allMeetings.data?.meetings.filter((m: any) => getMeetingStatus(m) === "completed").length ?? 0,
    cancelled: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">面談管理</h1>
          <p className="text-base text-muted-foreground mt-1">面談セッションの一覧・管理</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90"
        >
          + 新規面談
        </button>
      </div>

      {/* ステータスタブ */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "すべて", count: statusCounts.all },
          { key: "scheduled", label: "予定", count: statusCounts.scheduled },
          { key: "in_progress", label: "進行中", count: statusCounts.in_progress },
          { key: "completed", label: "完了", count: statusCounts.completed },
          { key: "cancelled", label: "中止", count: statusCounts.cancelled },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-base font-medium transition-colors ${
              statusFilter === tab.key
                ? "btn-glass-primary"
                : "bg-secondary text-muted-foreground hover:bg-white/40"
            }`}
          >
            {tab.label} {tab.count}
          </button>
        ))}
      </div>

      {/* 面談テーブル */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border glass-thead">
              <th className="text-left p-3 font-medium text-muted-foreground">案件名</th>
              <th className="text-left p-3 font-medium text-muted-foreground">面談担当者</th>
              <th className="text-left p-3 font-medium text-muted-foreground">予定日時</th>
              <th className="text-left p-3 font-medium text-muted-foreground">実施日</th>
              <th className="text-left p-3 font-medium text-muted-foreground">ステータス</th>
              <th className="text-right p-3 font-medium text-muted-foreground">発言数</th>
            </tr>
          </thead>
          <tbody>
            {meetings.data?.meetings.map((m: any) => {
              const status = getMeetingStatus(m);
              return (
                <tr key={m.id} className="border-b border-border hover:bg-white/30">
                  <td className="p-3">
                    <Link
                      href={`/cases/${m.case?.id}/meeting`}
                      className="font-medium text-primary hover:underline"
                    >
                      {m.case?.caseName ?? m.case?.category ?? `案件 ${m.case?.id?.slice(0, 8)}`}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <Link href={`/cases/${m.case?.id}/meeting`} className="hover:underline">
                        面談詳細を開く
                      </Link>
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {m.case?.primaryAssignee?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleString("ja-JP", {
                          year: "numeric", month: "numeric", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {m.startedAt
                      ? new Date(m.startedAt).toLocaleDateString("ja-JP")
                      : "—"}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${meetingStatusColors[status]}`}>
                      {meetingStatusLabels[status]}
                    </span>
                  </td>
                  <td className="p-3 text-right text-muted-foreground">
                    {m.transcriptCount}
                  </td>
                </tr>
              );
            })}
            {meetings.data?.meetings.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  面談がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {meetings.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </div>

      <p className="text-sm text-muted-foreground text-right">
        {meetings.data?.total ?? 0}件表示
      </p>

      {/* 新規面談モーダル */}
      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            utils.meeting.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

function CreateMeetingModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [caseId, setCaseId] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const cases = trpc.case.list.useQuery({ limit: 100 });
  const users = trpc.user.list.useQuery();

  const createMeeting = trpc.meeting.create.useMutation({
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMeeting.mutate({
      caseId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      interviewerId: interviewerId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50">
      <div className="glass-modal rounded-2xl w-full max-w-md mx-4">
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold">新規面談登録</h2>
            <p className="text-base text-muted-foreground">面談セッションを新しく登録します</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-base font-medium mb-1">
              対象案件 <span className="text-destructive">*</span>
            </label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base"
            >
              <option value="">案件を選択してください</option>
              {cases.data?.cases.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.caseName ?? c.category ?? `案件 ${c.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-base font-medium mb-1">
              面談担当者 <span className="text-destructive">*</span>
            </label>
            <select
              value={interviewerId}
              onChange={(e) => setInterviewerId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base"
            >
              <option value="">担当者を選択してください</option>
              {(users.data as any)?.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-base font-medium mb-1">
              予定日時 <span className="text-destructive">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-base"
            />
          </div>

          {createMeeting.error && (
            <p className="text-base text-destructive">{createMeeting.error.message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white/50 rounded-xl bg-white/30 text-base hover:bg-white/40 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={createMeeting.isPending || !caseId || !scheduledAt}
              className="flex-1 px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 disabled:opacity-50"
            >
              {createMeeting.isPending ? "登録中..." : "面談を登録する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
