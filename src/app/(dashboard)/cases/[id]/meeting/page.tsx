"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const confidenceLabels: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };
const confidenceColors: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-red-100 text-red-800",
};

type ViewMode = "split" | "transcript" | "risk";

export default function MeetingPage() {
  const params = useParams();
  const caseId = params.id as string;
  const utils = trpc.useUtils();

  const meetings = trpc.meeting.getByCase.useQuery({ caseId }, { refetchInterval: 5000 });
  const endMeeting = trpc.meeting.end.useMutation({
    onSuccess: () => utils.meeting.getByCase.invalidate({ caseId }),
  });
  const updateRiskStatus = trpc.meeting.updateRiskItemStatus.useMutation({
    onSuccess: () => utils.meeting.getByCase.invalidate({ caseId }),
  });

  const [searchKeyword, setSearchKeyword] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [notificationMode, setNotificationMode] = useState<"all" | "risk_only" | "muted">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const data = meetings.data as any;
  const activeMeeting = data?.find((m: any) => !m.endedAt);
  const latestMeeting = data?.[0];
  const currentMeeting = activeMeeting ?? latestMeeting;

  // 自動スクロール
  useEffect(() => {
    if (autoScroll && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMeeting?.transcripts?.length, autoScroll]);

  const filteredTranscripts = currentMeeting?.transcripts
    ?.filter((t: any) => !searchKeyword || t.text.includes(searchKeyword) || t.speaker.includes(searchKeyword))
    ?? [];

  const pendingRiskCount = currentMeeting?.riskItems?.filter((r: any) => r.status === "PENDING").length ?? 0;

  // 面談経過時間
  const elapsedTime = activeMeeting?.startedAt
    ? Math.floor((Date.now() - new Date(activeMeeting.startedAt).getTime()) / 1000)
    : null;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeMeeting?.startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(activeMeeting.startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeMeeting?.startedAt]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground text-base">
            &larr; 案件詳細
          </Link>
          <h1 className="text-3xl font-bold">面談中支援</h1>
          {activeMeeting && (
            <>
              <span className="px-2 py-0.5 text-sm bg-red-100 text-red-800 rounded animate-pulse font-medium">
                面談中
              </span>
              <span className="text-base font-mono text-muted-foreground">
                {formatElapsed(elapsed)}
              </span>
            </>
          )}
        </div>

        {/* コントロール */}
        <div className="flex items-center gap-2">
          {/* 表示モード切替 */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {[
              { key: "split" as const, label: "分割" },
              { key: "transcript" as const, label: "文字起こし" },
              { key: "risk" as const, label: "リスク" },
            ].map((mode) => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  viewMode === mode.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* 通知モード */}
          <select
            value={notificationMode}
            onChange={(e) => setNotificationMode(e.target.value as any)}
            className="px-2 py-1 text-sm border border-border rounded-lg bg-background"
          >
            <option value="all">全通知</option>
            <option value="risk_only">リスクのみ</option>
            <option value="muted">ミュート</option>
          </select>

          {/* 自動スクロール */}
          <label className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            自動追従
          </label>
        </div>
      </div>

      {/* 統計バー */}
      {currentMeeting && (
        <div className="flex gap-4 text-base">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">発言数:</span>
            <span className="font-medium">{currentMeeting.transcripts?.length ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">確定:</span>
            <span className="font-medium">{currentMeeting.transcripts?.filter((t: any) => t.isFinal).length ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">暫定:</span>
            <span className="font-medium text-yellow-600">{currentMeeting.transcripts?.filter((t: any) => !t.isFinal).length ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">リスク検知:</span>
            <span className={`font-medium ${pendingRiskCount > 0 ? "text-red-600" : ""}`}>
              {currentMeeting.riskItems?.length ?? 0}
              {pendingRiskCount > 0 && ` (未対応: ${pendingRiskCount})`}
            </span>
          </div>
        </div>
      )}

      {!currentMeeting && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">面談データがありません。</p>
          <p className="text-base text-muted-foreground mt-2">
            会議ツール（Teams/Zoom）のBotが入室すると、ここにリアルタイムの文字起こしとリスク判定が表示されます。
          </p>
        </div>
      )}

      {currentMeeting && (
        <div className={`grid gap-4 ${
          viewMode === "split" ? "grid-cols-1 lg:grid-cols-3" :
          "grid-cols-1"
        }`}>
          {/* 文字起こしパネル */}
          {(viewMode === "split" || viewMode === "transcript") && (
            <div className={`bg-card border border-border rounded-lg flex flex-col ${viewMode === "split" ? "lg:col-span-2" : ""}`} style={{ maxHeight: "70vh" }}>
              <div className="p-3 border-b border-border flex justify-between items-center">
                <h2 className="font-semibold">文字起こし</h2>
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="px-2 py-1 border border-border rounded-lg text-sm w-40"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredTranscripts.map((t: any) => (
                  <div key={t.id} className={`flex gap-2 text-base ${!t.isFinal ? "opacity-60" : ""}`}>
                    <span className="text-sm text-muted-foreground whitespace-nowrap min-w-14">
                      {Math.floor(t.timestamp / 60)}:{String(Math.floor(t.timestamp % 60)).padStart(2, "0")}
                    </span>
                    <span className="font-medium min-w-20 text-primary">{t.speaker}</span>
                    <span className="flex-1">{t.text}</span>
                    <span className={`text-sm px-1.5 py-0.5 rounded ${confidenceColors[t.confidence] ?? ""}`}>
                      {confidenceLabels[t.confidence] ?? t.confidence}
                    </span>
                    {!t.isFinal && <span className="text-sm text-yellow-600">暫定</span>}
                  </div>
                ))}
                {filteredTranscripts.length === 0 && (
                  <p className="text-center text-muted-foreground text-base py-8">
                    文字起こしデータを待機中...
                  </p>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}

          {/* リスク判定パネル */}
          {(viewMode === "split" || viewMode === "risk") && (
            <div className="bg-card border border-border rounded-lg flex flex-col" style={{ maxHeight: "70vh" }}>
              <div className="p-3 border-b border-border flex justify-between items-center">
                <h2 className="font-semibold">リスク判定</h2>
                {pendingRiskCount > 0 && (
                  <span className="px-2 py-0.5 text-sm rounded-full bg-red-100 text-red-700 font-medium">
                    {pendingRiskCount}件未対応
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {currentMeeting.riskItems?.map((r: any) => (
                  <div key={r.id} className={`p-3 border rounded-lg text-base space-y-2 ${
                    r.status === "PENDING" ? "border-red-200 bg-red-50/50" : "border-border"
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className={`text-sm px-1.5 py-0.5 rounded ${confidenceColors[r.confidence] ?? ""}`}>
                        信頼度: {confidenceLabels[r.confidence] ?? r.confidence}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {Math.floor(r.timestamp / 60)}:{String(Math.floor(r.timestamp % 60)).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.speaker}</p>
                    <p className="font-medium">&ldquo;{r.text}&rdquo;</p>
                    <p className="text-muted-foreground text-sm">理由: {r.reason}</p>
                    {r.rephrasing && (
                      <div className="bg-muted p-2 rounded text-sm">
                        <span className="font-medium">言い換え案: </span>{r.rephrasing}
                      </div>
                    )}
                    <div className="flex gap-1">
                      {r.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => updateRiskStatus.mutate({ riskItemId: r.id, status: "ACCEPTED" })}
                            className="px-2 py-0.5 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                          >
                            採択
                          </button>
                          <button
                            onClick={() => updateRiskStatus.mutate({ riskItemId: r.id, status: "REJECTED" })}
                            className="px-2 py-0.5 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                          >
                            却下
                          </button>
                        </>
                      ) : (
                        <span className={`text-sm px-2 py-0.5 rounded ${
                          r.status === "ACCEPTED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {r.status === "ACCEPTED" ? "採択" : "却下"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(!currentMeeting.riskItems || currentMeeting.riskItems.length === 0) && (
                  <p className="text-center text-muted-foreground text-base py-8">
                    リスク項目なし
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 面談終了ボタン */}
      {activeMeeting && (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              if (confirm("面談を終了しますか？録音と処理が停止します。")) {
                endMeeting.mutate({ meetingId: activeMeeting.id });
              }
            }}
            disabled={endMeeting.isPending}
            className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {endMeeting.isPending ? "終了処理中..." : "面談を終了"}
          </button>
        </div>
      )}

      {/* 終了済み面談の場合のナビゲーション */}
      {currentMeeting && !activeMeeting && (
        <div className="flex justify-center gap-4">
          <Link
            href={`/cases/${caseId}/review`}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90"
          >
            レビュー画面へ
          </Link>
        </div>
      )}
    </div>
  );
}
