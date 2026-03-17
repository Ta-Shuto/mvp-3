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

type Tab = "transcript" | "risk" | "summary" | "report";

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
  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState({ keyPoints: "", actionItems: "", concerns: "" });
  const [exportFormat, setExportFormat] = useState<string | null>(null);
  const [reportData, setReportData] = useState({
    meetingPurpose: "",
    participants: "",
    findings: "",
    riskAssessment: "",
    recommendations: "",
    nextSteps: "",
  });

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

  // 事後レポートの自動生成
  const generateReport = () => {
    const transcripts = currentMeeting?.transcripts?.filter((t: any) => t.isFinal) ?? [];
    const risks = currentMeeting?.riskItems ?? [];
    const speakers = [...new Set(transcripts.map((t: any) => t.speaker))];
    const acceptedRisks = risks.filter((r: any) => r.status === "ACCEPTED");
    const summary = currentMeeting?.meetingSummary;

    setReportData({
      meetingPurpose: "面談による事実確認及びヒアリング",
      participants: speakers.join("、") || "（参加者情報なし）",
      findings: summary
        ? (typeof summary === "string" ? summary : (summary as any)?.keyPoints ?? "")
        : `発言数: ${transcripts.length}件、確認事項: ${risks.length}件`,
      riskAssessment: acceptedRisks.length > 0
        ? acceptedRisks.map((r: any) => `- ${r.text}（理由: ${r.reason}）`).join("\n")
        : "特記すべきリスク事項なし",
      recommendations: acceptedRisks.length > 0
        ? "採択されたリスク項目について、追加調査及び対応策の検討を推奨"
        : "現時点で追加対応の必要性は低い",
      nextSteps: "",
    });
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "transcript", label: "文字起こし" },
    { key: "risk", label: "リスク項目", badge: currentMeeting?.riskItems?.filter((r: any) => r.status === "PENDING").length },
    { key: "summary", label: "面談要点" },
    { key: "report", label: "事後レポート" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground text-sm">
            &larr; 案件詳細
          </Link>
          <h1 className="text-2xl font-bold">面談レビュー</h1>
        </div>

        {/* エクスポート */}
        {currentMeeting && (
          <div className="flex gap-2">
            {["csv", "pdf", "txt"].map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={exportFormat !== null}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent disabled:opacity-50"
              >
                {exportFormat === fmt ? "処理中..." : `${fmt.toUpperCase()}`}
              </button>
            ))}
          </div>
        )}
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
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                i === selectedMeetingIndex
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent"
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
          {/* タブ */}
          <div className="border-b border-border">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative ${
                    activeTab === tab.key
                      ? "text-primary border-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 文字起こしタブ */}
          {activeTab === "transcript" && (
            <div className="bg-card border border-border rounded-lg flex flex-col" style={{ maxHeight: "65vh" }}>
              <div className="p-3 border-b border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {filteredTranscripts.length}件の確定発言
                </span>
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="px-2 py-1 border border-border rounded-lg text-xs w-40"
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
                    {searchKeyword ? "該当する発言が見つかりません" : "文字起こしデータなし"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* リスク項目タブ */}
          {activeTab === "risk" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {["ALL", "PENDING", "ACCEPTED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setRiskFilter(status)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      riskFilter === status
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {status === "ALL" ? "すべて" : status === "PENDING" ? "未対応" : status === "ACCEPTED" ? "採択済" : "却下済"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredRiskItems.map((r: any) => (
                  <div key={r.id} className={`bg-card border rounded-lg p-4 text-sm space-y-2 ${
                    r.status === "PENDING" ? "border-red-200" : "border-border"
                  }`}>
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
                  <p className="text-center text-muted-foreground text-sm py-8 bg-card border border-border rounded-lg">
                    リスク項目なし
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 面談要点タブ */}
          {activeTab === "summary" && (
            <section className="bg-card border border-border rounded-lg p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">面談要点</h2>
                <div className="flex gap-2">
                  {editingSummary ? (
                    <>
                      <button
                        onClick={() => setEditingSummary(false)}
                        className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => {
                          updateSummary.mutate({ meetingId: currentMeeting.id, summary: summaryForm });
                          setEditingSummary(false);
                        }}
                        disabled={updateSummary.isPending}
                        className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                      >
                        保存
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        const s = currentMeeting.meetingSummary as any;
                        setSummaryForm({
                          keyPoints: (typeof s === "object" ? s?.keyPoints : s) ?? "",
                          actionItems: (typeof s === "object" ? s?.actionItems : "") ?? "",
                          concerns: (typeof s === "object" ? s?.concerns : "") ?? "",
                        });
                        setEditingSummary(true);
                      }}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent"
                    >
                      編集
                    </button>
                  )}
                </div>
              </div>

              {editingSummary ? (
                <div className="space-y-4">
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
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm mt-1"
                        rows={4}
                      />
                    </div>
                  ))}
                </div>
              ) : currentMeeting.meetingSummary ? (
                <div className="space-y-4 text-sm">
                  {typeof currentMeeting.meetingSummary === "string" ? (
                    <p className="whitespace-pre-wrap">{currentMeeting.meetingSummary}</p>
                  ) : (
                    [
                      { key: "keyPoints", label: "要点" },
                      { key: "actionItems", label: "アクションアイテム" },
                      { key: "concerns", label: "懸念事項" },
                    ].map(({ key, label }) => {
                      const value = (currentMeeting.meetingSummary as any)?.[key];
                      if (!value) return null;
                      return (
                        <div key={key}>
                          <h3 className="text-xs font-medium text-muted-foreground mb-1">{label}</h3>
                          <p className="whitespace-pre-wrap">{value}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">要点データがありません（面談終了後に自動生成されます）</p>
              )}
            </section>
          )}

          {/* 事後レポートタブ */}
          {activeTab === "report" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  面談データに基づいた構造化レポートを作成します
                </p>
                <button
                  onClick={generateReport}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                >
                  自動生成
                </button>
              </div>

              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                {[
                  { key: "meetingPurpose", label: "面談目的", rows: 2 },
                  { key: "participants", label: "参加者", rows: 1 },
                  { key: "findings", label: "確認事項・所見", rows: 4 },
                  { key: "riskAssessment", label: "リスク評価", rows: 4 },
                  { key: "recommendations", label: "推奨対応", rows: 3 },
                  { key: "nextSteps", label: "次のステップ", rows: 3 },
                ].map(({ key, label, rows }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-1">{label}</label>
                    <textarea
                      value={(reportData as any)[key]}
                      onChange={(e) => setReportData((d) => ({ ...d, [key]: e.target.value }))}
                      rows={rows}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-y"
                      placeholder={`${label}を入力...`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    const report = Object.entries(reportData)
                      .map(([key, value]) => {
                        const labels: Record<string, string> = {
                          meetingPurpose: "面談目的",
                          participants: "参加者",
                          findings: "確認事項・所見",
                          riskAssessment: "リスク評価",
                          recommendations: "推奨対応",
                          nextSteps: "次のステップ",
                        };
                        return `【${labels[key] ?? key}】\n${value || "（未記入）"}`;
                      })
                      .join("\n\n");
                    navigator.clipboard.writeText(report);
                    alert("クリップボードにコピーしました");
                  }}
                  className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent"
                >
                  レポートをコピー
                </button>
              </div>
            </div>
          )}
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
