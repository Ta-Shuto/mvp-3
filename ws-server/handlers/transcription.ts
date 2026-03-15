import { Server } from "socket.io";
import { getPrisma } from "../db";

interface TranscriptData {
  meetingId: string;
  speaker: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * FR-050: リアルタイム文字起こし処理
 * FR-087: 信頼度付き表示
 * FR-097: 日英混在テキスト対応
 */
export async function handleTranscription(io: Server, data: TranscriptData) {
  const prisma = getPrisma();
  const { meetingId, speaker, text, timestamp, isFinal, confidence } = data;

  try {
    // Save to database
    const transcript = await prisma.transcript.create({
      data: {
        meetingId,
        speaker,
        text,
        timestamp,
        isFinal,
        confidence: confidence || "MEDIUM",
      },
    });

    // FR-086: Track timing for delay detection
    const emitData = {
      ...transcript,
      receivedAt: Date.now(),
    };

    // Broadcast to all clients in the meeting room
    io.to(`meeting:${meetingId}`).emit("transcript:new", emitData);

    // If finalized, trigger risk detection
    if (isFinal) {
      io.to(`meeting:${meetingId}`).emit("transcript:finalized", {
        transcriptId: transcript.id,
        meetingId,
        speaker,
        text,
        timestamp,
      });
    }

    return transcript;
  } catch (error) {
    console.error("[WS] Transcription error:", error);
    io.to(`meeting:${meetingId}`).emit("error", {
      type: "transcription",
      message: "文字起こしの保存に失敗しました",
    });
  }
}

/**
 * FR-050: 暫定 → 確定に更新
 */
export async function finalizeTranscript(
  io: Server,
  data: { transcriptId: string; meetingId: string; text: string }
) {
  const prisma = getPrisma();

  try {
    const updated = await prisma.transcript.update({
      where: { id: data.transcriptId },
      data: { isFinal: true, text: data.text },
    });

    io.to(`meeting:${data.meetingId}`).emit("transcript:updated", updated);
    return updated;
  } catch (error) {
    console.error("[WS] Finalize transcript error:", error);
  }
}
