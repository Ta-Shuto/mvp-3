import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import prisma from "@/server/db/client";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  const caseId = req.nextUrl.searchParams.get("caseId");
  const format = req.nextUrl.searchParams.get("format") ?? "txt";

  // Case-level export
  if (caseId && !meetingId) {
    return handleCaseExport(caseId, format, session);
  }

  if (!meetingId) {
    return NextResponse.json({ error: "meetingId or caseId required" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcripts: { where: { isFinal: true }, orderBy: { timestamp: "asc" } },
      riskItems: { orderBy: { timestamp: "asc" } },
      case: { select: { organizationId: true, caseName: true, caseCategory: true } },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Tenant check
  const user = session.user as any;
  if (meeting.case.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transcripts = meeting.transcripts as any[];
  const riskItems = meeting.riskItems as any[];
  const summary = (meeting as any).meetingSummary;

  // Audit log
  writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    caseId: meeting.caseId,
    eventType: AuditEventTypes.EXPORT_DOWNLOADED,
    details: { meetingId, format },
  }).catch(() => {});

  if (format === "csv") {
    return exportCSV(meetingId, transcripts, riskItems);
  }

  if (format === "pdf") {
    return exportPDF(meeting, transcripts, riskItems, summary);
  }

  // Default: TXT
  return exportTXT(meeting, transcripts, riskItems, summary);
}

function formatTimestamp(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function exportCSV(meetingId: string, transcripts: any[], riskItems: any[]) {
  const bom = "\uFEFF";
  let csv = bom;

  csv += "面談文字起こし\n";
  csv += "タイムスタンプ,話者,発言内容,信頼度\n";
  transcripts.forEach((t) => {
    const text = `"${(t.text ?? "").replace(/"/g, '""')}"`;
    csv += `${formatTimestamp(t.timestamp)},${t.speaker},${text},${t.confidence}\n`;
  });

  if (riskItems.length > 0) {
    csv += "\nリスク項目\n";
    csv += "タイムスタンプ,話者,発言内容,理由,信頼度,ステータス,言い換え案\n";
    riskItems.forEach((r) => {
      const text = `"${(r.text ?? "").replace(/"/g, '""')}"`;
      const reason = `"${(r.reason ?? "").replace(/"/g, '""')}"`;
      const rephrase = `"${(r.rephrasing ?? "").replace(/"/g, '""')}"`;
      csv += `${formatTimestamp(r.timestamp)},${r.speaker},${text},${reason},${r.confidence},${r.status},${rephrase}\n`;
    });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${meetingId}.csv"`,
    },
  });
}

function exportTXT(meeting: any, transcripts: any[], riskItems: any[], summary: any) {
  let content = `面談記録 - ${meeting.case?.caseName ?? meeting.id}\n`;
  content += `開始: ${meeting.startedAt?.toISOString() ?? "不明"}\n`;
  content += `終了: ${meeting.endedAt?.toISOString() ?? "不明"}\n`;
  content += `${"=".repeat(50)}\n\n`;

  if (summary) {
    content += "【要点】\n";
    if (typeof summary === "string") {
      content += `${summary}\n\n`;
    } else {
      if (summary.keyPoints) content += `${summary.keyPoints}\n\n`;
      if (summary.actionItems) content += `【アクションアイテム】\n${summary.actionItems}\n\n`;
      if (summary.concerns) content += `【懸念事項】\n${summary.concerns}\n\n`;
    }
    content += `${"=".repeat(50)}\n\n`;
  }

  content += "【文字起こし】\n";
  transcripts.forEach((t) => {
    content += `[${formatTimestamp(t.timestamp)}] ${t.speaker}: ${t.text}\n`;
  });

  if (riskItems.length > 0) {
    content += `\n${"=".repeat(50)}\n\n【リスク項目】\n`;
    riskItems.forEach((r) => {
      content += `[${formatTimestamp(r.timestamp)}] ${r.speaker}: "${r.text}"\n`;
      content += `  理由: ${r.reason}\n`;
      content += `  信頼度: ${r.confidence} / 状態: ${r.status}\n`;
      if (r.rephrasing) content += `  言い換え案: ${r.rephrasing}\n`;
      content += "\n";
    });
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${meeting.id}.txt"`,
    },
  });
}

