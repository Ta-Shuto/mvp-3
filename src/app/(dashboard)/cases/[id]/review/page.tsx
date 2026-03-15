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

export default function ReviewPage() {
  const params = useParams();
  const caseId = params.id as string;
  const utils = trpc.useUtils();

  const meetings = trpc.meeting.getByCase.useQuery({ caseId });
  const updateRiskStatus = trpc.meeting.updateRiskItemStatus.useMutation({
    onSuccess: () => utils.meeting.getByCase.invalidate({ caseId }),
  });
  const updateSummary = trpc.meeting.updateSummary.useMutation({
    onSuccess: () => utils.meeting.getByCase.invalidate({ caseId }),
  });

  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState({ keyPoints: "", actionItems: "", concerns: "" });
  const [exportFormat, setExportFormat] = useState<string | null>(null);

  const data = meetings.data as any;
  const completedMeetings = data?.filter((m: any) => m.endedAt) ?? [];
  const currentMeeting = completedMeetings[selectedMeetingIndex];

  const filteredTranscripts = currentMeeting?.transcripts
    ?.filter((t: any) => t.isFinal)
    ?.filter((t: any) => !searchKeyword || t.text.includes(searchKeyword) || t.speaker.includes(searchKeyword))
    ?? [];

  const filteredRiskItems = currentMeeting?.riskItems
    ?.filter((r: any) => riskFilter === "ALL" || r.status === riskFilter)
    ?? [];

  const handleExport = async (format: string) => {
    setExportFormat(format);
    try {
      const res = await fetch(`/api/export?meetingId=${currentMeeting.id}&format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meeting-${currentMeeting.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("エクスポートに失敗しました");
    } finally {
      setExportFormat(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground text-sm">
          &larr; 案件詳細
        </Link>
        <h1 className="text-2xl font-bold">面談レビュー</h1>
      </div>

      {completedMeetings.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">終了した面談がありません。</p>
        </div>
      )}

      {/* 面談選択 */}
      {completedMeetings.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {completedMeetings.map((m: any, i: number) => (
            <button
              key={m.id}
              onClick={() => setSelectedMeetingIndex(i)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                i === selectedMeetingIndex
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              }`}
            >
              面談 {completedMeetings.length - i}
              <span className="ml-2 text-xs opacity-70">
                {new Date(m.endedAt).toLocaleDateString("ja-JP")}
              </span>
            </button>
          ))}
        </div>
      )}

      {currentMeeting && (
        <>
          {/* FR-114: 面談要点 */}
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">面談要点</h2>
              <div className="flex gap-2">
                {editingSummary ? (
                  <>
                    <button
                      onClick={() => setEditingSummary(false)}
                      className="px-3 py-1 text-xs border border-input rounded-md hover:bg-accent"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => {
                        updateSummary.mutate({ meetingId: currentMeeting.id, summary: summaryForm });
                        setEditingSummary(false);
                      }}
                      disabled={updateSummary.isPending}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90"
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const s = currentMeeting.summary as any;
                      setSummaryForm({
                        keyPoints: s?.keyPoints ?? "",
                        actionItems: s?.actionItems ?? "",
                        concerns: s?.concerns ?? "",
                      });
                      setEditingSummary(true);
                    }}
                    className="px-3 py-1 text-xs text-primary hover:underline"
                  >
                    編集
                  </button>
                )}
              </div>
            </div>

            {currentMeeting.summary ? (
              editingSummary ? (
                <div className="space-y-3">
                  {[
                    { key: "keyPoints", label: "要点" },
                    { key: "actionItems", label: "アクションアイテム" },
                    { key: "concerns", label: "懸念事項" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-muted-foreground">{label}</label>
                      <textarea
                        value={(summaryForm as any)[key]}
                        onChange={(e) => setSummaryForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-20"
                        rows={3}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {[
                    { key: "keyPoints", label: "要点" },
                    { key: "actionItems", label: "アクションアイテム" },
                    { key: "concerns", label: "懸念事項" },
                  ].map(({ key, label }) => {
                    const value = (currentMeeting.summary as any)?.[key];
                    if (!value) return null;
                    return (
                      <div key={key}>
                        <h3 className="text-xs font-medium text-muted-foreground mb-1">{label}</h3>
                        <p className="whitespace-pre-wrap">{value}</p>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">要点データがありません（面談終了後に自動生成されます）</p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* FR-052~054: 文字起こしレビュー */}
            <div className="lg:col-span-2 bg-card border border-border rounded-lg flex flex-col" style={{ maxHeight: "60vh" }}>
              <div className="p-3 border-b border-border flex justify-between items-center">
                <h2 className="font-semibold">文字起こし（確定のみ）</h2>
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="px-2 py-1 border border-input rounded text-xs w-32"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredTranscripts.map((t: any) => (
                  <div key={t.id} className="flex gap-2 text-sm">
                    <span className="text-xs text-muted-foreground whitespace-nowrap min-w-14">
                      {Math.floor(t.timestamp / 60)}:{String(Math.floor(t.timestamp % 60)).padStart(2, "0")}
                    </span>
                    <span className="font-medium min-w-20 text-primary">{t.speaker}</span>
                    <span className="flex-1">
                      {searchKeyword ? (
                        <HighlightText text={t.text} keyword={searchKeyword} />
                      ) : (
                        t.text
                      )}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceColors[t.confidence] ?? ""}`}>
                      {confidenceLabels[t.confidence] ?? t.confidence}
                    </span>
                  </div>
                ))}
                {filteredTranscripts.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    {searchKeyword ? "該当する文字起こしが見つかりません" : "文字起こしデータなし"}
                  </p>
                )}
              </div>
            </div>

            {/* FR-055: リスク一覧 */}
            <div className="bg-card border border-border rounded-lg flex flex-col" style={{ maxHeight: "60vh" }}>
              <div className="p-3 border-b border-border">
                <h2 className="font-semibold mb-2">リスク項目</h2>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="w-full px-2 py-1 border border-input rounded text-xs bg-background"
                >
                  <option value="ALL">すべて</option>
                  <option value="PENDING">未対応</option>
                  <option value="ACCEPTED">採択済み</option>
                  <option value="REJECTED">却下済み</option>
                </select>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {filteredRiskItems.map((r: any) => (
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
                    <div className="flex gap-1">
                      {r.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => updateRiskStatus.mutate({ riskItemId: r.id, status: "ACCEPTED" })}
                            className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                          >
                            採択
                          </button>
                          <button
                            onClick={() => updateRiskStatus.mutate({ riskItemId: r.id, status: "REJECTED" })}
                            className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                          >
                            却下
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          r.status === "ACCEPTED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {r.status === "ACCEPTED" ? "採択" : "却下"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {filteredRiskItems.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    リスク項目なし
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* FR-095, FR-096: エクスポート & FR-056: クローズ */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {["csv", "pdf", "txt"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  disabled={exportFormat !== null}
                  className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent disabled:opacity-50"
                >
                  {exportFormat === fmt ? "処理中..." : `${fmt.toUpperCase()} エクスポート`}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
