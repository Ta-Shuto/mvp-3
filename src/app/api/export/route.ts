import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import prisma from "@/server/db/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  const format = req.nextUrl.searchParams.get("format") ?? "txt";

  if (!meetingId) {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcripts: { where: { isFinal: true }, orderBy: { timestamp: "asc" } },
      riskItems: { orderBy: { timestamp: "asc" } },
      case: { select: { organizationId: true } },
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

  if (format === "csv") {
    const header = "timestamp,speaker,text,confidence\n";
    const rows = transcripts.map((t) => {
      const ts = `${Math.floor(t.timestamp / 60)}:${String(Math.floor(t.timestamp % 60)).padStart(2, "0")}`;
      const text = `"${(t.text ?? "").replace(/"/g, '""')}"`;
      return `${ts},${t.speaker},${text},${t.confidence}`;
    }).join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="meeting-${meetingId}.csv"`,
      },
    });
  }

  if (format === "txt") {
    let content = `面談記録 - ${meeting.id}\n`;
    content += `開始: ${meeting.startedAt?.toISOString() ?? "不明"}\n`;
    content += `終了: ${meeting.endedAt?.toISOString() ?? "不明"}\n`;
    content += `${"=".repeat(50)}\n\n`;

    if (summary) {
      content += "【要点】\n";
      if (summary.keyPoints) content += `${summary.keyPoints}\n\n`;
      if (summary.actionItems) content += `【アクションアイテム】\n${summary.actionItems}\n\n`;
      if (summary.concerns) content += `【懸念事項】\n${summary.concerns}\n\n`;
      content += `${"=".repeat(50)}\n\n`;
    }

    content += "【文字起こし】\n";
    transcripts.forEach((t) => {
      const ts = `${Math.floor(t.timestamp / 60)}:${String(Math.floor(t.timestamp % 60)).padStart(2, "0")}`;
      content += `[${ts}] ${t.speaker}: ${t.text}\n`;
    });

    if (riskItems.length > 0) {
      content += `\n${"=".repeat(50)}\n\n【リスク項目】\n`;
      riskItems.forEach((r) => {
        const ts = `${Math.floor(r.timestamp / 60)}:${String(Math.floor(r.timestamp % 60)).padStart(2, "0")}`;
        content += `[${ts}] ${r.speaker}: "${r.text}"\n`;
        content += `  理由: ${r.reason}\n`;
        content += `  信頼度: ${r.confidence} / 状態: ${r.status}\n`;
        if (r.rephrasing) content += `  言い換え案: ${r.rephrasing}\n`;
        content += "\n";
      });
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="meeting-${meetingId}.txt"`,
      },
    });
  }

  // PDF - return simple text for now (full PDF generation would need a library like pdfkit)
  return new NextResponse("PDF export is not yet implemented. Use TXT or CSV.", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 501,
  });
}
