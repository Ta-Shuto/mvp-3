"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const useCaseLabels: Record<string, string> = {
  VOLUNTARY_RETIREMENT: "希望退職",
  AUDIT: "監査室",
};

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "事前入力未提出",
  PRE_INPUT_SUBMITTED: "事前入力提出済",
  IN_MEETING: "面談中",
  MEETING_ENDED: "面談終了",
  CLOSED: "クローズ",
};

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

export default function CasesPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">読み込み中...</p>}>
      <CasesPageContent />
    </Suspense>
  );
}

function CasesPageContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    useCase: undefined as string | undefined,
    status: undefined as string | undefined,
    progress: searchParams.get("progress") ?? undefined,
    keyword: "",
    page: 1,
  });

  const cases = trpc.case.list.useQuery({
    useCase: filters.useCase as "VOLUNTARY_RETIREMENT" | "AUDIT" | undefined,
    status: filters.status as "PRE_INPUT_PENDING" | "PRE_INPUT_SUBMITTED" | "IN_MEETING" | "MEETING_ENDED" | "CLOSED" | undefined,
    progress: filters.progress as "RECEPTION" | "INITIAL_JUDGMENT" | "INVESTIGATION_PLAN" | "PREPARATION" | "EXECUTION" | "RECORDING" | "POLICY_DECISION" | "COMPLETED" | undefined,
    keyword: filters.keyword || undefined,
    page: filters.page,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">案件一覧</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
        >
          新規案件作成
        </button>
      </div>

      {/* FR-014, FR-108: 絞り込み */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filters.useCase ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, useCase: e.target.value || undefined, page: 1 }))}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm"
        >
          <option value="">ユースケース: 全て</option>
          <option value="VOLUNTARY_RETIREMENT">希望退職</option>
          <option value="AUDIT">監査室</option>
        </select>

        <select
          value={filters.status ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined, page: 1 }))}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm"
        >
          <option value="">状態: 全て</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.progress ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, progress: e.target.value || undefined, page: 1 }))}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm"
        >
          <option value="">進捗: 全て</option>
          {Object.entries(progressLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="キーワード検索..."
          value={filters.keyword}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm flex-1 min-w-48"
        />
      </div>

      {/* 案件一覧テーブル */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3">案件名</th>
              <th className="text-left p-3">カテゴリ</th>
              <th className="text-left p-3">進捗</th>
              <th className="text-left p-3">次の作業</th>
              <th className="text-left p-3">期限</th>
              <th className="text-left p-3">主担当</th>
              <th className="text-left p-3">面談回数</th>
              <th className="text-left p-3">最終更新</th>
            </tr>
          </thead>
          <tbody>
            {cases.data?.cases.map((c: any) => (
              <tr key={c.id} className="border-b border-border hover:bg-accent/50">
                <td className="p-3">
                  <Link href={`/cases/${c.id}`} className="text-primary hover:underline">
                    {c.category ?? `案件 ${c.id.slice(0, 8)}`}
                  </Link>
                  <span className="ml-2 text-xs px-2 py-0.5 bg-muted rounded">
                    {useCaseLabels[c.useCase] ?? c.useCase}
                  </span>
                </td>
                <td className="p-3">{c.category ?? "—"}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-secondary">
                    {progressLabels[c.progress] ?? c.progress}
                  </span>
                </td>
                <td className="p-3">{c.nextTask ?? "—"}</td>
                <td className="p-3">
                  {c.deadline ? new Date(c.deadline).toLocaleDateString("ja-JP") : "—"}
                </td>
                <td className="p-3">{c.primaryAssignee?.name ?? "—"}</td>
                <td className="p-3">{c.meetingCount}</td>
                <td className="p-3">{new Date(c.updatedAt).toLocaleDateString("ja-JP")}</td>
              </tr>
            ))}
            {cases.data?.cases.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">案件がありません</td></tr>
            )}
          </tbody>
        </table>
        {cases.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
      </div>

      {/* ページネーション */}
      {cases.data && cases.data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: cases.data.totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setFilters((f) => ({ ...f, page }))}
              className={`px-3 py-1 rounded text-sm ${
                page === filters.page
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* 新規案件作成モーダル */}
      {showCreateModal && (
        <CreateCaseModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateCaseModal({ onClose }: { onClose: () => void }) {
  const [useCase, setUseCase] = useState<"VOLUNTARY_RETIREMENT" | "AUDIT">("VOLUNTARY_RETIREMENT");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const utils = trpc.useUtils();

  const createCase = trpc.case.create.useMutation({
    onSuccess: (result) => {
      if (result.created) {
        utils.case.list.invalidate();
        onClose();
      } else {
        alert(`既存の案件が見つかりました。案件ID: ${(result as any).existingCaseId}`);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCase.mutate({
      useCase,
      meetingUrl,
      scheduledAt: new Date(scheduledAt).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg border border-border w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">新規案件作成</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">ユースケース</label>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value as "VOLUNTARY_RETIREMENT" | "AUDIT")}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="VOLUNTARY_RETIREMENT">希望退職</option>
              <option value="AUDIT">監査室</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">会議URL</label>
            <input
              type="url"
              required
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              placeholder="https://teams.microsoft.com/... or https://zoom.us/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">会議開始予定時刻</label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={createCase.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {createCase.isPending ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