function exportPDF(meeting: any, transcripts: any[], riskItems: any[], summary: any) {
  // Generate a print-friendly HTML document that can be saved as PDF via browser
  const caseName = meeting.case?.caseName ?? meeting.id;
  const startedAt = meeting.startedAt ? new Date(meeting.startedAt).toLocaleString("ja-JP") : "不明";
  const endedAt = meeting.endedAt ? new Date(meeting.endedAt).toLocaleString("ja-JP") : "不明";

  let html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>面談記録 - ${caseName}</title>
<style>
body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; margin: 40px; color: #333; font-size: 14px; line-height: 1.6; }
h1 { font-size: 22px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; color: #1e1b4b; }
h2 { font-size: 16px; color: #4f46e5; margin-top: 24px; border-left: 4px solid #4f46e5; padding-left: 8px; }
.meta { color: #666; font-size: 13px; margin-bottom: 16px; }
.transcript { margin: 4px 0; }
.ts { color: #888; font-size: 12px; min-width: 50px; display: inline-block; }
.speaker { font-weight: bold; color: #4f46e5; min-width: 80px; display: inline-block; }
.risk { background: #fef2f2; border-left: 3px solid #ef4444; padding: 8px 12px; margin: 8px 0; border-radius: 4px; }
.risk-header { font-weight: bold; color: #dc2626; }
.summary-section { background: #f5f3ff; padding: 12px; border-radius: 6px; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th, td { padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 13px; }
th { background: #f3f4f6; font-weight: 600; }
@media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>面談記録</h1>
<div class="meta">
<strong>案件:</strong> ${caseName}<br>
<strong>開始:</strong> ${startedAt} / <strong>終了:</strong> ${endedAt}<br>
<strong>発言数:</strong> ${transcripts.length}件 / <strong>リスク項目:</strong> ${riskItems.length}件
</div>`;

  if (summary) {
    html += `<h2>要点</h2><div class="summary-section">`;
    if (typeof summary === "string") {
      html += `<p>${summary.replace(/\n/g, "<br>")}</p>`;
    } else {
      if (summary.keyPoints) html += `<p><strong>要点:</strong><br>${summary.keyPoints.replace(/\n/g, "<br>")}</p>`;
      if (summary.actionItems) html += `<p><strong>アクションアイテム:</strong><br>${summary.actionItems.replace(/\n/g, "<br>")}</p>`;
      if (summary.concerns) html += `<p><strong>懸念事項:</strong><br>${summary.concerns.replace(/\n/g, "<br>")}</p>`;
    }
    html += `</div>`;
  }

  html += `<h2>文字起こし</h2>`;
  if (transcripts.length > 0) {
    html += `<table><thead><tr><th>時刻</th><th>話者</th><th>内容</th><th>信頼度</th></tr></thead><tbody>`;
    transcripts.forEach((t) => {
      html += `<tr><td>${formatTimestamp(t.timestamp)}</td><td>${t.speaker}</td><td>${t.text}</td><td>${t.confidence}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p style="color:#888;">文字起こしデータなし</p>`;
  }

  if (riskItems.length > 0) {
    html += `<h2>リスク項目</h2>`;
    riskItems.forEach((r) => {
      html += `<div class="risk">`;
      html += `<div class="risk-header">[${formatTimestamp(r.timestamp)}] ${r.speaker} - ${r.confidence} / ${r.status === "ACCEPTED" ? "採択" : r.status === "REJECTED" ? "却下" : "未対応"}</div>`;
      html += `<p>&ldquo;${r.text}&rdquo;</p>`;
      html += `<p><strong>理由:</strong> ${r.reason}</p>`;
      if (r.rephrasing) html += `<p><strong>言い換え案:</strong> ${r.rephrasing}</p>`;
      html += `</div>`;
    });
  }

  html += `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#999;font-size:12px;">
Interview Support Platform - 出力日時: ${new Date().toLocaleString("ja-JP")}
</div></body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${meeting.id}.html"`,
    },
  });
}

async function handleCaseExport(caseId: string, format: string, session: any) {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      primaryAssignee: { select: { name: true } },
      assignments: { include: { user: { select: { name: true } } } },
      meetings: {
        include: {
          transcripts: { where: { isFinal: true }, orderBy: { timestamp: "asc" } },
          riskItems: { orderBy: { timestamp: "asc" } },
        },
      },
      preChat: { include: { answers: true } },
      progressHistory: { include: { updatedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!caseData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = session.user as any;
  if (caseData.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    caseId,
    eventType: AuditEventTypes.EXPORT_DOWNLOADED,
    details: { format, type: "case" },
  }).catch(() => {});

  const c = caseData as any;
  let content = `案件レポート\n${"=".repeat(50)}\n\n`;
  content += `案件名: ${c.caseName ?? "—"}\n`;
  content += `カテゴリ: ${c.caseCategory ?? "—"}\n`;
  content += `ステータス: ${c.status}\n`;
  content += `リスクレベル: ${c.riskLevel ?? "—"}\n`;
  content += `担当者: ${c.primaryAssignee?.name ?? "未割当"}\n`;
  content += `作成日: ${new Date(c.createdAt).toLocaleDateString("ja-JP")}\n`;
  if (c.closedAt) content += `完了日: ${new Date(c.closedAt).toLocaleDateString("ja-JP")}\n`;
  content += `\n`;

  if (c.category) content += `事象カテゴリ: ${c.category}\n`;
  if (c.issue) content += `争点: ${c.issue}\n`;
  if (c.conclusion) content += `結論: ${c.conclusion}\n`;
  if (c.action) content += `対応: ${c.action}\n`;
  content += `\n${"=".repeat(50)}\n`;

  if (c.preChat?.answers?.length > 0) {
    content += `\n【事前回答】\n`;
    c.preChat.answers.forEach((a: any, i: number) => {
      content += `Q${i + 1}: ${a.questionId}\nA: ${a.answerText}\n\n`;
    });
  }

  if (c.meetings.length > 0) {
    content += `\n【面談記録】\n`;
    c.meetings.forEach((m: any, mi: number) => {
      content += `\n--- 面談 ${mi + 1} (${m.startedAt ? new Date(m.startedAt).toLocaleDateString("ja-JP") : "—"}) ---\n`;
      content += `発言数: ${m.transcripts.length}件 / リスク項目: ${m.riskItems.length}件\n`;
      if (m.meetingSummary) {
        const s = m.meetingSummary;
        content += `要点: ${typeof s === "string" ? s : s.keyPoints ?? ""}\n`;
      }
      m.riskItems.filter((r: any) => r.status === "ACCEPTED").forEach((r: any) => {
        content += `  [リスク] ${r.text} - ${r.reason}\n`;
      });
    });
  }

  if (c.progressHistory.length > 0) {
    content += `\n【進捗履歴】\n`;
    c.progressHistory.forEach((h: any) => {
      content += `${new Date(h.createdAt).toLocaleDateString("ja-JP")} ${h.previousValue} → ${h.currentValue} (${h.updatedBy.name})\n`;
    });
  }

  const ext = format === "csv" ? "csv" : "txt";
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="case-${caseId.slice(0, 8)}.${ext}"`,
    },
  });
}
