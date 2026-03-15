import { NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db/client";
import { processTranscriptChunk, mapConfidence } from "@/server/services/transcription";

/**
 * Webhook endpoint for Recall.ai real-time transcription
 * Receives transcription data and stores it, then forwards to WebSocket server
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Recall.ai sends various event types
    const eventType = body.event || body.type;

    if (eventType === "bot.transcription") {
      const { bot_id, transcript } = body.data || body;

      if (!transcript) {
        return NextResponse.json({ ok: true });
      }

      // Find the meeting associated with this bot
      // We store botId in meeting metadata (to be added)
      const meeting = await prisma.meeting.findFirst({
        where: {
          endedAt: null,
          // Match by bot ID stored in meeting or by active meetings
        },
        orderBy: { createdAt: "desc" },
      });

      if (!meeting) {
        console.warn(`[Webhook] No active meeting found for bot ${bot_id}`);
        return NextResponse.json({ ok: true });
      }

      const processed = processTranscriptChunk({
        meetingId: meeting.id,
        speaker: transcript.speaker || "不明",
        text: transcript.words?.map((w: any) => w.text).join("") || transcript.text || "",
        timestamp: transcript.start_time || 0,
        isFinal: transcript.is_final ?? false,
        confidence: transcript.confidence,
        receivedAt: Date.now(),
      });

      // Save to database
      await prisma.transcript.create({
        data: {
          meetingId: processed.meetingId,
          speaker: processed.speaker,
          text: processed.text,
          timestamp: processed.timestamp,
          isFinal: processed.isFinal,
          confidence: mapConfidence(transcript.confidence),
        },
      });

      // Forward to WebSocket server for real-time broadcast
      const wsUrl = process.env.WS_SERVER_URL || "http://localhost:3001";
      fetch(`${wsUrl}/api/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processed),
      }).catch(() => {
        // Non-blocking - WS forwarding is best-effort
      });

      // Check for delay warning
      if (processed.delay.hasDelay) {
        console.warn(`[Webhook] Transcription delay: ${processed.delay.delayMs}ms for meeting ${meeting.id}`);
      }
    }

    if (eventType === "bot.status_change") {
      const { bot_id, status } = body.data || body;
      console.log(`[Webhook] Bot ${bot_id} status: ${status?.code}`);

      // Handle participant count check (FR-082)
      if (status?.code === "in_call_recording") {
        const { validateParticipantCount } = await import("@/server/services/meeting-bot");
        const check = await validateParticipantCount(bot_id);
        if (!check.valid) {
          console.warn(`[Webhook] Participant limit exceeded: ${check.count}/5 for bot ${bot_id}`);
          const { removeBot } = await import("@/server/services/meeting-bot");
          await removeBot(bot_id);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
