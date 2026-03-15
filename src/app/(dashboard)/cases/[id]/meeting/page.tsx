"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const confidenceLabels: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };
const confidenceColors: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-red-100 text-red-800",
};

export default function MeetingPage() {
  const params = useParams();
  const caseId = params.id as string;
  const utils = trpc.useUtils();

  const meetings = trpc.meeting.getByCase.useQuery({ caseId });
  const endMeeting = trpc.meeting.end.useMutation({
    onSuccess: () => utils.meeting.getByCase.invalidate({ caseId }),
  });

  const [searchKeyword, setSearchKeyword] = useState("");

  const data = meetings.data as any;
  const activeMeeting = data?.find((m: any) => !m.endedAt);
  const latestMeeting = data?.[0];
  const currentMeeting = activeMeeting ?? latestMeeting;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground text-sm">
          &larr; 案件詳細
        </Link>
        <h1 className="text-2xl font-bold">面談中支援</h1>
        {activeMeeting && (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded animate-pulse">
            面談中
          </span>
        )}
      </div>

      {!currentMeeting && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">面談データがありません。</p>
          <p className="text-sm text-muted-foreground mt-2">
            会議ツール（Teams/Zoom）のBotが入室すると、ここにリアルタイムの文字起こしとリスク判定が表示されます。
          </p>
        </div>
      )}

      {currentMeeting && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 文字起こしパネル */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg flex flex-col" style={{ maxHeight: "70vh" }}>
            <div className="p-3 border-b border-border flex justify-between items-center">
              <h2 className="font-semibold">文字起こし</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="px-2 py-1 border border-input rounded text-xs w-32"
                />
                {/* FR-050: 暫定/確定表示 */}
                <span className="text-xs text-muted-foreground">
                  {currentMeeting.transcripts?.filter((t: any) => t.isFinal).length ?? 0} 確定 /
                  {currentMeeting.transcripts?.filter((t: any) => !t.isFinal).length ?? 0} 暫定
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {currentMeeting.transcripts
                ?.filter((t: any) => !searchKeyword || t.text.includes(searchKeyword))
                .map((t: any) => (
                  <div key={t.id} className={`flex gap-2 text-sm ${!t.isFinal ? "opacity-60" : ""}`}>
                    <span className="text-xs text-muted-foreground whitespace-nowrap min-w-14">
                      {Math.floor(t.timestamp / 60)}:{String(Math.floor(t.timestamp % 60)).padStart(2, "0")}
                    </span>
                    <span className="font-medium min-w-20 text-primary">{t.speaker}</span>
                    <span className="flex-1">{t.text}</span>
                    {/* FR-087: 信頼度 */}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceColors[t.confidence] ?? ""}`}>
                      {confidenceLabels[t.confidence] ?? t.confidence}
                    </span>
                    {!t.isFinal && <span className="text-xs text-yellow-600">暫定</span>}
                  </div>
                ))}
              {(!currentMeeting.transcripts || currentMeeting.transcripts.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  文字起こしデータを待機中...
                </p>
              )}
            </div>
          </div>

          {/* リスク判定パネル */}
          <div className="bg-card border border-border rounded-lg flex flex-col" style={{ maxHeight: "70vh" }}>
            <div className="p-3 border-b border-border">
              <h2 className="font-semibold">リスク判定</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {currentMeeting.riskItems?.map((r: any) => (
                <div key={r.id} className="p-3 border border-border rounded-lg text-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceColors[r.confidence] ?? ""}`}>
                      信頼度: {confidenceLabels[r.confidence] ?? r.confidence}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(r.timestamp / 60)}:{String(Math.floor(r.timestamp % 60)).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.speaker}</p>
                  <p className="font-medium">&ldquo;{r.text}&rdquo;</p>
                  <p className="text-muted-foreground text-xs">理由: {r.reason}</p>
                  {r.rephrasing && (
                    <div className="bg-muted p-2 rounded text-xs">
                      <span className="font-medium">言い換え案: </span>{r.rephrasing}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.status === "ACCEPTED" ? "bg-green-100 text-green-800" :
                      r.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      "bg-secondary"
                    }`}>
                      {r.status === "ACCEPTED" ? "採択" : r.status === "REJECTED" ? "却下" : "未対応"}
                    </span>
                  </div>
                </div>
              ))}
              {(!currentMeeting.riskItems || currentMeeting.riskItems.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  リスク項目なし
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FR-049: 面談終了ボタン */}
      {activeMeeting && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              if (confirm("面談を終了しますか？録音と処理が停止します。")) {
                endMeeting.mutate({ meetingId: activeMeeting.id });
              }
            }}
            disabled={endMeeting.isPending}
            className="px-6 py-3 bg-destructive text-destructive-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {endMeeting.isPending ? "終了処理中..." : "面談を終了"}
          </button>
        </div>
      )}
    </div>
  );
}
