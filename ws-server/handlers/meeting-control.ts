import { Server } from "socket.io";
import { getPrisma } from "../db";

/**
 * FR-049: 面談終了処理
 * FR-085: 自動終了（無音/参加者0人/最大時間）
 */
export async function handleMeetingControl(
  io: Server,
  data: { meetingId: string; reason: string; userId?: string },
  activeMeetings: Map<string, Set<string>>
) {
  const prisma = getPrisma();
  const { meetingId, reason } = data;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { case: true },
    });

    if (!meeting || meeting.endedAt) return;

    // End the meeting
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        endedAt: new Date(),
        endReason: reason as any,
      },
    });

    // Update case status
    await prisma.case.update({
      where: { id: meeting.caseId },
      data: { status: "MEETING_ENDED" },
    });

    // Notify all clients
    io.to(`meeting:${meetingId}`).emit("meeting:ended", {
      meetingId,
      reason,
      endedAt: new Date().toISOString(),
    });

    // Clean up room tracking
    activeMeetings.delete(meetingId);

    // Trigger async summary generation (FR-114)
    generateMeetingSummaryAsync(meetingId).catch((err) => {
      console.error("[WS] Summary generation failed:", err);
    });

    console.log(`[WS] Meeting ${meetingId} ended (reason: ${reason})`);
  } catch (error) {
    console.error("[WS] Meeting end error:", error);
  }
}

/**
 * FR-114: 面談要点の自動生成（面談終了後に非同期実行）
 */
async function generateMeetingSummaryAsync(meetingId: string) {
  const prisma = getPrisma();

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcripts: {
        where: { isFinal: true },
        orderBy: { timestamp: "asc" as const },
      },
    },
  });

  if (!meeting || meeting.transcripts.length === 0) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[WS] Skipping summary generation - no API key");
    return;
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const transcriptText = meeting.transcripts
    .map((t: any) => `[${Math.floor(t.timestamp / 60)}:${String(Math.floor(t.timestamp % 60)).padStart(2, "0")}] ${t.speaker}: ${t.text}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: "以下の面談の文字起こしから、JSON形式で要点を生成してください。",
    messages: [
      {
        role: "user",
        content: `${transcriptText}\n\nJSON形式で回答:\n{"keyPoints": "要点（箇条書き）", "actionItems": "アクションアイテム", "concerns": "懸念事項"}`,
      },
    ],
  });

  const textBlock = response.content.find((block: any) => block.type === "text") as any;
  const responseText = textBlock?.text ?? "";

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const summary = JSON.parse(jsonMatch[0]);
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { meetingSummary: JSON.stringify(summary) },
      });
      console.log(`[WS] Summary generated for meeting ${meetingId}`);
    }
  } catch {
    // Save raw text as fallback
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { meetingSummary: responseText },
    });
  }
}

/**
 * FR-085: 自動終了チェッカー
 * 定期的にアクティブな面談をチェックし、条件を満たした場合に終了
 */
export function startAutoEndChecker(
  io: Server,
  activeMeetings: Map<string, Set<string>>
) {
  const CHECK_INTERVAL = 60_000; // 1分ごとにチェック

  setInterval(async () => {
    const prisma = getPrisma();

    try {
      // Find active meetings
      const active = await prisma.meeting.findMany({
        where: { endedAt: null, startedAt: { not: null } },
        include: {
          case: {
            include: {
              organization: {
                select: { autoEndSettings: true },
              },
            },
          },
        },
      });

      for (const meeting of active) {
        const settings = (meeting.case.organization as any).autoEndSettings;
        let parsed: any = {};
        try {
          parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
        } catch { /* ignore */ }

        const maxDurationMs = (parsed.maxDurationHours ?? 3) * 60 * 60 * 1000;
        const elapsed = Date.now() - (meeting.startedAt?.getTime() ?? Date.now());

        // Check max duration
        if (elapsed > maxDurationMs) {
          await handleMeetingControl(
            io,
            { meetingId: meeting.id, reason: "MAX_DURATION" },
            activeMeetings
          );
          continue;
        }

        // Check no participants
        if (parsed.endOnNoParticipants) {
          const wsParticipants = activeMeetings.get(meeting.id)?.size ?? 0;
          if (wsParticipants === 0 && elapsed > 5 * 60 * 1000) {
            // No WS connections for >5 min after start
            await handleMeetingControl(
              io,
              { meetingId: meeting.id, reason: "NO_PARTICIPANTS" },
              activeMeetings
            );
          }
        }
      }
    } catch (error) {
      console.error("[WS] Auto-end check error:", error);
    }
  }, CHECK_INTERVAL);
}
