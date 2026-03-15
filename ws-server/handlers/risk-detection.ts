import { Server } from "socket.io";
import { getPrisma } from "../db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

interface FinalizedTranscript {
  transcriptId: string;
  meetingId: string;
  speaker: string;
  text: string;
  timestamp: number;
  riskDetectionPrompt?: string;
}

/**
 * FR-051: 確定テキストに対するリスク検知
 * 確定後にAIで再判定し、リスクがあればRiskItemとして保存
 */
export async function handleRiskDetection(io: Server, data: FinalizedTranscript) {
  const prisma = getPrisma();
  const { meetingId, speaker, text, timestamp } = data;

  if (!process.env.ANTHROPIC_API_KEY) {
    return; // Skip if no API key
  }

  try {
    // Get the case's risk detection prompt via meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        case: { select: { templateSnapshot: true } },
      },
    });

    const templateSnapshot = (meeting?.case as any)?.templateSnapshot;
    const riskPrompt = templateSnapshot?.riskDetectionPrompt ||
      "以下の面談中の発言にリスクがないか判定してください。パワハラ・セクハラ・脅迫・不適切な表現・法的リスクのある発言を検出してください。";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: riskPrompt,
      messages: [
        {
          role: "user",
          content: `話者: ${speaker}\n発言: ${text}\n\nJSON形式で回答:\n{"isRisky": boolean, "reason": "理由", "confidence": "HIGH|MEDIUM|LOW", "rephrasing": "言い換え案（リスクありの場合のみ）"}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock?.text ?? "";

    let result = { isRisky: false, reason: "", confidence: "LOW" as const, rephrasing: undefined as string | undefined };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parse failure - treat as no risk
    }

    if (result.isRisky) {
      const riskItem = await prisma.riskItem.create({
        data: {
          meetingId,
          speaker,
          text,
          timestamp,
          reason: result.reason || "リスクが検出されました",
          confidence: (result.confidence as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
          rephrasing: result.rephrasing,
          status: "PENDING",
        },
      });

      // Broadcast risk alert to all clients in the meeting
      io.to(`meeting:${meetingId}`).emit("risk:detected", riskItem);
    }
  } catch (error) {
    console.error("[WS] Risk detection error:", error);
  }
}
