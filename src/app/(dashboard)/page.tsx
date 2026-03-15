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

export default function DashboardPage() {
  const urgentCases = trpc.dashboard.getUrgentCases.useQuery();
  const staleCases = trpc.dashboard.getStaleCases.useQuery();
  const summary = trpc.dashboard.getSummary.useQuery();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* FR-103: 案件の状況サマリー */}
      <section>
        <h2 className="text-lg font-semibold mb-4">案件の状況サマリー</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summary.data &&
            Object.entries(summary.data).map(([progress, counts]) => (
              <Link
                key={progress}
                href={`/cases?progress=${progress}`}
                className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
              >
                <p className="text-sm text-muted-foreground">
                  {progressLabels[progress] ?? progress}
                </p>
                <div className="mt-2 flex gap-4">
                  <div>
                    <span className="text-2xl font-bold">{counts.active}</span>
                    <span className="text-xs text-muted-foreground ml-1">対応中</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-muted-foreground">{counts.closed}</span>
                    <span className="text-xs text-muted-foreground ml-1">クローズ</span>
                  </div>
                </div>
              </Link>
            ))}
        </div>
        {summary.isLoading && <p className="text-muted-foreground">読み込み中...</p>}
      </section>

      {/* FR-101: 要対応案件 */}
      <section>
        <h2 className="text-lg font-semibold mb-4">要対応案件（期限7日以内）</h2>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3">案件名</th>
                <th className="text-left p-3">進捗</th>
                <th className="text-left p-3">次の作業</th>
                <th className="text-left p-3">期限</th>
                <th className="text-left p-3">主担当</th>
                <th className="text-left p-3">最終更新</th>
              </tr>
            </thead>
            <tbody>
              {urgentCases.data?.map((c: any) => (
                <tr key={c.id} className="border-b border-border hover:bg-accent/50">
                  <td className="p-3">
                    <Link href={`/cases/${c.id}`} className="text-primary hover:underline">
                      {c.category ?? `案件 ${c.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="p-3">{progressLabels[c.progress] ?? c.progress}</td>
                  <td className="p-3">{c.nextTask ?? "—"}</td>
                  <td className="p-3">
                    {c.deadline ? (
                      <span className={new Date(c.deadline) < new Date() ? "text-destructive font-medium" : ""}>
                        {new Date(c.deadline).toLocaleDateString("ja-JP")}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3">{c.primaryAssignee?.name ?? "—"}</td>
                  <td className="p-3">{new Date(c.updatedAt).toLocaleDateString("ja-JP")}</td>
                </tr>
              ))}
              {urgentCases.data?.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">要対応の案件はありません</td></tr>
              )}
            </tbody>
          </table>
          {urgentCases.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
        </div>
      </section>

      {/* FR-102: 更新が止まっている案件 */}
      <section>
        <h2 className="text-lg font-semibold mb-4">更新が止まっている案件（7日以上）</h2>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3">案件名</th>
                <th className="text-left p-3">進捗</th>
                <th className="text-left p-3">主担当</th>
                <th className="text-left p-3">最終更新</th>
              </tr>
            </thead>
            <tbody>
              {staleCases.data?.map((c: any) => (
                <tr key={c.id} className="border-b border-border hover:bg-accent/50">
                  <td className="p-3">
                    <Link href={`/cases/${c.id}`} className="text-primary hover:underline">
                      {c.category ?? `案件 ${c.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="p-3">{progressLabels[c.progress] ?? c.progress}</td>
                  <td className="p-3">{c.primaryAssignee?.name ?? "—"}</td>
                  <td className="p-3">{new Date(c.updatedAt).toLocaleDateString("ja-JP")}</td>
                </tr>
              ))}
              {staleCases.data?.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">該当する案件はありません</td></tr>
              )}
            </tbody>
          </table>
          {staleCases.isLoading && <p className="p-4 text-muted-foreground">読み込み中...</p>}
        </div>
      </section>
    </div>
  );
}
